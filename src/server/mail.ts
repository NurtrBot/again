import { getEnv } from './env';
import { db } from './db';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transportCache: import('nodemailer').Transporter | null = null;

/**
 * Sends mail via SMTP (MAIL_DRIVER=smtp + SMTP_URL) or records it in the local demo inbox
 * (MAIL_DRIVER=console). Returns false only when a real send failed.
 */
export async function sendMail(msg: MailMessage): Promise<boolean> {
  const env = getEnv();
  if (env.MAIL_DRIVER === 'smtp' && env.SMTP_URL) {
    try {
      const nodemailer = await import('nodemailer');
      transportCache ??= nodemailer.createTransport(env.SMTP_URL);
      const info = await transportCache.sendMail({ from: env.MAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
      console.log(`[mail] sent to=${msg.to} id=${info.messageId}`);
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

/** Branded sign-in code email (plain text + HTML). */
export function signInCodeEmail(code: string, minutes: number): { subject: string; text: string; html: string } {
  const spaced = code.split('').join(' ');
  const subject = `${code} is your again. sign-in code`;
  const text = `Your again. sign-in code is ${code}.\nIt expires in ${minutes} minutes.\n\nIf you didn’t request this, you can ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f8;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Arial,sans-serif;color:#0c0e11;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f8;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#023bf3;padding:22px 28px;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.04em;">again.</td></tr>
<tr><td style="padding:28px 28px 8px;font-size:24px;font-weight:800;letter-spacing:-0.03em;">Your sign-in code</td></tr>
<tr><td style="padding:0 28px 18px;font-size:16px;line-height:1.5;color:#3c4148;">Enter this code to keep your moment. It expires in ${minutes} minutes.</td></tr>
<tr><td style="padding:0 28px 24px;"><div style="display:inline-block;padding:16px 22px;border-radius:12px;background:#edf2ff;color:#023bf3;font-size:34px;font-weight:800;letter-spacing:0.28em;font-family:'IBM Plex Mono',Menlo,monospace;">${spaced}</div></td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;line-height:1.5;color:#676d76;">If you didn’t request this, you can ignore this email. Nobody from again. will ever ask you for this code.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
