/* Applies supabase/migrations/*.sql in filename order, once each.
 * Files ending in `.local.sql` are skipped when AUTH_DRIVER=supabase.
 * Usage: npm run db:migrate            (uses DATABASE_URL)
 *        DATABASE_URL=... npm run db:migrate
 */
import { loadEnv } from '../src/server/load-env';
loadEnv();
import { runMigrations } from '../src/server/migrations';

runMigrations({
  databaseUrl: process.env.DATABASE_URL!,
  includeLocal: (process.env.AUTH_DRIVER ?? 'local') !== 'supabase',
})
  .then((applied) => {
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
