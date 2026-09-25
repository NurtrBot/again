import { getEnv } from './env';
import { db } from './db';

/** Sends mail via SMTP, or records it in the local demo inbox (MAIL_DRIVER=console). */
export async function sendMail(msg: { to: string; subject: string; text: string }): Promise<boolean> {
  const env = getEnv();
  if (env.MAIL_DRIVER === 'smtp' && env.SMTP_URL) {
    try {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.createTransport(env.SMTP_URL);
      await transport.sendMail({ from: env.MAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text });
      return true;
    } catch (err) {
      console.error('[mail] smtp send failed', (err as Error).message);
      return false;
    }
  }
  console.log(`[mail:console] to=${msg.to} subject="${msg.subject}"`);
  if (env.AUTH_DRIVER === 'local') {
    await db.query('insert into public.dev_outbox_mail(to_email, subject, body) values ($1,$2,$3)', [msg.to, msg.subject, msg.text]).catch(() => {});
  }
  return true;
}
