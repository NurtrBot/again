import { db, withTransaction, type Tx } from '../db';
import type { CreditHistory, Credits } from '@/src/domain/types';

interface GrantRow {
  id: string;
  user_id: string;
  kind: 'purchase' | 'monthly' | 'recovery' | 'adjustment';
  available: number;
  held: number;
  consumed: number;
  expired: number;
  revoked: number;
  issued: number;
  expires_at: Date | null;
  created_at: Date;
}

export class InsufficientCredits extends Error {
  constructor() {
    super('INSUFFICIENT_CREDITS');
  }
}

export const creditsService = {
  async balance(userId: string): Promise<Credits> {
    const rows = (
      await db.query<GrantRow>(
        `select * from public.credit_grants where user_id=$1 and (available>0 or held>0) and (expires_at is null or expires_at>now())`,
        [userId],
      )
    ).rows;
    let available = 0,
      held = 0,
      purchased = 0,
      monthly = 0;
    let nextExpiry: Date | null = null;
    for (const g of rows) {
      available += g.available;
      held += g.held;
      if (g.expires_at) {
        monthly += g.available;
        if (g.available > 0 && (!nextExpiry || g.expires_at < nextExpiry)) nextExpiry = g.expires_at;
      } else purchased += g.available;
    }
    return { available, held, purchasedAvailable: purchased, monthlyAvailable: monthly, nextExpiryAt: nextExpiry ? nextExpiry.toISOString() : null };
  },

  /** Lock the account row (serializes all ledger changes for this user). */
  async lockAccount(tx: Tx, userId: string) {
    await tx.query('insert into public.credit_accounts(user_id) values ($1) on conflict do nothing', [userId]);
    const acct = await tx.one<{ spending_blocked: boolean }>('select spending_blocked from public.credit_accounts where user_id=$1 for update', [userId]);
    return acct!;
  },

  /** Reserve one credit from the soonest-expiring valid grant. Caller holds the account lock. */
  async hold(tx: Tx, userId: string, generationId: string): Promise<string> {
    const grant = await tx.one<GrantRow>(
      `select * from public.credit_grants where user_id=$1 and available>0 and (expires_at is null or expires_at>now())
       order by expires_at asc nulls last, created_at asc, id asc limit 1 for update`,
      [userId],
    );
    if (!grant) throw new InsufficientCredits();
    await tx.query('update public.credit_grants set available=available-1, held=held+1 where id=$1', [grant.id]);
    await tx.query(`insert into public.credit_reservations(user_id, generation_id, grant_id, status) values ($1,$2,$3,'held')`, [userId, generationId, grant.id]);
    await tx.query(
      `insert into public.credit_events(user_id, grant_id, generation_id, kind, amount, event_key, description) values ($1,$2,$3,'hold',-1,$4,'Reserved for a film')`,
      [userId, grant.id, generationId, `hold:${generationId}`],
    );
    return grant.id;
  },

  /** Settle a held reservation exactly once. Caller holds the account lock. */
  async settle(tx: Tx, userId: string, generationId: string, outcome: 'capture' | 'release'): Promise<{ changed: boolean; recoveryGrantId: string | null }> {
    const res = await tx.one<{ id: string; grant_id: string; status: string }>('select id, grant_id, status from public.credit_reservations where generation_id=$1 and user_id=$2 for update', [generationId, userId]);
    if (!res) throw new Error('RESERVATION_MISSING');
    if (res.status !== 'held') return { changed: false, recoveryGrantId: null };
    const grant = await tx.one<GrantRow>('select * from public.credit_grants where id=$1 for update', [res.grant_id]);
    if (!grant || grant.held < 1) throw new Error('INVALID_HELD_BALANCE');
    let recoveryGrantId: string | null = null;
    if (outcome === 'capture') {
      await tx.query('update public.credit_grants set held=held-1, consumed=consumed+1 where id=$1', [grant.id]);
      await tx.query(
        `insert into public.credit_events(user_id, grant_id, generation_id, kind, amount, event_key, description) values ($1,$2,$3,'capture',0,$4,'Completed film')`,
        [userId, grant.id, generationId, `capture:${generationId}`],
      );
    } else if (grant.expires_at && grant.expires_at.getTime() <= Date.now()) {
      // Monthly credit expired while held: settle as expired and issue a 7-day recovery credit so "credit returned" stays true.
      await tx.query('update public.credit_grants set held=held-1, expired=expired+1 where id=$1', [grant.id]);
      const rec = await tx.one<{ id: string }>(
        `insert into public.credit_grants(user_id, kind, source_key, description, issued, available, expires_at) values ($1,'recovery',$2,'Returned credit (7-day)',1,1,now() + interval '7 days')
         on conflict (source_key) do update set description=excluded.description returning id`,
        [userId, `recovery:${res.id}`],
      );
      recoveryGrantId = rec!.id;
      await tx.query(
        `insert into public.credit_events(user_id, grant_id, generation_id, kind, amount, event_key, description) values ($1,$2,$3,'recovery',1,$4,'Credit returned (replacement, valid 7 days)')`,
        [userId, recoveryGrantId, generationId, `recovery:${generationId}`],
      );
    } else {
      await tx.query('update public.credit_grants set held=held-1, available=available+1 where id=$1', [grant.id]);
      await tx.query(
        `insert into public.credit_events(user_id, grant_id, generation_id, kind, amount, event_key, description) values ($1,$2,$3,'release',1,$4,'Credit returned')`,
        [userId, grant.id, generationId, `release:${generationId}`],
      );
    }
    await tx.query(`update public.credit_reservations set status=$2, settled_at=now() where id=$1`, [res.id, outcome === 'capture' ? 'captured' : 'released']);
    return { changed: true, recoveryGrantId };
  },

  /** Idempotent grant keyed by business source. Returns the grant id and whether it was newly created. */
  async grant(
    tx: Tx,
    userId: string,
    input: { kind: 'purchase' | 'monthly' | 'recovery' | 'adjustment'; sourceKey: string; credits: number; description: string; expiresAt?: Date | null },
  ): Promise<{ grantId: string; created: boolean }> {
    if (input.credits < 1) throw new Error('INVALID_GRANT_AMOUNT');
    const existing = await tx.one<{ id: string }>('select id from public.credit_grants where source_key=$1', [input.sourceKey]);
    if (existing) return { grantId: existing.id, created: false };
    const row = await tx.one<{ id: string }>(
      `insert into public.credit_grants(user_id, kind, source_key, description, issued, available, expires_at) values ($1,$2,$3,$4,$5,$5,$6) returning id`,
      [userId, input.kind, input.sourceKey, input.description, input.credits, input.expiresAt ?? null],
    );
    await tx.query(
      `insert into public.credit_events(user_id, grant_id, kind, amount, event_key, description) values ($1,$2,$3,$4,$5,$6)`,
      [userId, row!.id, input.kind === 'adjustment' ? 'adjustment' : 'grant', input.credits, `grant:${input.sourceKey}`, input.description],
    );
    return { grantId: row!.id, created: true };
  },

  /** Expire unused available credits whose period ended. Held units are untouched. */
  async expireGrants(now = new Date()): Promise<number> {
    return withTransaction(async (tx) => {
      const rows = (await tx.query<GrantRow>('select * from public.credit_grants where expires_at is not null and expires_at<=$1 and available>0 for update skip locked', [now])).rows;
      for (const g of rows) {
        await tx.query('update public.credit_grants set expired=expired+available, available=0 where id=$1', [g.id]);
        await tx.query(
          `insert into public.credit_events(user_id, grant_id, kind, amount, event_key, description) values ($1,$2,'expire',$3,$4,'Monthly credits expired')
           on conflict (event_key) do nothing`,
          [g.user_id, g.id, -g.available, `expire:${g.id}:${g.expires_at!.toISOString()}`],
        );
      }
      return rows.length;
    });
  },

  /** Revoke unspent credits from a refunded/disputed source; flag review if some were consumed. */
  async revokeSource(tx: Tx, sourceKey: string, reason: string): Promise<{ revoked: number; debt: number }> {
    const g = await tx.one<GrantRow>('select * from public.credit_grants where source_key=$1 for update', [sourceKey]);
    if (!g) return { revoked: 0, debt: 0 };
    const revoked = g.available;
    const debt = g.consumed + g.held;
    if (revoked > 0) {
      await tx.query('update public.credit_grants set revoked=revoked+available, available=0 where id=$1', [g.id]);
      await tx.query(
        `insert into public.credit_events(user_id, grant_id, kind, amount, event_key, description) values ($1,$2,'revoke',$3,$4,$5) on conflict (event_key) do nothing`,
        [g.user_id, g.id, -revoked, `revoke:${sourceKey}`, reason],
      );
    }
    if (debt > 0) {
      await tx.query('update public.credit_accounts set spending_blocked=true, review_reason=$2, version=version+1 where user_id=$1', [g.user_id, `${reason}: ${debt} credit(s) already used`]);
    }
    return { revoked, debt };
  },

  async history(userId: string, cursor: string | null, limit = 30): Promise<CreditHistory> {
    const params: unknown[] = [userId, limit + 1];
    let where = '';
    if (cursor) {
      const [ts, id] = cursor.split('_');
      where = 'and (e.created_at, e.id) < ($3::timestamptz, $4::uuid)';
      params.push(new Date(Number(ts)), id);
    }
    const rows = (
      await db.query<{ id: string; kind: string; amount: number; created_at: Date; description: string; film_id: string | null }>(
        `select e.id, e.kind, e.amount, e.created_at, e.description, f.id as film_id
         from public.credit_events e left join public.films f on f.generation_id = e.generation_id
         where e.user_id=$1 ${where} order by e.created_at desc, e.id desc limit $2`,
        params,
      )
    ).rows;
    const more = rows.length > limit;
    const items = rows.slice(0, limit).map((r) => ({ id: r.id, kind: r.kind, amount: r.amount, createdAt: r.created_at.toISOString(), filmId: r.film_id, description: r.description }));
    const last = rows[limit - 1];
    return { items, nextCursor: more && last ? `${last.created_at.getTime()}_${last.id}` : null };
  },

  /** Owner/admin script helper: grant adjustment credits (never callable from the client). */
  async adminGrant(userId: string, credits: number, description: string, sourceKey: string) {
    return withTransaction(async (tx) => {
      await creditsService.lockAccount(tx, userId);
      return creditsService.grant(tx, userId, { kind: 'adjustment', sourceKey, credits, description });
    });
  },
};
