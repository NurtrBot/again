import type Stripe from 'stripe';
import { db, withTransaction } from '../db';
import { stripeGateway } from '@/src/providers/stripe';
import { billingService } from './billing';

/** Durable, unique intake of a verified event. Returns false when already stored (duplicate). */
export async function storeEvent(event: Stripe.Event): Promise<boolean> {
  const r = await db.query(`insert into public.webhook_events(id, provider, event_type, payload) values ($1,'stripe',$2,$3) on conflict (id) do nothing`, [event.id, event.type, JSON.stringify(event)]);
  return r.rowCount > 0;
}

/** Applies business effects. Every branch is idempotent through source-keyed grants. */
export async function dispatchEvent(event: Stripe.Event): Promise<void> {
  await db.query('update public.webhook_events set attempts=attempts+1 where id=$1', [event.id]);
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (event.type === 'checkout.session.async_payment_failed') {
          await db.query(`update public.orders set status='failed', updated_at=now() where stripe_session_id=$1 and status in ('open','pending')`, [session.id]);
          break;
        }
        await stripeGateway.reconcileSession(session.id);
        break;
      }
      case 'invoice.paid': {
        await stripeGateway.fulfillFromInvoice(event.data.object as Stripe.Invoice);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.parent?.subscription_details?.subscription;
        const id = typeof subId === 'string' ? subId : subId?.id;
        if (id) await db.query(`update public.subscriptions set last_invoice_status='payment_failed', updated_at=now() where stripe_subscription_id=$1`, [id]);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed': {
        const sub = event.data.object as Stripe.Subscription;
        await stripeGateway.syncSubscription(sub.id);
        break;
      }
      case 'charge.refunded':
      case 'charge.dispute.created': {
        const obj = event.data.object as Stripe.Charge | Stripe.Dispute;
        const disputeCharge = (obj as Stripe.Dispute).charge as string | Stripe.Charge | undefined;
        const chargeId = event.type === 'charge.refunded' ? (obj as Stripe.Charge).id : typeof disputeCharge === 'string' ? disputeCharge : disputeCharge?.id;
        const pi = event.type === 'charge.refunded' ? (obj as Stripe.Charge).payment_intent : (obj as Stripe.Dispute).payment_intent;
        const piId = typeof pi === 'string' ? pi : pi?.id;
        if (piId) {
          const sessions = await (await import('@/src/providers/stripe')).stripe().checkout.sessions.list({ payment_intent: piId, limit: 1 });
          const session = sessions.data[0];
          if (session) {
            await withTransaction(async (tx) => {
              const r = await billingService.applyRefund(tx, `stripe:checkout:${session.id}`, event.type === 'charge.refunded' ? 'Refund' : 'Dispute');
              await tx.query(`update public.orders set status='refunded', updated_at=now() where stripe_session_id=$1`, [session.id]);
              console.log(`[webhook] ${event.type} charge=${chargeId} revoked=${r.revoked} debt=${r.debt}`);
            });
          }
        }
        break;
      }
      default:
        break;
    }
    await db.query('update public.webhook_events set processed_at=now(), error_code=null where id=$1', [event.id]);
  } catch (err) {
    const code = (err as Error).message?.slice(0, 120) ?? 'error';
    await db.query('update public.webhook_events set error_code=$2 where id=$1', [event.id, code]);
    throw err;
  }
}

/** Reprocess stored events that never completed (operator/worker task). */
export async function retryFailedEvents(limit = 20): Promise<number> {
  const rows = (await db.query<{ payload: Stripe.Event }>(`select payload from public.webhook_events where processed_at is null and attempts < 10 order by received_at asc limit $1`, [limit])).rows;
  let n = 0;
  for (const r of rows) {
    try {
      await dispatchEvent(r.payload);
      n++;
    } catch (e) {
      console.warn('[webhook retry] failed', (e as Error).message);
    }
  }
  return n;
}
