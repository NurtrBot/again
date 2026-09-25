/* Drops every app table (and local auth schema) then re-applies migrations.
 * Refuses to run unless the database name contains "dev" or "test".
 */
import { loadEnv } from '../src/server/load-env';
loadEnv();
import { Pool } from 'pg';
import { runMigrations } from '../src/server/migrations';

const url = process.env.DATABASE_URL!;
if (!/(dev|test)/.test(new URL(url).pathname)) {
  console.error('Refusing to reset a database whose name does not contain "dev" or "test".');
  process.exit(1);
}
const pool = new Pool({ connectionString: url, max: 1 });
(async () => {
  await pool.query('drop schema public cascade; create schema public;');
  if ((process.env.AUTH_DRIVER ?? 'local') !== 'supabase') await pool.query('drop schema if exists auth cascade');
  await pool.end();
  const applied = await runMigrations({ databaseUrl: url, includeLocal: (process.env.AUTH_DRIVER ?? 'local') !== 'supabase' });
  console.log('Reset complete. Applied:', applied.join(', '));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
