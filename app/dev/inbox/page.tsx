import { notFound } from 'next/navigation';
import { getEnv } from '@/src/server/env';
import { db } from '@/src/server/db';

export const dynamic = 'force-dynamic';

/** Demo inbox: shows sign-in codes when MAIL_DRIVER=console. Dev/staging only. */
export default async function DevInbox() {
  const env = getEnv();
  if (!env.reviewRoutesEnabled || env.AUTH_DRIVER !== 'local') notFound();
  const rows = (await db.query<{ id: string; to_email: string; subject: string; body: string; created_at: Date }>('select * from public.dev_outbox_mail order by created_at desc limit 30')).rows;
  return (
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1 className="display display--section">Demo inbox</h1>
      <p className="helper" style={{ marginTop: 8 }}>
        Emails the app would have sent. Sign-in codes appear here in demo mode.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 24, display: 'grid', gap: 16 }}>
        {rows.map((r) => (
          <li key={r.id} style={{ border: '1.5px solid var(--line)', borderRadius: 6, padding: 16 }}>
            <div className="helper">
              {r.created_at.toLocaleString()} · to {r.to_email}
            </div>
            <div className="fw-700" style={{ marginTop: 6 }}>
              {r.subject}
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 14, marginTop: 8 }}>{r.body}</pre>
          </li>
        ))}
        {!rows.length ? <li className="helper">No mail yet.</li> : null}
      </ul>
    </main>
  );
}
