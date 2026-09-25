import Stripe from 'stripe';
import { getEnv } from '@/src/server/env';
import { db } from '@/src/server/db';
import { getProduct, type PlanCode, type Product } from '@/src/domain/catalog';
import type { OrderRow, SubscriptionRow } from '@/src/server/services/billing';

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (client) return client;
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY_MISSING');
  client = new Stripe(env.STRIPE_SECRET_KEY, env.STRIPE_API_VERSION ? { apiVersion: env.STRIPE_API_VERSION as Stripe.LatestApiVersion } : {});
  return client;
}

export function priceIdFor(code: string): string {
  const env = getEnv();
  const map: Record<string, string> = {
    pack_1: env.STRIPE_PRICE_PACK_1,
    pack_5: env.STRIPE_PRICE_PACK_5,
    pack_10: env.STRIPE_PRICE_PACK_10,
    monthly_10: env.STRIPE_PRICE_MONTHLY_10,
    creator_25: env.STRIPE_PRICE_CREATOR_25,
  };
  const id = map[code];
  if (!id) throw new Error(`STRIPE_PRICE_NOT_CONFIGURED:${code}`);
  return id;
}

/** Maps a configured Stripe price back to our product code (never trusts client input). */
export function productForPrice(priceId: string): Product | null {
  for (const code of ['pack_1', 'pack_5', 'pack_10', 'monthly_10', 'creator_25']) {
    try {
      if (priceIdFor(code) === priceId) return getProduct(code) ?? null;
    } catch {
      /* not configured */
    }
  }
  return null;
}

