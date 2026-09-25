'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from '@stripe/react-stripe-js/checkout';
import { COPY } from '@/src/domain/copy';
import { formatUsd } from '@/src/domain/catalog';
import type { Checkout } from '@/src/domain/types';
import { Alert, Apple, Calendar, Card, CheckCircle, ChevronDown, Globe, Lock } from '@/src/ui/icons';
import { Button, Header, Shell } from '@/src/ui/primitives';
import { api, ApiFailure } from '@/src/ui/api';

export interface CheckoutProps {
  demo?: boolean;
  review?: boolean;
  checkout: Checkout;
  stripePublishableKey?: string | null;
}

export function CheckoutScreen({ demo, review, checkout, stripePublishableKey }: CheckoutProps) {
  const isSub = checkout.product.mode === 'subscription';
  const total = formatUsd(checkout.amountTotalCents);
  return (
    <Shell theme="white" demo={demo}>
      <Header backHref="/credits" />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 0, fontSize: 'clamp(2.25rem, 10.8vw, 2.75rem)' }}>
          {COPY.s12.heading}
        </h1>

        <div className="summary-card" style={{ marginTop: 12 }}>
          {checkout.draftPreviewUrl ? (
            <div className="summary-card__thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={checkout.draftPreviewUrl} alt="Your saved photo" />
            </div>
          ) : (
            <div className="summary-card__thumb" style={{ background: 'var(--soft-blue)' }} aria-hidden />
          )}
          <div>
            <div className="summary-card__title">
              {checkout.draftPreviewUrl ? COPY.s12.photoSaved : 'Credits go to your account'}
              <CheckCircle />
            </div>
            <div className="summary-card__sub">{checkout.draftPreviewUrl ? COPY.s12.photoSavedSub : 'Your credits will be waiting in your account.'}</div>
          </div>
        </div>

        <div className="line-item" style={{ marginTop: 10 }}>
          <div>
            <div className="line-item__name">{isSub ? `${checkout.product.name} plan` : `${checkout.product.credits}-credit pack`}</div>
            <div className="line-item__sub">{isSub ? `${COPY.s12.monthly} · ${checkout.product.credits} credits each month` : COPY.s12.oneTime}</div>
          </div>
          <div className="line-item__price">
            {formatUsd(checkout.product.amountCents)}
            {isSub ? <span className="helper"> /mo</span> : null}
          </div>
        </div>

        {checkout.provider === 'stripe' && !review ? (
          <StripeForm checkout={checkout} publishableKey={stripePublishableKey ?? ''} />
        ) : (
          <MockForm checkout={checkout} review={!!review} total={total} />
        )}

        <div className="secure-row" style={{ marginTop: 'auto', paddingTop: 14, paddingBottom: 18 }}>
          <Lock />
          <span>{COPY.s12.secure}</span>
          <span aria-hidden>|</span>
          <Link href="/terms" className="link link--muted" style={{ fontWeight: 400 }}>
            {COPY.s12.terms}
          </Link>
          <span aria-hidden>|</span>
          <Link href="/privacy" className="link link--muted" style={{ fontWeight: 400 }}>
            {COPY.s12.privacy}
          </Link>
        </div>
      </div>
    </Shell>
  );
}

