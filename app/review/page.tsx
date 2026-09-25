import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEnv } from '@/src/server/env';
import { REVIEW_IDS, REVIEW_NAMES } from '@/src/screens/review-map';

export const dynamic = 'force-dynamic';

export default function ReviewIndex() {
  if (!getEnv().reviewRoutesEnabled) notFound();
  return (
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto', fontFamily: 'var(--font-body)' }}>
      <h1 className="display--section display">Review routes</h1>
      <p className="helper" style={{ marginTop: 8 }}>
        Deterministic fixture renders of all 21 states. Development/staging only; no network or provider calls.
      </p>
      <ol style={{ marginTop: 24, paddingLeft: 24, lineHeight: 2 }}>
        {REVIEW_IDS.map((id) => (
          <li key={id}>
            <Link href={`/review/${id}`} className="link link--cobalt">
              {id} — {REVIEW_NAMES[id]}
            </Link>
          </li>
        ))}
      </ol>
      <p className="helper" style={{ marginTop: 24 }}>
        Contact sheet: <Link href="/review/sheet" className="link link--cobalt">/review/sheet</Link>
      </p>
    </main>
  );
}
