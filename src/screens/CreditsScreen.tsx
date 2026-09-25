'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { formatUsd, type Product } from '@/src/domain/catalog';
import type { Subscription } from '@/src/domain/types';
import { Alert, ArrowLeft, Check } from '@/src/ui/icons';
import { BrandMark, Button, CreditPill, Shell } from '@/src/ui/primitives';
import { api, ApiFailure, newIdempotencyKey } from '@/src/ui/api';
import { toast } from '@/src/ui/toast';

export interface CreditsProps {
  demo?: boolean;
  review?: boolean;
  tab: 'packs' | 'monthly';
  products: Product[];
  credits: number;
  subscription: Subscription | null;
  returnTo?: string | null;
  draftId?: string | null;
  /** Public /pricing: catalog browse only; checkout requires sign-in. */
  signedOut?: boolean;
  paymentsEnabled?: boolean;
  selectedCode?: string;
}

export function CreditsScreen(props: CreditsProps) {
  const { demo, review, tab, products, subscription, returnTo, draftId, signedOut, paymentsEnabled = true } = props;
  const router = useRouter();
  const packs = products.filter((p) => p.mode === 'payment');
  const plans = products.filter((p) => p.mode === 'subscription');
  const [selected, setSelected] = useState<string>(props.selectedCode ?? (tab === 'packs' ? 'pack_5' : 'monthly_10'));
  const [credits, setCredits] = useState(props.credits);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string>('');
  useEffect(() => setKey(newIdempotencyKey()), [tab]);

  const product = products.find((p) => p.code === selected) ?? (tab === 'packs' ? packs[1] : plans[0]);
  const activeSub = subscription?.status === 'active' || subscription?.status === 'past_due';
  const base = `/credits${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  const tabHref = (t: 'packs' | 'monthly') => `/${signedOut ? 'pricing' : 'credits'}?tab=${t}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  void base;

  async function refresh() {
    if (review || signedOut) return;
    try {
      const c = await api.credits.get();
      setCredits(c.available);
      toast(`Balance: ${COPY.credits(c.available)}.`, { tone: 'cobalt' });
      if (c.available > 0 && returnTo) router.push(returnTo);
    } catch {
      toast('We couldn’t refresh your balance.');
    }
  }

  async function checkout() {
    if (review || pending || !product) return;
    if (signedOut) {
      router.push(`/auth?returnTo=${encodeURIComponent(`/credits?tab=${tab}`)}`);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const co = await api.billing.checkout(product.code, draftId ?? undefined, key || newIdempotencyKey());
      router.push(`/checkout/${co.id}`);
    } catch (ex) {
      const f = ex as ApiFailure;
      setKey(newIdempotencyKey());
      if (f.status === 409 && product.mode === 'subscription') setError('You already have an active plan. Manage it from your account.');
      else if (f.status === 503) setError('Payments are temporarily unavailable. Please try again soon.');
      else if (f.status === 401) router.push(`/auth?returnTo=${encodeURIComponent(`/credits?tab=${tab}`)}`);
      else setError('We couldn’t start checkout. Please try again.');
      setPending(false);
    }
  }

  const backHref = returnTo ?? (signedOut ? '/' : '/account');
  const header = (white: boolean) => (
    <header className="header">
      <div className="header__start">
        <Link href={backHref} className="icon-btn" aria-label="Back">
          <ArrowLeft />
        </Link>
      </div>
      <div className="header__center">
        <BrandMark />
      </div>
      <div className="header__end">{signedOut ? <Link href="/auth" className="credit-text">Sign in</Link> : <CreditPill credits={credits} boxed={false} href={white ? '/credits' : '/account'} />}</div>
    </header>
  );

  const tabs = (
    <div className="tabs" role="tablist" aria-label="Purchase type">
      <Link href={tabHref('packs')} role="tab" aria-selected={tab === 'packs'} className="tabs__tab">
        {COPY.s10.tabs[0]}
      </Link>
      <Link href={tabHref('monthly')} role="tab" aria-selected={tab === 'monthly'} className="tabs__tab">
        {COPY.s10.tabs[1]}
      </Link>
    </div>
  );

  /* ---------- 11: monthly ---------- */
  if (tab === 'monthly') {
    return (
      <Shell theme="white" demo={demo}>
        {header(true)}
        <div className="shell__body">
          <h1 className="display" style={{ marginTop: 14, fontSize: 'clamp(2.5rem, 13.2vw, 3.4rem)' }}>
            {COPY.s11.heading}
          </h1>
          <div style={{ marginTop: 22 }}>{tabs}</div>
          <p style={{ marginTop: 20, fontSize: 17 }}>{COPY.s11.sub}</p>
          <div className="stack gap-3" role="radiogroup" aria-label="Monthly plan" style={{ marginTop: 20 }}>
            {plans.map((p) => (
              <button key={p.code} type="button" role="radio" aria-checked={selected === p.code} className="option option--filled" style={{ minHeight: 112, padding: '20px 22px' }} onClick={() => setSelected(p.code)}>
                <span className="option__radio">
                  <Check />
                </span>
                <span className="option__body">
                  <span className="option__title" style={{ fontSize: 28 }}>
                    {p.name}
                  </span>
                  <span className="option__sub" style={{ display: 'block', fontSize: 17 }}>
                    {COPY.s11.monthlySub(p.credits)}
                  </span>
                </span>
                <span className="option__price" style={{ fontSize: 32 }}>
                  {formatUsd(p.amountCents, { trimZeros: true })}
                  <small>{COPY.s11.perMonth}</small>
                </span>
              </button>
            ))}
          </div>
          <ul className="stack" style={{ listStyle: 'none', margin: '26px 0 0', padding: 0, fontSize: 16, lineHeight: 1.6, letterSpacing: '0.01em' }}>
            {COPY.s11.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          {error ? (
            <div className="inline-error" role="alert" style={{ marginTop: 12 }}>
              <Alert />
              <span>{error}</span>
            </div>
          ) : null}
          <div style={{ marginTop: 'auto', paddingTop: 26, paddingBottom: 26 }}>
            {activeSub && !signedOut ? (
              <Button variant="outline-cobalt" arrow href="/account/billing">
                Manage your plan
              </Button>
            ) : (
              <Button pending={pending} disabled={!paymentsEnabled} onClick={checkout} style={{ fontSize: 21 }}>
                {product ? COPY.s11.cta(product.name, formatUsd(product.amountCents, { trimZeros: true })) : ''}
              </Button>
            )}
            <p className="helper center" style={{ marginTop: 12, fontSize: 14 }}>
              {paymentsEnabled ? COPY.s11.renews : 'Purchases are paused right now.'}
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------- 10: packs ---------- */
  return (
    <Shell theme="white" demo={demo}>
      <div data-theme="cobalt" style={{ background: 'var(--cobalt)', color: '#fff', ['--line' as string]: 'rgba(255,255,255,0.55)' }}>
        {header(false)}
        <div style={{ padding: '6px var(--page-gutter) 22px' }}>
          <h1 className="display" style={{ fontSize: 'clamp(2.5rem, 12.6vw, 3.25rem)' }}>
            {COPY.s10.heading}
          </h1>
        </div>
      </div>
      <div className="shell__body">
        <div style={{ marginTop: 6 }}>{tabs}</div>
        <p style={{ marginTop: 20, fontSize: 16 }}>{COPY.s10.note}</p>
        <div className="stack gap-3" role="radiogroup" aria-label="Credit pack" style={{ marginTop: 18 }}>
          {packs.map((p) => (
            <button key={p.code} type="button" role="radio" aria-checked={selected === p.code} className="option" style={{ minHeight: p.popular ? 96 : 78, padding: '14px 20px' }} onClick={() => setSelected(p.code)}>
              <span className="option__radio" />
              <span className="option__body">
                <span className="option__title">{p.name}</span>
                {p.popular ? <span className="option__badge">{COPY.s10.popular}</span> : null}
              </span>
              <span className="option__price">{formatUsd(p.amountCents, { trimZeros: p.amountCents % 100 === 0 })}</span>
            </button>
          ))}
        </div>
        <p style={{ marginTop: 22, fontSize: 16, letterSpacing: '0.01em' }}>{COPY.s10.footer}</p>
        {error ? (
          <div className="inline-error" role="alert" style={{ marginTop: 12 }}>
            <Alert />
            <span>{error}</span>
          </div>
        ) : null}
        <div style={{ marginTop: 'auto', paddingTop: 26, paddingBottom: 24 }}>
          <Button arrow pending={pending} disabled={!paymentsEnabled} onClick={checkout} style={{ fontSize: 21 }}>
            {product ? COPY.s10.cta(product.credits) : COPY.s10.cta(5)}
          </Button>
          <p className="center" style={{ marginTop: 16, fontSize: 15 }}>
            {COPY.s10.already}
            {signedOut ? (
              <Link href="/auth" className="link link--cobalt" style={{ fontWeight: 400 }}>
                Sign in
              </Link>
            ) : (
              <button type="button" className="link link--cobalt" style={{ fontWeight: 400 }} onClick={refresh}>
                {COPY.s10.refresh}
              </button>
            )}
          </p>
        </div>
      </div>
    </Shell>
  );
}
