/* Sends one sign-in code email through the configured SMTP (MAIL_DRIVER=smtp + SMTP_URL):
 *   npx tsx scripts/test-mail.ts you@example.com
 * With no SMTP configured it uses a throwaway Ethereal inbox and prints a preview URL. */
import { loadEnv } from '../src/server/load-env';
loadEnv();
import nodemailer from 'nodemailer';
const to = process.argv[2] ?? 'test@example.com';
(async () => {
  if (process.env.MAIL_DRIVER !== 'smtp' || !process.env.SMTP_URL) {
    const acct = await nodemailer.createTestAccount();
    process.env.MAIL_DRIVER = 'smtp';
    process.env.SMTP_URL = `smtp://${encodeURIComponent(acct.user)}:${encodeURIComponent(acct.pass)}@${acct.smtp.host}:${acct.smtp.port}`;
    console.log('No SMTP configured; using a throwaway Ethereal inbox.');
  }
  const { sendMail, signInCodeEmail } = await import('../src/server/mail');
  const { getEnv } = await import('../src/server/env');
  const env = getEnv();
  const ok = await sendMail({ to, ...signInCodeEmail('482915', 10) });
  console.log(ok ? `Sent via ${new URL(env.SMTP_URL).host} from ${env.MAIL_FROM}` : 'SEND FAILED — check SMTP_URL / MAIL_FROM');
  if (env.SMTP_URL.includes('ethereal')) {
    const t = nodemailer.createTransport(env.SMTP_URL);
    const info = await t.sendMail({ from: env.MAIL_FROM, to, ...signInCodeEmail('482915', 10) });
    console.log('Preview:', nodemailer.getTestMessageUrl(info));
  }
  process.exit(ok ? 0 : 1);
})();
