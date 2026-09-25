import { randomInt } from 'node:crypto';
import { db, withTransaction } from '../db';
import { getEnv } from '../env';
import { HttpError } from '../errors';
import { hmacHex, safeEqual, safeReturnTo } from '@/src/domain/helpers';
import { sendMail, signInCodeEmail } from '../mail';
import { createLocalSession } from './session';
import { creditsService } from '../services/credits';

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 30;

function hashCode(challengeId: string, code: string) {
  return hmacHex(getEnv().APP_SECRET, `otp:${challengeId}:${code}`);
}

export const localAuth = {
  /** Start unified sign-in/sign-up. Never reveals whether the email exists. */
  async startOtp(emailRaw: string, returnTo: string | undefined): Promise<{ challengeId: string; resendAfterSeconds: number; demoCode?: string }> {
    const email = emailRaw.trim().toLowerCase();
    const recent = await db.one<{ n: string }>(`select count(*)::text as n from public.auth_otp_challenges where email=$1 and created_at > now() - interval '1 hour'`, [email]);
    if (Number(recent?.n ?? 0) >= 8) throw new HttpError(429, 'rate_limited', 'Too many codes requested. Try again later.', { headers: { 'Retry-After': '900' } });
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const row = await db.one<{ id: string }>(
      `insert into public.auth_otp_challenges(email, code_hash, return_to, expires_at) values ($1,'pending',$2, now() + interval '${OTP_TTL_MIN} minutes') returning id`,
      [email, safeReturnTo(returnTo)],
    );
    const id = row!.id;
    await db.query('update public.auth_otp_challenges set code_hash=$2 where id=$1', [id, hashCode(id, code)]);
    const env = getEnv();
    const delivered = await sendMail({ to: email, ...signInCodeEmail(code, OTP_TTL_MIN) });
    const demoCode = env.MAIL_DRIVER === 'console' && (!env.isProduction || env.ALLOW_DEMO_CODE) ? code : undefined;
    if (!delivered && !demoCode) throw new HttpError(503, 'mail_unavailable', 'We couldn’t send the code right now. Please try again shortly.');
    return { challengeId: id, resendAfterSeconds: RESEND_SECONDS, demoCode };
  },

  async verifyOtp(challengeId: string, code: string): Promise<{ nextPath: string; isNewUser: boolean; cookie: { name: string; value: string; expires: Date } }> {
    return withTransaction(async (tx) => {
      const ch = await tx.one<{ id: string; email: string; code_hash: string; attempts: number; expires_at: Date; consumed_at: Date | null; return_to: string | null }>(
        'select * from public.auth_otp_challenges where id=$1 for update',
        [challengeId],
      );
      if (!ch || ch.consumed_at) throw new HttpError(401, 'code_invalid', 'That code isn’t right. Check the email and try again.', { retryable: false });
      if (ch.expires_at.getTime() < Date.now()) throw new HttpError(401, 'code_expired', 'That code has expired. Request a new one.', { retryable: false });
      if (ch.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'too_many_attempts', 'Too many attempts. Request a new code.', { retryable: false });
      if (!safeEqual(ch.code_hash, hashCode(ch.id, code))) {
        await tx.query('update public.auth_otp_challenges set attempts=attempts+1 where id=$1', [ch.id]);
        throw new HttpError(401, 'code_invalid', 'That code isn’t right. Check the email and try again.', { retryable: false });
      }
      await tx.query('update public.auth_otp_challenges set consumed_at=now() where id=$1', [ch.id]);
      let user = await tx.one<{ id: string }>('select id from auth.users where email=$1', [ch.email]);
      let isNewUser = false;
      if (!user) {
        user = await tx.one<{ id: string }>('insert into auth.users(email, last_sign_in_at) values ($1, now()) returning id', [ch.email]);
        isNewUser = true;
      } else {
        await tx.query('update auth.users set last_sign_in_at=now() where id=$1', [user.id]);
      }
      const profile = await tx.one<{ onboarding_complete: boolean }>(
        `insert into public.profiles(id, email) values ($1,$2) on conflict (id) do update set email=excluded.email returning onboarding_complete`,
        [user!.id, ch.email],
      );
      await tx.query('insert into public.credit_accounts(user_id) values ($1) on conflict do nothing', [user!.id]);
      const env = getEnv();
      if (isNewUser && env.DEV_SEED_CREDITS > 0 && env.APP_MODE === 'mock' && !env.isProduction) {
        await creditsService.grant(tx, user!.id, { kind: 'adjustment', sourceKey: `dev-seed:${user!.id}`, credits: env.DEV_SEED_CREDITS, description: 'Test credits (demo mode)' });
      }
      const cookie = await createLocalSession(user!.id, tx);
      const returnTo = safeReturnTo(ch.return_to ?? undefined);
      const nextPath = isNewUser || !profile!.onboarding_complete ? `/onboarding?returnTo=${encodeURIComponent(returnTo)}` : returnTo;
      return { nextPath, isNewUser, cookie };
    });
  },
};

