import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

export async function runMigrations(opts: { databaseUrl: string; includeLocal: boolean; dir?: string }) {
  const dir = opts.dir ?? resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => opts.includeLocal || !f.endsWith('.local.sql'))
    .sort();
  const pool = new Pool({ connectionString: opts.databaseUrl, max: 1 });
  const applied: string[] = [];
  const client = await pool.connect();
  try {
    await client.query(
      'create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())',
    );
    await client.query('select pg_advisory_lock(7231)');
    const done = new Set((await client.query<{ name: string }>('select name from public.schema_migrations')).rows.map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = readFileSync(resolve(dir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into public.schema_migrations(name) values ($1)', [file]);
        await client.query('commit');
        applied.push(file);
      } catch (err) {
        await client.query('rollback');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
    await client.query('select pg_advisory_unlock(7231)');
  } finally {
    client.release();
    await pool.end();
  }
  return applied;
}
