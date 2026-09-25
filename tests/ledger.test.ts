import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { db, closePool } from '../src/server/db';
import { creditsService } from '../src/server/services/credits';
import { generationsService } from '../src/server/services/generations';
import { billingService } from '../src/server/services/billing';
import { HttpError } from '../src/server/errors';
import { migrateTestDb, truncateAll, makeUser, grant, makeDraft, makeVideoAsset } from './helpers';

beforeAll(migrateTestDb);
beforeEach(truncateAll);
afterAll(closePool);

async function reserve(userId: string, draftId: string, key = randomUUID(), version = 1) {
  return generationsService.create(userId, { draftId, expectedDraftVersion: version }, key);
}

describe('credit reservation (reserve_generation)', () => {
  it('two simultaneous submissions with one credit: exactly one succeeds', async () => {
    const u = await makeUser();
    await grant(u, 1);
    const a = await makeDraft(u);
    const b = await makeDraft(u);
    const results = await Promise.allSettled([reserve(u, a.draftId), reserve(u, b.draftId)]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0].reason as HttpError).status).toBe(402);
    const bal = await creditsService.balance(u);
    expect(bal.available).toBe(0);
    expect(bal.held).toBe(1);
  });

  it('same idempotency key returns the same job; different payload → 409', async () => {
    const u = await makeUser();
    await grant(u, 5);
    const d = await makeDraft(u);
    const key = randomUUID();
    const first = await reserve(u, d.draftId, key);
    const second = await reserve(u, d.draftId, key);
    expect(second.job.id).toBe(first.job.id);
    expect(second.created).toBe(false);
    await expect(generationsService.create(u, { draftId: d.draftId, expectedDraftVersion: 2 }, key)).rejects.toMatchObject({ status: 409 });
    expect((await creditsService.balance(u)).held).toBe(1);
  });

  it('no credits → 402 before any side effect', async () => {
    const u = await makeUser();
    const d = await makeDraft(u);
    await expect(reserve(u, d.draftId)).rejects.toMatchObject({ status: 402 });
    const gens = await db.query('select 1 from public.generations where user_id=$1', [u]);
    expect(gens.rowCount).toBe(0);
    const outbox = await db.query('select 1 from public.outbox');
    expect(outbox.rowCount).toBe(0);
  });

  it('spends the soonest-expiring valid grant first and never an expired one', async () => {
    const u = await makeUser();
    await grant(u, 5, { kind: 'purchase' });
    await grant(u, 9, { kind: 'monthly', expiresAt: new Date(Date.now() - 1000) });
    const monthly = await grant(u, 1, { kind: 'monthly', expiresAt: new Date(Date.now() + 86400_000) });
    const d = await makeDraft(u);
    await reserve(u, d.draftId);
    const res = await db.one<{ grant_id: string }>('select grant_id from public.credit_reservations');
    expect(res!.grant_id).toBe(monthly.grantId);
  });

  it('caps active jobs per user', async () => {
    const u = await makeUser();
    await grant(u, 5);
    await reserve(u, (await makeDraft(u)).draftId);
    await reserve(u, (await makeDraft(u)).draftId);
    await expect(reserve(u, (await makeDraft(u)).draftId)).rejects.toMatchObject({ status: 429 });
  });

  it('cross-user draft is a neutral 404', async () => {
    const owner = await makeUser();
    const other = await makeUser();
    await grant(other, 1);
    const d = await makeDraft(owner);
    await expect(reserve(other, d.draftId)).rejects.toMatchObject({ status: 404 });
  });
});

describe('settlement (complete_generation / fail_generation)', () => {
  it('repeated ready delivery settles once', async () => {
    const u = await makeUser();
    await grant(u, 1);
    const d = await makeDraft(u);
    const { job } = await reserve(u, d.draftId);
    await generationsService.transition(db, job.id, ['queued'], 'validating_output');
    const video = await makeVideoAsset(u);
    expect(await generationsService.complete(job.id, { videoAssetId: video, posterAssetId: null })).toBe('completed');
    expect(await generationsService.complete(job.id, { videoAssetId: video, posterAssetId: null })).toBe('already');
    const bal = await creditsService.balance(u);
    expect(bal).toMatchObject({ available: 0, held: 0 });
    const g = await db.one<{ consumed: number }>('select consumed from public.credit_grants');
    expect(g!.consumed).toBe(1);
    const film = await db.one<{ state: string }>('select state from public.films where generation_id=$1', [job.id]);
    expect(film!.state).toBe('ready');
    // a late failure cannot un-capture
    expect(await generationsService.fail(job.id, 'late')).toBe('not_eligible');
  });

  it('duplicate failure cannot refund twice', async () => {
    const u = await makeUser();
    await grant(u, 1);
    const d = await makeDraft(u);
    const { job } = await reserve(u, d.draftId);
    expect(await generationsService.fail(job.id, 'provider_rejected')).toBe('failed');
    expect(await generationsService.fail(job.id, 'provider_rejected')).toBe('already');
    const bal = await creditsService.balance(u);
    expect(bal).toMatchObject({ available: 1, held: 0 });
    const events = await db.query(`select 1 from public.credit_events where kind='release'`);
    expect(events.rowCount).toBe(1);
    const draft = await db.one<{ status: string }>('select status from public.drafts where id=$1', [d.draftId]);
    expect(draft!.status).toBe('ready');
  });

  it('held monthly credit can finish after expiry; failure after expiry issues one 7-day recovery credit', async () => {
    const u = await makeUser();
    const soon = new Date(Date.now() + 500);
    await grant(u, 2, { kind: 'monthly', expiresAt: soon });
    const a = await makeDraft(u);
    const b = await makeDraft(u);
    const j1 = (await reserve(u, a.draftId)).job;
    const j2 = (await reserve(u, b.draftId)).job;
    await new Promise((r) => setTimeout(r, 700));
    await creditsService.expireGrants();
    // success path
    await generationsService.transition(db, j1.id, ['queued'], 'validating_output');
    expect(await generationsService.complete(j1.id, { videoAssetId: await makeVideoAsset(u), posterAssetId: null })).toBe('completed');
    // failure path
    expect(await generationsService.fail(j2.id, 'provider_rejected')).toBe('failed');
    expect(await generationsService.fail(j2.id, 'provider_rejected')).toBe('already');
    const g = await db.one<{ consumed: number; expired: number; held: number; available: number }>(`select consumed, expired, held, available from public.credit_grants where kind='monthly'`);
    expect(g).toMatchObject({ consumed: 1, expired: 1, held: 0, available: 0 });
    const rec = await db.query<{ available: number }>(`select available from public.credit_grants where kind='recovery'`);
    expect(rec.rowCount).toBe(1);
    expect(rec.rows[0].available).toBe(1);
    expect((await creditsService.balance(u)).available).toBe(1);
  });
});