/* ---------- Mock (demo) form: no card is charged ---------- */
function MockForm({ checkout, review, total }: { checkout: Checkout; review: boolean; total: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<'success' | 'fail' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(outcome: 'success' | 'fail' | 'cancel') {
    if (review || pending) return;
    setError(null);
    setPending(outcome);
    try {
      const res = await api.billing.mockPay(checkout.id, outcome);
      if (outcome === 'fail') {
        setError('Your card was declined (simulated). Your photo and selection are still here — try another method.');
        setPending(null);
        return;
      }
      router.push(res.redirectUrl);
    } catch (ex) {
      const f = ex as ApiFailure;
      setError(f.status === 503 ? 'Payments are temporarily unavailable.' : 'We couldn’t complete the demo payment.');
      setPending(null);
    }
  }

  return (
    <div className="stack" style={{ marginTop: 16 }}>
      {review ? (
        <button type="button" className="btn btn--black" style={{ fontSize: 21, gap: 12, minHeight: 54 }} aria-label="Pay with Apple Pay (review only)">
          <Apple style={{ width: 26, height: 26 }} />
          <span>{COPY.s12.applePay}</span>
        </button>
      ) : (
        <div className="notice" style={{ minHeight: 48, fontSize: 15 }} role="note">
          Demo mode — no card is charged. Wallet buttons appear only when a real payment provider is configured.
        </div>
      )}
      <div className="rule--or" style={{ marginTop: 12, marginBottom: 8, fontSize: 14 }}>
        {COPY.s12.orCard}
      </div>
      <fieldset className="mock-card" style={{ border: 0, padding: 0, margin: 0 }} disabled aria-describedby="mock-note">
        <legend className="visually-hidden">Demo card details (not collected)</legend>
        <div className="field">
          <label className="field__label" style={{ fontSize: 16 }}>
            {COPY.s12.cardNumber}
          </label>
          <div className="input-wrap">
            <Card />
            <input className="input" placeholder="1234 5678 9012 3456" readOnly />
          </div>
        </div>
        <div className="mock-card__row">
          <div className="field">
            <label className="field__label" style={{ fontSize: 16 }}>
              {COPY.s12.expiry}
            </label>
            <div className="input-wrap">
              <Calendar />
              <input className="input" placeholder="MM / YY" readOnly />
            </div>
          </div>
          <div className="field">
            <label className="field__label" style={{ fontSize: 16 }}>
              {COPY.s12.cvc}
            </label>
            <div className="input-wrap">
              <Lock />
              <input className="input" placeholder="CVC" readOnly />
            </div>
          </div>
        </div>
        <div className="field">
          <label className="field__label" style={{ fontSize: 16 }}>
            {COPY.s12.country}
          </label>
          <div className="input-wrap select-wrap">
            <Globe />
            <input className="input" value="United States" readOnly />
            <ChevronDown className="chev" />
          </div>
        </div>
      </fieldset>
      <p id="mock-note" className="visually-hidden">
        Demo mode. These fields are placeholders; nothing is collected or charged.
      </p>

      <div className="total-row" style={{ marginTop: 14, fontSize: 16 }}>
        <span>{COPY.s12.total}</span>
        <span className="total-row__amt">{total}</span>
      </div>
      <div className="helper" style={{ fontSize: 14, marginTop: 2 }}>
        {COPY.s12.tax}
      </div>
      {error ? (
        <div className="inline-error" role="alert" style={{ marginTop: 12 }}>
          <Alert />
          <span>{error}</span>
        </div>
      ) : null}
      <Button style={{ marginTop: 12, fontSize: 22 }} pending={pending === 'success'} onClick={() => pay('success')}>
        {COPY.s12.pay(total)}
        {review ? '' : ' (demo)'}
      </Button>
      {!review ? (
        <div className="row-center" style={{ marginTop: 12, gap: 18, fontSize: 14 }}>
          <button type="button" className="link link--muted" style={{ fontWeight: 400 }} onClick={() => pay('fail')} disabled={!!pending}>
            Simulate a declined card
          </button>
          <button type="button" className="link link--muted" style={{ fontWeight: 400 }} onClick={() => pay('cancel')} disabled={!!pending}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Stripe Checkout Elements ---------- */
function StripeForm({ checkout, publishableKey }: { checkout: Checkout; publishableKey: string }) {
  const stripe = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey]);
  if (!publishableKey) {
    return (
      <div className="inline-error" role="alert" style={{ marginTop: 16 }}>
        <Alert />
        <span>Payments aren’t configured on this server yet.</span>
      </div>
    );
  }
  return (
    <CheckoutElementsProvider stripe={stripe} options={{ clientSecret: checkout.clientSecret, elementsOptions: { appearance: { theme: 'flat', variables: { colorPrimary: '#023bf3', borderRadius: '6px', fontSizeBase: '16px' } } } }}>
      <StripeInner fallbackTotal={formatUsd(checkout.amountTotalCents)} />
    </CheckoutElementsProvider>
  );
}

function StripeInner({ fallbackTotal }: { fallbackTotal: string }) {
  const state = useCheckoutElements();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (state.type === 'loading') {
    return (
      <div className="row-center" style={{ minHeight: 160 }} aria-busy>
        <span className="btn__spinner" style={{ color: 'var(--cobalt)' }} /> <span className="helper">Loading secure payment…</span>
      </div>
    );
  }
  if (state.type === 'error') {
    return (
      <div className="inline-error" role="alert" style={{ marginTop: 16 }}>
        <Alert />
        <span>{state.error.message}</span>
      </div>
    );
  }
  const co = state.checkout;
  const total = co.total?.total?.amount ?? fallbackTotal;
  const tax = co.total?.taxExclusive?.amount;

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await co.confirm();
    if (result.type === 'error') {
      setError(result.error.message);
      setPending(false);
    }
    // On success Stripe redirects to the server-configured return_url (/checkout/success?session_id=...).
  }

  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <div className="stripe-frame">
        <PaymentElement options={{ layout: 'accordion' }} />
      </div>
      <div className="total-row" style={{ marginTop: 18 }}>
        <span>{COPY.s12.total}</span>
        <span className="total-row__amt">{total}</span>
      </div>
      <div className="helper" style={{ fontSize: 15, marginTop: 4 }}>
        {tax ? `Includes ${tax} tax.` : COPY.s12.tax}
      </div>
      {error ? (
        <div className="inline-error" role="alert" style={{ marginTop: 12 }}>
          <Alert />
          <span>{error}</span>
        </div>
      ) : null}
      <Button style={{ marginTop: 14, fontSize: 23 }} pending={pending} disabled={!co.canConfirm} onClick={confirm}>
        {COPY.s12.pay(total)}
      </Button>
    </div>
  );
}
