import { NextResponse } from 'next/server';
import { getEnv } from '@/src/server/env';
import { stripeGateway } from '@/src/providers/stripe';
import { storeEvent, dispatchEvent } from '@/src/server/services/webhooks';

export const dynamic = 'force-dynamic';

/** Raw-body signature verification → durable unique intake → transactional fulfillment. */
export async function POST(req: Request) {
  const env = getEnv();
  if (env.PAYMENTS_PROVIDER !== 'stripe') return NextResponse.json({ error: { code: 'webhooks_disabled' } }, { status: 503 });
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: { code: 'missing_signature' } }, { status: 400 });
  const raw = Buffer.from(await req.arrayBuffer());
  let event;
  try {
    event = stripeGateway.constructEvent(raw, sig);
  } catch (err) {
    console.warn('[webhook] signature rejected', (err as Error).message);
    return NextResponse.json({ error: { code: 'bad_signature' } }, { status: 400 });
  }
  const fresh = await storeEvent(event);
  if (!fresh) return NextResponse.json({ received: true, duplicate: true });
  try {
    await dispatchEvent(event);
  } catch (err) {
    // Stored durably; Stripe retries and the worker also replays unprocessed events.
    console.error('[webhook] dispatch failed', event.type, (err as Error).message);
    return NextResponse.json({ error: { code: 'dispatch_failed' } }, { status: 503 });
  }
  return NextResponse.json({ received: true });
}
