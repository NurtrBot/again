'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { CreditEntry, Credits } from '@/src/domain/types';
import { Button, Header, Shell } from '@/src/ui/primitives';
import { api } from '@/src/ui/api';
import { formatLongDate } from '@/src/ui/format';
import { toast } from '@/src/ui/toast';

const KIND_LABEL: Record<string, string> = {
  grant: 'Credits added',
  hold: 'Reserved for a film',
  capture: 'Completed film',
  release: 'Returned (film didn’t finish)',
  expire: 'Expired',
  revoke: 'Removed',
  recovery: 'Replacement credit',
  adjustment: 'Adjustment',
};

export function CreditHistoryScreen({ demo, credits, items: initial, nextCursor: initialCursor }: { demo?: boolean; credits: Credits; items: CreditEntry[]; nextCursor: string | null }) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  async function more() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const page = await api.credits.history(cursor);
      setItems((x) => [...x, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      toast('We couldn’t load more history.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell theme="white" demo={demo}>
      <Header backHref="/account" />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 14 }}>
          Credit history.
        </h1>
        <div style={{ marginTop: 18 }}>
          <div className="kv">
            <span>Available</span>
            <span className="kv__v">{credits.available}</span>
          </div>
          <div className="kv">
            <span>Reserved for films in progress</span>
            <span className="kv__v">{credits.held}</span>
          </div>
          <div className="kv">
            <span>Purchased (never expire)</span>
            <span className="kv__v">{credits.purchasedAvailable}</span>
          </div>
          <div className="kv">
            <span>Monthly</span>
            <span className="kv__v">
              {credits.monthlyAvailable}
              {credits.nextExpiryAt ? <span className="helper"> · expire {formatLongDate(credits.nextExpiryAt)}</span> : null}
            </span>
          </div>
        </div>
        <p className="helper" style={{ marginTop: 12 }}>
          Credits are separate from receipts. For payments, see{' '}
          <Link href="/account/billing" className="link">
            Plans &amp; billing
          </Link>
          .
        </p>
        <h2 className="display display--md" style={{ marginTop: 28 }}>
          Activity
        </h2>
        {items.length === 0 ? (
          <p className="helper" style={{ marginTop: 10 }}>
            No credit activity yet.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
            {items.map((e) => (
              <li key={e.id} className="kv" style={{ alignItems: 'flex-start' }}>
                <span>
                  <span style={{ display: 'block', fontWeight: 500 }}>{KIND_LABEL[e.kind] ?? e.kind}</span>
                  <span className="helper" style={{ display: 'block' }}>
                    {e.description}
                    {e.filmId ? (
                      <>
                        {' · '}
                        <Link href={`/films/${e.filmId}`} className="link">
                          film
                        </Link>
                      </>
                    ) : null}
                  </span>
                  <span className="helper" style={{ display: 'block', fontSize: 13 }}>
                    {formatLongDate(e.createdAt)}
                  </span>
                </span>
                <span className="kv__v" style={{ color: e.amount > 0 ? 'var(--cobalt)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {e.amount > 0 ? `+${e.amount}` : e.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
        {cursor ? (
          <Button variant="outline" size="sm" onClick={more} pending={loading} style={{ marginTop: 16, marginBottom: 24 }}>
            Load more
          </Button>
        ) : (
          <div style={{ height: 24 }} />
        )}
      </div>
    </Shell>
  );
}
