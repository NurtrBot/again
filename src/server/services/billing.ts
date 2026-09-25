import { randomUUID } from 'node:crypto';
import { db, withTransaction, type Tx } from '../db';
import { getEnv } from '../env';
import { HttpError, notFound } from '../errors';
import { creditsService } from './credits';
import { mediaService, type MediaRow } from './media';
import { CATALOG, CATALOG_VERSION, getProduct, isPlanCode, type PlanCode, type Product } from '@/src/domain/catalog';
import { canonicalHash } from '@/src/domain/helpers';
import type { Checkout, PaymentStatus, Subscription } from '@/src/domain/types';
import { stripeGateway } from '@/src/providers/stripe';

export interface OrderRow {
  id: string;
  user_id: string;
  draft_id: string | null;
  product_code: string;
  catalog_version: string;
  idempotency_key: string;
  payload_hash: string;
  stripe_customer_id: string;
  stripe_session_id: string | null;
  client_secret: string | null;
  mode: 'payment' | 'subscription';
  expected_subtotal_cents: number;
  final_total_cents: number | null;
  tax_cents: number | null;
  currency: string;
  status: 'creating' | 'open' | 'pending' | 'fulfilled' | 'failed' | 'refunded' | 'canceled';
  credits_granted: number | null;
  receipt_url: string | null;
  created_at: Date;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  plan_code: PlanCode;
  status: string;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  scheduled_plan_code: string | null;
  schedule_id: string | null;
  last_invoice_status: string | null;
}

const LIVE_SUB = `('active','trialing','past_due','incomplete','unpaid','paused')`;

function stripPopular(p: Product): Product {
  const { popular: _p, ...rest } = p;
  return rest;
}

async function projectOrder(row: OrderRow, userId: string): Promise<Checkout> {
  const product = getProduct(row.product_code)!;
  let draftPreviewUrl: string | null = null;
  if (row.draft_id) {
    const src = await db.one<MediaRow>('select m.* from public.drafts d join public.media_assets m on m.id=d.source_asset_id where d.id=$1 and d.user_id=$2', [row.draft_id, userId]);
    draftPreviewUrl = await mediaService.previewUrl(src);
  }
  const fulfillment: Checkout['fulfillmentStatus'] = row.status === 'fulfilled' ? 'fulfilled' : row.status === 'failed' || row.status === 'canceled' ? 'failed' : 'pending';
  return {
    id: row.id,
    stripeSessionId: row.stripe_session_id ?? '',
    clientSecret: row.client_secret ?? '',
    product: stripPopular(product),
    draftId: row.draft_id,
    fulfillmentStatus: fulfillment,
    amountTotalCents: row.final_total_cents ?? row.expected_subtotal_cents,
    currency: row.currency,
    taxCents: row.tax_cents,
    draftPreviewUrl,
    provider: getEnv().PAYMENTS_PROVIDER,
    status: row.status === 'creating' ? 'open' : row.status === 'refunded' ? 'fulfilled' : row.status,
  };
}

