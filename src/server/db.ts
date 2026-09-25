import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { getEnv } from './env';

export interface Db {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
  one<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null>;
}

export interface Tx extends Db {
  readonly isTransaction: true;
}

const g = globalThis as unknown as { __againPool?: Pool };

export function getPool(): Pool {
  if (!g.__againPool) {
    const env = getEnv();
    g.__againPool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      ssl: env.DATABASE_URL.includes('sslmode=require') || /supabase\.co/.test(env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
    });
    g.__againPool.on('error', (err) => console.error('[db] pool error', err.message));
  }
  return g.__againPool;
}

function wrap(client: { query: Pool['query'] } | PoolClient): Db {
  return {
    async query(sql, params) {
      const r = await client.query(sql, params as never[]);
      return { rows: r.rows, rowCount: r.rowCount ?? r.rows.length };
    },
    async one(sql, params) {
      const r = await client.query(sql, params as never[]);
      return (r.rows[0] as never) ?? null;
    },
  };
}

export const db: Db = {
  query: (sql, params) => wrap(getPool()).query(sql, params),
  one: (sql, params) => wrap(getPool()).one(sql, params),
};

export class SerializationRetry extends Error {}

/**
 * Runs fn inside a transaction. Retries transparently on serialization/deadlock
 * errors (40001/40P01) up to 3 times. fn must be idempotent within the retry.
 */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>, opts: { retries?: number } = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  for (let attempt = 0; ; attempt++) {
    const client = await getPool().connect();
    try {
      await client.query('begin');
      const tx: Tx = { ...wrap(client), isTransaction: true };
      const result = await fn(tx);
      await client.query('commit');
      return result;
    } catch (err) {
      try {
        await client.query('rollback');
      } catch {
        /* ignore */
      }
      const code = (err as { code?: string }).code;
      if ((code === '40001' || code === '40P01') && attempt < retries) continue;
      throw err;
    } finally {
      client.release();
    }
  }
}

export async function closePool() {
  if (g.__againPool) {
    await g.__againPool.end();
    g.__againPool = undefined;
  }
}
