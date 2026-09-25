/* Owner/admin tool: grant test or goodwill credits to an account by email.
 * Usage: npm run credits:grant -- you@example.com 10 ["reason"]
 * Never callable from the client. Creates an 'adjustment' grant with a unique source key. */
import { loadEnv } from '../src/server/load-env';
loadEnv();
import { randomUUID } from 'node:crypto';
import { db, closePool } from '../src/server/db';
import { creditsService } from '../src/server/services/credits';

const [email, amountArg, ...reasonParts] = process.argv.slice(2);
const amount = Number.parseInt(amountArg ?? '', 10);
if (!email || !Number.isFinite(amount) || amount < 1 || amount > 500) {
  console.error('Usage: npm run credits:grant -- <email> <credits 1-500> [reason]');
  process.exit(1);
}
const reason = reasonParts.join(' ') || 'Test credits (granted by owner)';
(async () => {
  const user = await db.one<{ id: string }>('select id from public.profiles where lower(email)=lower($1)', [email]);
  if (!user) {
    console.error(`No account with email ${email}. Sign in once in the app first, then run this again.`);
    process.exit(2);
  }
  const r = await creditsService.adminGrant(user.id, amount, reason, `admin:${randomUUID()}`);
  const bal = await creditsService.balance(user.id);
  console.log(`Granted ${amount} credit(s) to ${email} (grant ${r.grantId}). Available now: ${bal.available}`);
  await closePool();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