export const billingService = {
  catalog() {
    return { products: CATALOG.map(stripPopular), version: CATALOG_VERSION };
  },

  /** Server-validated checkout creation. Rejects a second live subscription. */
  async createCheckout(userId: string, email: string, input: { productCode: string; draftId?: string }, idempotencyKey: string | null): Promise<Checkout> {
    const env = getEnv();
    if (!env.PAYMENTS_ENABLED) throw new HttpError(503, 'payments_paused', 'Purchases are temporarily unavailable.', { retryable: true });
    const product = getProduct(input.productCode);
    if (!product) throw new HttpError(422, 'validation', 'Unknown product.', { retryable: false, fieldErrors: { productCode: 'Unknown product' } });
    const key = idempotencyKey ?? randomUUID();
    const payloadHash = canonicalHash({ productCode: input.productCode, draftId: input.draftId ?? null });
    const existing = await db.one<OrderRow>('select * from public.orders where user_id=$1 and idempotency_key=$2', [userId, key]);
    if (existing) {
      if (existing.payload_hash !== payloadHash) throw new HttpError(409, 'idempotency_conflict', 'This request key was already used with different input.', { retryable: false });
      return projectOrder(existing, userId);
    }
    if (input.draftId) {
      const owned = await db.one('select 1 from public.drafts where id=$1 and user_id=$2', [input.draftId, userId]);
      if (!owned) throw notFound('draft');
    }
    if (product.mode === 'subscription') {
      const live = await db.one(`select 1 from public.subscriptions where user_id=$1 and status in ${LIVE_SUB}`, [userId]);
      if (live) throw new HttpError(409, 'subscription_exists', 'You already have an active plan. Manage it from your account.', { retryable: false });
    }
    const recent = await db.one<{ n: string }>(`select count(*)::text as n from public.orders where user_id=$1 and created_at > now() - interval '10 minutes'`, [userId]);
    if (Number(recent?.n ?? 0) >= 10) throw new HttpError(429, 'rate_limited', 'Too many checkouts started. Please wait a moment.', { headers: { 'Retry-After': '120' } });

    if (env.PAYMENTS_PROVIDER === 'mock') {
      const row = await db.one<OrderRow>(
        `insert into public.orders(user_id, draft_id, product_code, catalog_version, idempotency_key, payload_hash, stripe_customer_id, stripe_session_id, client_secret, mode, expected_subtotal_cents, final_total_cents, tax_cents, currency, status)
         values ($1,$2,$3,$4,$5,$6,'mock_customer',$7,$8,$9,$10,$10,0,'usd','open') on conflict (user_id, idempotency_key) do update set updated_at=now() returning *`,
        [userId, input.draftId ?? null, product.code, CATALOG_VERSION, key, payloadHash, `mock_cs_${randomUUID()}`, 'mock_secret', product.mode, product.amountCents],
      );
      return projectOrder(row!, userId);
    }
    // Stripe: create/reuse customer, insert order in 'creating', then create the session outside any DB lock.
    const customerId = await stripeGateway.ensureCustomer(userId, email);
    const inserted = await db.one<OrderRow>(
      `insert into public.orders(user_id, draft_id, product_code, catalog_version, idempotency_key, payload_hash, stripe_customer_id, mode, expected_subtotal_cents, currency, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'usd','creating') on conflict (user_id, idempotency_key) do nothing returning *`,
      [userId, input.draftId ?? null, product.code, CATALOG_VERSION, key, payloadHash, customerId, product.mode, product.amountCents],
    );
    const order = inserted ?? (await db.one<OrderRow>('select * from public.orders where user_id=$1 and idempotency_key=$2', [userId, key]))!;
    if (order.status !== 'creating') return projectOrder(order, userId);
    const session = await stripeGateway.createCheckoutSession({ order, product, customerId, userId });
    const updated = await db.one<OrderRow>(
      `update public.orders set stripe_session_id=$2, client_secret=$3, final_total_cents=$4, tax_cents=$5, status='open', updated_at=now() where id=$1 and status='creating' returning *`,
      [order.id, session.id, session.clientSecret, session.amountTotalCents, session.taxCents],
    );
    return projectOrder(updated ?? order, userId);
  },

  async getCheckout(userId: string, checkoutId: string): Promise<Checkout | null> {
    const row = await db.one<OrderRow>('select * from public.orders where id=$1 and user_id=$2', [checkoutId, userId]);
    if (!row) return null;
    if (row.status === 'open' && getEnv().PAYMENTS_PROVIDER === 'stripe' && row.stripe_session_id) {
      // Refresh authoritative totals (tax) for display; never grants credits.
      const s = await stripeGateway.retrieveSession(row.stripe_session_id).catch(() => null);
      if (s && s.amountTotalCents !== null) {
        await db.query('update public.orders set final_total_cents=$2, tax_cents=$3, updated_at=now() where id=$1', [row.id, s.amountTotalCents, s.taxCents]);
        row.final_total_cents = s.amountTotalCents;
        row.tax_cents = s.taxCents;
      }
    }
    return projectOrder(row, userId);
  },

  /** Mock payments only: settle a demo checkout with the given outcome. */
  async mockPay(userId: string, checkoutId: string, outcome: 'success' | 'fail' | 'cancel'): Promise<{ redirectUrl: string }> {
    if (getEnv().PAYMENTS_PROVIDER !== 'mock') throw notFound('checkout');
    const row = await db.one<OrderRow>('select * from public.orders where id=$1 and user_id=$2', [checkoutId, userId]);
    if (!row) throw notFound('checkout');
    if (row.status === 'fulfilled') return { redirectUrl: `/checkout/success?session_id=${encodeURIComponent(row.stripe_session_id!)}` };
    if (outcome === 'cancel') {
      await db.query(`update public.orders set status='canceled', updated_at=now() where id=$1 and status in ('open','failed')`, [row.id]);
      return { redirectUrl: `/credits?tab=${row.mode === 'subscription' ? 'monthly' : 'packs'}${row.draft_id ? `&returnTo=${encodeURIComponent(`/create/${row.draft_id}`)}` : ''}` };
    }
    if (outcome === 'fail') {
      await db.query(`update public.orders set status='failed', updated_at=now() where id=$1 and status='open'`, [row.id]);
      throw new HttpError(402, 'card_declined', 'Your card was declined (demo). Try another payment method.', { retryable: true });
    }
    // Fulfill through the SAME transactional path the Stripe webhook uses.
    if (row.mode === 'payment') {
      await this.fulfillPack({ orderId: row.id, sessionId: row.stripe_session_id!, amountTotalCents: row.expected_subtotal_cents, taxCents: 0, currency: 'usd', receiptUrl: null });
    } else {
      const subId = `mock_sub_${row.id.slice(0, 8)}`;
      const start = new Date();
      const end = new Date(start.getTime() + 30 * 86400_000);
      await this.upsertSubscription({ userId, stripeSubscriptionId: subId, customerId: 'mock_customer', planCode: row.product_code as PlanCode, status: 'active', periodStart: start, periodEnd: end, cancelAtPeriodEnd: false });
      await this.fulfillInvoice({ invoiceId: `mock_in_${row.id.slice(0, 8)}_1`, stripeSubscriptionId: subId, customerId: 'mock_customer', planCode: row.product_code as PlanCode, amountPaidCents: row.expected_subtotal_cents, periodEnd: end, orderId: row.id });
    }
    return { redirectUrl: `/checkout/success?session_id=${encodeURIComponent(row.stripe_session_id!)}` };
  },

  /** fulfill_pack: verified session → one grant keyed by the session, order marked fulfilled. Idempotent. */
  async fulfillPack(input: { orderId: string | null; sessionId: string; amountTotalCents: number; taxCents: number | null; currency: string; receiptUrl: string | null }) {
    return withTransaction(async (tx) => {
      const order = await tx.one<OrderRow>(
        input.orderId ? 'select * from public.orders where id=$1 for update' : 'select * from public.orders where stripe_session_id=$1 for update',
        [input.orderId ?? input.sessionId],
      );
      if (!order) throw new Error('ORDER_MISSING');
      if (order.mode !== 'payment') throw new Error('ORDER_NOT_PACK');
      const product = getProduct(order.product_code)!;
      await creditsService.lockAccount(tx, order.user_id);
      const g = await creditsService.grant(tx, order.user_id, {
        kind: 'purchase',
        sourceKey: `stripe:checkout:${input.sessionId}`,
        credits: product.credits,
        description: `Bought ${product.credits} credit${product.credits === 1 ? '' : 's'}`,
      });
      await tx.query(
        `update public.orders set status='fulfilled', final_total_cents=$2, tax_cents=$3, currency=$4, credits_granted=$5, receipt_url=coalesce($6, receipt_url), updated_at=now() where id=$1`,
        [order.id, input.amountTotalCents, input.taxCents, input.currency, product.credits, input.receiptUrl],
      );
      return { created: g.created, credits: product.credits, userId: order.user_id };
    });
  },

  /** fulfill_invoice: one monthly grant per paid invoice, expiring at period end. Idempotent. */
  async fulfillInvoice(input: { invoiceId: string; stripeSubscriptionId: string; customerId: string; planCode: PlanCode; amountPaidCents: number; periodEnd: Date; orderId?: string | null; receiptUrl?: string | null }) {
    const product = getProduct(input.planCode)!;
    if (input.amountPaidCents < product.amountCents) {
      console.warn('[billing] invoice paid less than plan price; no grant', input.invoiceId, input.amountPaidCents);
      return { created: false, credits: 0 };
    }
    return withTransaction(async (tx) => {
      const sub = await tx.one<SubscriptionRow>('select * from public.subscriptions where stripe_subscription_id=$1 for update', [input.stripeSubscriptionId]);
      if (!sub) throw new Error('SUBSCRIPTION_MISSING');
      await creditsService.lockAccount(tx, sub.user_id);
      const g = await creditsService.grant(tx, sub.user_id, {
        kind: 'monthly',
        sourceKey: `stripe:invoice:${input.invoiceId}`,
        credits: product.credits,
        description: `${product.name} plan · ${product.credits} credits`,
        expiresAt: input.periodEnd,
      });
      await tx.query(`update public.subscriptions set last_invoice_status='paid', updated_at=now() where id=$1`, [sub.id]);
      if (input.orderId) {
        await tx.query(`update public.orders set status='fulfilled', final_total_cents=$2, credits_granted=$3, receipt_url=coalesce($4, receipt_url), updated_at=now() where id=$1 and status<>'fulfilled'`, [
          input.orderId,
          input.amountPaidCents,
          product.credits,
          input.receiptUrl ?? null,
        ]);
      } else {
        await tx.query(`update public.orders set status='fulfilled', credits_granted=$2, updated_at=now() where user_id=$1 and mode='subscription' and status in ('open','pending') and product_code=$3`, [
          sub.user_id,
          product.credits,
          input.planCode,
        ]);
      }
      return { created: g.created, credits: product.credits, userId: sub.user_id };
    });
  },

  async upsertSubscription(input: {
    userId: string;
    stripeSubscriptionId: string;
    customerId: string;
    planCode: PlanCode;
    status: string;
    periodStart: Date | null;
    periodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    scheduledPlanCode?: string | null;
    scheduleId?: string | null;
  }) {
    await db.query(
      `insert into public.subscriptions(user_id, stripe_subscription_id, stripe_customer_id, plan_code, status, current_period_start, current_period_end, cancel_at_period_end, scheduled_plan_code, schedule_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (stripe_subscription_id) do update set plan_code=excluded.plan_code, status=excluded.status, current_period_start=excluded.current_period_start, current_period_end=excluded.current_period_end,
         cancel_at_period_end=excluded.cancel_at_period_end, scheduled_plan_code=coalesce(excluded.scheduled_plan_code, public.subscriptions.scheduled_plan_code), schedule_id=coalesce(excluded.schedule_id, public.subscriptions.schedule_id), updated_at=now()`,
      [input.userId, input.stripeSubscriptionId, input.customerId, input.planCode, input.status, input.periodStart, input.periodEnd, input.cancelAtPeriodEnd, input.scheduledPlanCode ?? null, input.scheduleId ?? null],
    );
  },

  /** Owner reconciliation of a return URL; the query string is never proof of payment. */
  async sessionStatus(userId: string, sessionId: string): Promise<PaymentStatus | null> {
    const row = await db.one<OrderRow>('select * from public.orders where stripe_session_id=$1 and user_id=$2', [sessionId, userId]);
    if (!row) return null;
    const env = getEnv();
    if (row.status !== 'fulfilled' && env.PAYMENTS_PROVIDER === 'stripe' && row.stripe_session_id) {
      // Pull authoritative state in case the webhook is delayed; fulfillment stays idempotent.
      await stripeGateway.reconcileSession(row.stripe_session_id).catch((e) => console.warn('[billing] reconcile failed', (e as Error).message));
    }
    const fresh = (await db.one<OrderRow>('select * from public.orders where id=$1', [row.id]))!;
    let draftPreviewUrl: string | null = null;
    if (fresh.draft_id) {
      const src = await db.one<MediaRow>('select m.* from public.drafts d join public.media_assets m on m.id=d.source_asset_id where d.id=$1 and d.user_id=$2', [fresh.draft_id, userId]);
      draftPreviewUrl = await mediaService.previewUrl(src);
    }
    const status: PaymentStatus['status'] = fresh.status === 'fulfilled' ? 'fulfilled' : fresh.status === 'failed' || fresh.status === 'canceled' ? 'failed' : fresh.status === 'pending' ? 'pending' : 'open';
    return {
      status,
      creditsAdded: fresh.credits_granted ?? 0,
      draftId: fresh.draft_id,
      receiptUrl: fresh.receipt_url,
      product: stripPopular(getProduct(fresh.product_code)!),
      amountTotalCents: fresh.final_total_cents ?? fresh.expected_subtotal_cents,
      mode: fresh.mode,
      draftPreviewUrl,
    };
  },

  async subscriptionRow(userId: string): Promise<SubscriptionRow | null> {
    return db.one<SubscriptionRow>(`select * from public.subscriptions where user_id=$1 order by (status in ${LIVE_SUB}) desc, updated_at desc limit 1`, [userId]);
  },

  async subscription(userId: string): Promise<Subscription> {
    const row = await this.subscriptionRow(userId);
    const credits = await creditsService.balance(userId);
    if (!row || !['active', 'trialing', 'past_due', 'incomplete', 'unpaid', 'paused'].includes(row.status)) {
      return { status: 'none', plan: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, scheduledPlan: null, nextAmountCents: null, purchasedAvailable: credits.purchasedAvailable, monthlyAvailable: 0, monthlyIssued: 0 };
    }
    const product = getProduct(row.plan_code)!;
    const scheduled = row.scheduled_plan_code ? getProduct(row.scheduled_plan_code) : null;
    const status: Subscription['status'] = row.status === 'active' || row.status === 'trialing' ? 'active' : row.status === 'past_due' || row.status === 'unpaid' ? 'past_due' : 'incomplete';
    const issued = await db.one<{ issued: number }>(
      `select coalesce(sum(issued),0)::int as issued from public.credit_grants where user_id=$1 and kind='monthly' and expires_at is not null and expires_at>now()`,
      [userId],
    );
    return {
      status,
      plan: row.plan_code,
      currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      scheduledPlan: scheduled?.code ?? null,
      nextAmountCents: row.cancel_at_period_end ? null : (scheduled ?? product).amountCents,
      monthlyAvailable: credits.monthlyAvailable,
      monthlyIssued: issued?.issued ?? product.credits,
      purchasedAvailable: credits.purchasedAvailable,
    };
  },

  async changePlan(userId: string, productCode: string): Promise<Subscription> {
    if (!isPlanCode(productCode)) throw new HttpError(422, 'validation', 'Unknown plan.', { retryable: false });
    const row = await this.subscriptionRow(userId);
    if (!row || !['active', 'trialing', 'past_due'].includes(row.status)) throw new HttpError(409, 'no_subscription', 'You don’t have an active plan to change.', { retryable: false });
    if (row.plan_code === productCode && !row.scheduled_plan_code) return this.subscription(userId);
    let scheduleId: string | null = row.schedule_id;
    if (getEnv().PAYMENTS_PROVIDER === 'stripe') scheduleId = await stripeGateway.schedulePlanChange(row, productCode);
    await db.query('update public.subscriptions set scheduled_plan_code=$2, schedule_id=$3, updated_at=now() where id=$1', [row.id, productCode === row.plan_code ? null : productCode, scheduleId]);
    return this.subscription(userId);
  },

  async cancel(userId: string): Promise<Subscription> {
    const row = await this.subscriptionRow(userId);
    if (!row || !['active', 'trialing', 'past_due'].includes(row.status)) throw new HttpError(409, 'no_subscription', 'You don’t have an active plan.', { retryable: false });
    if (!row.cancel_at_period_end) {
      if (getEnv().PAYMENTS_PROVIDER === 'stripe') await stripeGateway.cancelAtPeriodEnd(row);
      await db.query('update public.subscriptions set cancel_at_period_end=true, scheduled_plan_code=null, updated_at=now() where id=$1', [row.id]);
    }
    return this.subscription(userId);
  },

  async resume(userId: string): Promise<Subscription> {
    const row = await this.subscriptionRow(userId);
    if (!row || !['active', 'trialing', 'past_due'].includes(row.status)) throw new HttpError(409, 'no_subscription', 'You don’t have an active plan.', { retryable: false });
    if (row.cancel_at_period_end) {
      if (row.current_period_end && row.current_period_end.getTime() < Date.now()) throw new HttpError(409, 'not_resumable', 'This plan already ended. Choose a plan to start again.', { retryable: false });
      if (getEnv().PAYMENTS_PROVIDER === 'stripe') await stripeGateway.resume(row);
      await db.query('update public.subscriptions set cancel_at_period_end=false, updated_at=now() where id=$1', [row.id]);
    }
    return this.subscription(userId);
  },

  async portalUrl(userId: string): Promise<string> {
    if (getEnv().PAYMENTS_PROVIDER !== 'stripe') throw new HttpError(503, 'portal_unavailable', 'The billing portal is unavailable in demo mode.', { retryable: false });
    const customer = await db.one<{ stripe_customer_id: string }>(`select stripe_customer_id from public.orders where user_id=$1 and stripe_customer_id<>'mock_customer' order by created_at desc limit 1`, [userId]);
    const customerId = customer?.stripe_customer_id ?? (await stripeGateway.ensureCustomer(userId, (await db.one<{ email: string }>('select email from public.profiles where id=$1', [userId]))!.email));
    return stripeGateway.portalUrl(customerId);
  },

  async cancelForDeletion(userId: string) {
    const row = await this.subscriptionRow(userId);
    if (row && ['active', 'trialing', 'past_due'].includes(row.status) && !row.cancel_at_period_end) {
      if (getEnv().PAYMENTS_PROVIDER === 'stripe') await stripeGateway.cancelAtPeriodEnd(row);
      await db.query('update public.subscriptions set cancel_at_period_end=true, updated_at=now() where id=$1', [row.id]);
    }
  },

  /** Refund/dispute: revoke unspent credits from the source exactly once; never negative balances. */
  async applyRefund(tx: Tx, sourceKey: string, reason: string) {
    return creditsService.revokeSource(tx, sourceKey, reason);
  },
};
