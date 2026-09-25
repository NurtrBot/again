import { notFound } from 'next/navigation';
import { getEnv } from '@/src/server/env';
import { REVIEW_NAMES } from '@/src/screens/review-map';
import bounds from '@/e2e/panel-bounds.json';

export const dynamic = 'force-dynamic';

/** Contact sheet: reference crop next to the live review route, both at 390px. */
export default function ReviewSheet() {
  if (!getEnv().reviewRoutesEnabled) notFound();
  const entries = Object.entries(bounds as Record<string, { cssH: number }>);
  return (
    <main style={{ padding: 24, fontFamily: 'var(--font-body)', background: 'var(--canvas)' }}>
      <h1 className="display display--section">21-screen contact sheet</h1>
      <p className="helper" style={{ marginTop: 6 }}>
        Left: reference panel from the approved boards. Right: live /review route. Both 390 CSS px wide.
      </p>
      <div style={{ display: 'grid', gap: 32, marginTop: 24 }}>
        {entries.map(([id, b]) => (
          <section key={id}>
            <h2 className="mono" style={{ marginBottom: 8 }}>
              {id} / {REVIEW_NAMES[id]}
            </h2>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/review-reference/${id}.png`} alt={`Reference ${id}`} width={390} height={b.cssH} style={{ flex: 'none', border: '1px solid var(--line)' }} />
              <iframe src={`/review/${id}`} title={`Review ${id}`} width={390} height={b.cssH} style={{ flex: 'none', border: '1px solid var(--line)', background: '#fff' }} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