describe('billing fulfillment', () => {
  it('pack: duplicate checkout.session.completed grants once', async () => {
    const u = await makeUser();
    const co = await billingService.createCheckout(u, 'x@test.local', { productCode: 'pack_5' }, randomUUID());
    const sid = co.stripeSessionId;
    const a = await billingService.fulfillPack({ orderId: null, sessionId: sid, amountTotalCents: 1900, taxCents: 0, currency: 'usd', receiptUrl: null });
    const b = await billingService.fulfillPack({ orderId: null, sessionId: sid, amountTotalCents: 1900, taxCents: 0, currency: 'usd', receiptUrl: null });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect((await creditsService.balance(u)).available).toBe(5);
  });

  it('subscription: one grant per paid invoice; duplicates ignored; second subscription blocked', async () => {
    const u = await makeUser();
    await billingService.upsertSubscription({ userId: u, stripeSubscriptionId: 'sub_1', customerId: 'cus_1', planCode: 'monthly_10', status: 'active', periodStart: new Date(), periodEnd: new Date(Date.now() + 30 * 86400_000), cancelAtPeriodEnd: false });
    const end = new Date(Date.now() + 30 * 86400_000);
    await billingService.fulfillInvoice({ invoiceId: 'in_1', stripeSubscriptionId: 'sub_1', customerId: 'cus_1', planCode: 'monthly_10', amountPaidCents: 2900, periodEnd: end });
    await billingService.fulfillInvoice({ invoiceId: 'in_1', stripeSubscriptionId: 'sub_1', customerId: 'cus_1', planCode: 'monthly_10', amountPaidCents: 2900, periodEnd: end });
    expect((await creditsService.balance(u)).monthlyAvailable).toBe(10);
    // prorated / zero invoice mints nothing
    await billingService.fulfillInvoice({ invoiceId: 'in_2', stripeSubscriptionId: 'sub_1', customerId: 'cus_1', planCode: 'monthly_10', amountPaidCents: 0, periodEnd: end });
    expect((await creditsService.balance(u)).monthlyAvailable).toBe(10);
    await expect(billingService.createCheckout(u, 'x@test.local', { productCode: 'creator_25' }, randomUUID())).rejects.toMatchObject({ status: 409 });
    // cancel keeps credits; expiry sweeps at period end only
    const sub = await billingService.cancel(u);
    expect(sub.cancelAtPeriodEnd).toBe(true);
    expect((await creditsService.balance(u)).monthlyAvailable).toBe(10);
  });

  it('refund on a partially spent grant revokes only unspent credits and flags review', async () => {
    const u = await makeUser();
    const co = await billingService.createCheckout(u, 'x@test.local', { productCode: 'pack_5' }, randomUUID());
    await billingService.fulfillPack({ orderId: co.id, sessionId: co.stripeSessionId, amountTotalCents: 1900, taxCents: 0, currency: 'usd', receiptUrl: null });
    const d = await makeDraft(u);
    const { job } = await reserve(u, d.draftId);
    await generationsService.transition(db, job.id, ['queued'], 'validating_output');
    await generationsService.complete(job.id, { videoAssetId: await makeVideoAsset(u), posterAssetId: null });
    const { withTransaction } = await import('../src/server/db');
    const r = await withTransaction((tx) => billingService.applyRefund(tx, `stripe:checkout:${co.stripeSessionId}`, 'Refund'));
    expect(r).toEqual({ revoked: 4, debt: 1 });
    expect((await creditsService.balance(u)).available).toBe(0);
    const acct = await db.one<{ spending_blocked: boolean }>('select spending_blocked from public.credit_accounts where user_id=$1', [u]);
    expect(acct!.spending_blocked).toBe(true);
    await grant(u, 1);
    await expect(reserve(u, (await makeDraft(u)).draftId)).rejects.toMatchObject({ status: 403 });
  });
});