export const stripeGateway = {
  async ensureCustomer(userId: string, email: string): Promise<string> {
    const existing = await db.one<{ stripe_customer_id: string }>(`select stripe_customer_id from public.orders where user_id=$1 and stripe_customer_id like 'cus_%' order by created_at asc limit 1`, [userId]);
    if (existing) return existing.stripe_customer_id;
    const sub = await db.one<{ stripe_customer_id: string }>(`select stripe_customer_id from public.subscriptions where user_id=$1 and stripe_customer_id like 'cus_%' limit 1`, [userId]);
    if (sub) return sub.stripe_customer_id;
    const c = await stripe().customers.create({ email, metadata: { again_user_id: userId } }, { idempotencyKey: `customer:${userId}` });
    return c.id;
  },

  async createCheckoutSession(input: { order: OrderRow; product: Product; customerId: string; userId: string }) {
    const env = getEnv();
    const s = await stripe().checkout.sessions.create(
      {
        ui_mode: 'elements',
        mode: input.product.mode,
        customer: input.customerId,
        line_items: [{ price: priceIdFor(input.product.code), quantity: 1 }],
        return_url: `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        automatic_tax: { enabled: true },
        metadata: { again_user_id: input.userId, again_order_id: input.order.id, again_product: input.product.code },
        ...(input.product.mode === 'subscription' ? { subscription_data: { metadata: { again_user_id: input.userId, again_product: input.product.code } } } : {}),
      },
      { idempotencyKey: `checkout:${input.order.id}` },
    );
    return { id: s.id, clientSecret: s.client_secret ?? '', amountTotalCents: s.amount_total ?? input.product.amountCents, taxCents: s.total_details?.amount_tax ?? null };
  },

  async retrieveSession(sessionId: string) {
    const s = await stripe().checkout.sessions.retrieve(sessionId, { expand: ['payment_intent', 'subscription'] });
    return {
      id: s.id,
      status: s.status,
      paymentStatus: s.payment_status,
      amountTotalCents: s.amount_total,
      taxCents: s.total_details?.amount_tax ?? null,
      currency: s.currency ?? 'usd',
      mode: s.mode,
      customer: typeof s.customer === 'string' ? s.customer : (s.customer?.id ?? null),
      subscriptionId: typeof s.subscription === 'string' ? s.subscription : (s.subscription?.id ?? null),
      metadata: s.metadata ?? {},
      raw: s,
    };
  },

  /** Pull authoritative session state and fulfill if paid (idempotent through the same service path). */
  async reconcileSession(sessionId: string) {
    const { billingService } = await import('@/src/server/services/billing');
    const s = await this.retrieveSession(sessionId);
    const order = await db.one<OrderRow>('select * from public.orders where stripe_session_id=$1', [sessionId]);
    if (!order) return;
    if (s.mode === 'payment') {
      if (s.paymentStatus === 'paid') {
        const receipt = await this.receiptUrl(s.raw);
        await billingService.fulfillPack({ orderId: order.id, sessionId, amountTotalCents: s.amountTotalCents ?? order.expected_subtotal_cents, taxCents: s.taxCents, currency: s.currency, receiptUrl: receipt });
      } else if (s.status === 'expired') {
        await db.query(`update public.orders set status='canceled', updated_at=now() where id=$1 and status in ('open','pending')`, [order.id]);
      } else if (s.status === 'complete' && s.paymentStatus === 'unpaid') {
        await db.query(`update public.orders set status='pending', updated_at=now() where id=$1 and status='open'`, [order.id]);
      }
    } else if (s.subscriptionId) {
      await this.syncSubscription(s.subscriptionId);
      const inv = await stripe().invoices.list({ subscription: s.subscriptionId, limit: 3 });
      for (const invoice of inv.data) if (invoice.status === 'paid') await this.fulfillFromInvoice(invoice, order.id);
    }
  },

  async receiptUrl(session: Stripe.Checkout.Session): Promise<string | null> {
    try {
      const pi = typeof session.payment_intent === 'string' ? await stripe().paymentIntents.retrieve(session.payment_intent, { expand: ['latest_charge'] }) : session.payment_intent;
      const charge = pi && typeof pi !== 'string' ? pi.latest_charge : null;
      if (charge && typeof charge !== 'string') return charge.receipt_url ?? null;
      if (typeof charge === 'string') return (await stripe().charges.retrieve(charge)).receipt_url ?? null;
    } catch {
      /* ignore */
    }
    return null;
  },

  planFromSubscription(sub: Stripe.Subscription): PlanCode | null {
    const price = sub.items.data[0]?.price?.id;
    const p = price ? productForPrice(price) : null;
    return p && p.mode === 'subscription' ? (p.code as PlanCode) : null;
  },

  async syncSubscription(subscriptionId: string) {
    const { billingService } = await import('@/src/server/services/billing');
    const sub = await stripe().subscriptions.retrieve(subscriptionId, { expand: ['schedule'] });
    const plan = this.planFromSubscription(sub);
    const userId = sub.metadata?.again_user_id ?? (await this.userForCustomer(typeof sub.customer === 'string' ? sub.customer : sub.customer.id));
    if (!plan || !userId) {
      console.warn('[stripe] subscription without recognizable plan/user', subscriptionId);
      return;
    }
    const item = sub.items.data[0];
    const periodStart = item?.current_period_start ? new Date(item.current_period_start * 1000) : null;
    const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;
    let scheduledPlan: string | null = null;
    let scheduleId: string | null = null;
    const schedule = sub.schedule && typeof sub.schedule !== 'string' ? sub.schedule : null;
    if (schedule && schedule.status === 'active') {
      scheduleId = schedule.id;
      const next = schedule.phases[schedule.phases.length - 1];
      const nextPrice = next?.items?.[0]?.price;
      const p = typeof nextPrice === 'string' ? productForPrice(nextPrice) : nextPrice ? productForPrice(nextPrice.id) : null;
      if (p && p.code !== plan) scheduledPlan = p.code;
    }
    await billingService.upsertSubscription({
      userId,
      stripeSubscriptionId: sub.id,
      customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      planCode: plan,
      status: sub.status,
      periodStart,
      periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      scheduledPlanCode: scheduledPlan,
      scheduleId,
    });
  },

  async userForCustomer(customerId: string): Promise<string | null> {
    const r = await db.one<{ user_id: string }>(
      `select user_id from public.orders where stripe_customer_id=$1 union select user_id from public.subscriptions where stripe_customer_id=$1 limit 1`,
      [customerId],
    );
    if (r) return r.user_id;
    try {
      const c = await stripe().customers.retrieve(customerId);
      return !('deleted' in c) ? (c.metadata?.again_user_id ?? null) : null;
    } catch {
      return null;
    }
  },

  /** invoice.paid → one monthly grant, only for full-price recurring invoices of a known plan. */
  async fulfillFromInvoice(invoice: Stripe.Invoice, orderId: string | null = null) {
    const { billingService } = await import('@/src/server/services/billing');
    if (invoice.status !== 'paid') return;
    const line = invoice.lines.data[0];
    const subDetails = invoice.parent?.subscription_details;
    const subscriptionId = subDetails?.subscription ? (typeof subDetails.subscription === 'string' ? subDetails.subscription : subDetails.subscription.id) : null;
    if (!subscriptionId || !line) return;
    const rawPrice = line.pricing?.price_details?.price ?? null;
    const priceId = typeof rawPrice === 'string' ? rawPrice : (rawPrice?.id ?? null);
    const product = priceId ? productForPrice(priceId) : null;
    if (!product || product.mode !== 'subscription') return;
    await this.syncSubscription(subscriptionId);
    const periodEnd = line.period?.end ? new Date(line.period.end * 1000) : new Date(Date.now() + 31 * 86400_000);
    await billingService.fulfillInvoice({
      invoiceId: invoice.id!,
      stripeSubscriptionId: subscriptionId,
      customerId: typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? ''),
      planCode: product.code as PlanCode,
      amountPaidCents: invoice.amount_paid,
      periodEnd,
      orderId,
      receiptUrl: invoice.hosted_invoice_url ?? null,
    });
  },

  /** Schedule a plan change at next renewal (no proration) with a subscription schedule. */
  async schedulePlanChange(row: SubscriptionRow, planCode: PlanCode): Promise<string> {
    const s = stripe();
    let scheduleId = row.schedule_id;
    if (!scheduleId) {
      const sched = await s.subscriptionSchedules.create({ from_subscription: row.stripe_subscription_id });
      scheduleId = sched.id;
    }
    const sched = await s.subscriptionSchedules.retrieve(scheduleId);
    const current = sched.phases[0];
    await s.subscriptionSchedules.update(scheduleId, {
      end_behavior: 'release',
      phases: [
        { items: current.items.map((i) => ({ price: typeof i.price === 'string' ? i.price : i.price.id, quantity: i.quantity ?? 1 })), start_date: current.start_date, end_date: current.end_date, proration_behavior: 'none' },
        { items: [{ price: priceIdFor(planCode), quantity: 1 }], proration_behavior: 'none' },
      ],
    });
    return scheduleId;
  },

  async cancelAtPeriodEnd(row: SubscriptionRow) {
    if (row.schedule_id) await stripe().subscriptionSchedules.release(row.schedule_id).catch(() => {});
    await stripe().subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: true });
  },

  async resume(row: SubscriptionRow) {
    await stripe().subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: false });
  },

  async portalUrl(customerId: string): Promise<string> {
    const env = getEnv();
    const p = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: `${env.APP_URL}/account/billing` });
    return p.url;
  },

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const env = getEnv();
    if (!env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET_MISSING');
    return stripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  },
};
