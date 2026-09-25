'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CreditEntry, Credits } from '@/src/domain/types';
import { ChevronRight, FilmIcon, Plus, Receipt, Minus } from '@/src/ui/icons';
import { Header, Shell } from '@/src/ui/primitives';
import { api } from '@/src/ui/api';
import { formatLongDate } from '@/src/ui/format';
import { toast } from '@/src/ui/toast';

interface Row {
  id: string;
  title: string;
  sub: string | null;
  filmId: string | null;
  amount: number;
  icon: 'film' | 'plus' | 'minus';
  date: string;
}

/** Turns raw ledger events into customer-facing rows (hold rows are folded into their completion). */
function toRows(items: CreditEntry[]): Row[] {
  const settled = new Set(items.filter((e) => e.kind === 'capture' && e.filmId).map((e) => e.filmId));
  const rows: Row[] = [];
  for (const e of items) {
    const date = e.createdAt;
    switch (e.kind) {
      case 'grant':
      case 'adjustment': {
        const m = /Bought (\d+) credit/.exec(e.description);
        const sub = m ? `${m[1]}-credit pack` : /plan/i.test(e.description) ? 'Monthly plan' : e.description;
        rows.push({ id: e.id, title: 'Credits added', sub, filmId: null, amount: e.amount, icon: 'plus', date });
        break;
      }
      case 'hold':
        if (e.filmId && settled.has(e.filmId)) break; // shown as "Film completed"
        rows.push({ id: e.id, title: 'Film in progress', sub: null, filmId: e.filmId, amount: -1, icon: 'film', date });
        break;
      case 'capture':
        rows.push({ id: e.id, title: 'Film completed', sub: null, filmId: e.filmId, amount: -1, icon: 'film', date });
        break;
      case 'release':
        rows.push({ id: e.id, title: 'Credit returned', sub: 'Film didn’t finish', filmId: e.filmId, amount: 1, icon: 'plus', date });
        break;
      case 'recovery':
        rows.push({ id: e.id, title: 'Credit returned', sub: 'Replacement, valid 7 days', filmId: e.filmId, amount: 1, icon: 'plus', date });
        break;
      case 'expire':
        rows.push({ id: e.id, title: 'Monthly credits expired', sub: null, filmId: null, amount: e.amount, icon: 'minus', date });
        break;
      case 'revoke':
        rows.push({ id: e.id, title: 'Credits removed', sub: e.description, filmId: null, amount: e.amount, icon: 'minus', date });
        break;
      default:
        rows.push({ id: e.id, title: e.description, sub: null, filmId: e.filmId, amount: e.amount, icon: e.amount >= 0 ? 'plus' : 'minus', date });
    }
  }
  return rows;
}

export function CreditHistoryScreen({ demo, credits, items: initial, nextCursor: initialCursor }: { demo?: boolean; credits: Credits; items: CreditEntry[]; nextCursor: string | null }) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(() => toRows(items), [items]);
  const visible = expanded ? rows : rows.slice(0, 6);
  const groups = useMemo(() => {
    const out: Array<{ date: string; rows: Row[] }> = [];
    for (const r of visible) {
      const d = formatLongDate(r.date);
      const last = out[out.length - 1];
      if (last && last.date === d) last.rows.push(r);
      else out.push({ date: d, rows: [r] });
    }
    return out;
  }, [visible]);

  async function viewAll() {
    setExpanded(true);
    let next = cursor;
    let guard = 0;
    setLoading(true);
    try {
      while (next && guard++ < 10) {
        const page = await api.credits.history(next);
        setItems((x) => [...x, ...page.items]);
        next = page.nextCursor;
      }
      setCursor(next);
    } catch {
      toast('We couldn’t load more history.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell theme="white" demo={demo} className="credits-shell">
      <Header
        backHref="/account"
        center={
          <Link href="/" className="brand" aria-label="again. home">
            again<span className="text-cobalt">.</span>
          </Link>
        }
      />
      <div className="shell__body">
        <h1 className="display credits__title">
          Your credits<span className="text-cobalt">.</span>
        </h1>

        <section className="credits-hero" aria-label="Available credits">
          <div className="credits-hero__top">
            <div>
              <div className="credits-hero__label">Available credits</div>
              <div className="credits-hero__num">{credits.available}</div>
            </div>
            <FilmIcon className="credits-hero__icon" />
          </div>
          <Link href="/credits" className="credits-hero__cta">
            <span>Add credits</span>
            <Plus />
          </Link>
        </section>

        <div className="credits-breakdown">
          <div className="credits-breakdown__row">
            <div>
              <div className="credits-breakdown__k">Purchased</div>
              <div className="credits-breakdown__sub">Never expire</div>
            </div>
            <div className="credits-breakdown__v">{credits.purchasedAvailable}</div>
          </div>
          <div className="credits-breakdown__row">
            <div>
              <div className="credits-breakdown__k">Monthly</div>
              {credits.nextExpiryAt && credits.monthlyAvailable > 0 ? <div className="credits-breakdown__sub">Reset {formatLongDate(credits.nextExpiryAt)}</div> : null}
            </div>
            <div className="credits-breakdown__v">{credits.monthlyAvailable}</div>
          </div>
          <div className="credits-breakdown__row">
            <div className="credits-breakdown__k">Reserved for films</div>
            <div className="credits-breakdown__v">{credits.held}</div>
          </div>
        </div>

        <div className="credits-activity__head">
          <h2 className="display credits-activity__title">Activity</h2>
          {!expanded && (rows.length > 6 || cursor) ? (
            <button type="button" className="credits-activity__all" onClick={viewAll} aria-busy={loading || undefined}>
              View all
            </button>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <p className="helper" style={{ marginTop: 10 }}>
            No credit activity yet.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.date} className="credits-group">
              <div className="credits-group__date">{g.date}</div>
              <ul className="credits-list">
                {g.rows.map((r) => (
                  <li key={r.id} className="credits-row">
                    <span className={`credits-row__icon credits-row__icon--${r.icon}`} aria-hidden>
                      {r.icon === 'film' ? <FilmIcon /> : r.icon === 'plus' ? <Plus /> : <Minus />}
                    </span>
                    <span className="credits-row__body">
                      <span className="credits-row__title">{r.title}</span>
                      {r.filmId ? (
                        <Link href={`/films/${r.filmId}`} className="credits-row__link">
                          View film
                        </Link>
                      ) : r.sub ? (
                        <span className="credits-row__sub">{r.sub}</span>
                      ) : null}
                    </span>
                    <span className={`credits-row__amt${r.amount > 0 ? ' credits-row__amt--plus' : ''}`}>{r.amount > 0 ? `+${r.amount}` : `−${Math.abs(r.amount)}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {expanded && loading ? (
          <p className="helper" style={{ marginTop: 10 }}>
            Loading…
          </p>
        ) : null}

        <Link href="/account/billing" className="credits-billing">
          <Receipt />
          <span>Plans &amp; billing</span>
          <ChevronRight />
        </Link>
        <p className="credits-billing__sub">Manage payments and view receipts.</p>
      </div>
    </Shell>
  );
}
