'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { formatUsd } from '@/src/domain/catalog';
import type { PaymentStatus } from '@/src/domain/types';
import { Check } from '@/src/ui/icons';
import { Button, Header, Shell } from '@/src/ui/primitives';
import { api } from '@/src/ui/api';

export interface PurchaseCompleteProps {
  demo?: boolean;
  review?: boolean;
  sessionId: string;
  initial: PaymentStatus | null;
}

export function PurchaseCompleteScreen({ demo, review, sessionId, initial }: PurchaseCompleteProps) {
  const [status, setStatus] = useState<PaymentStatus | null>(initial);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (review) return;
    if (status?.status === 'fulfilled' || status?.status === 'failed') return;
    let cancelled = false;
    let delay = 1000;
    const started = Date.now();
    const tick = async () => {
      if (cancelled) return;
      try {
        const next = await api.billing.sessionStatus(sessionId);
        if (cancelled) return;
        setStatus(next);
        if (next.status === 'fulfilled' || next.status === 'failed') return;
      } catch {
        /* keep polling */
      }
      if (Date.now() - started > 60_000) {
        setTimedOut(true);
        return;
      }
      delay = Math.min(3000, delay + 500);
      setTimeout(tick, delay);
    };
    const t = setTimeout(tick, delay);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, review]);

  const fulfilled = status?.status === 'fulfilled';
  const failed = status?.status === 'failed';
  const isSub = status?.mode === 'subscription';
  const amount = status?.amountTotalCents != null ? formatUsd(status.amountTotalCents) : null;

  return (
    <Shell theme="cobalt" demo={demo}>
      <Header brandStart />
      <div className="shell__body" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className={`check-ring${fulfilled || failed ? '' : ' notice--pending'}`} style={{ marginTop: 6, borderRightColor: fulfilled || failed ? undefined : 'transparent', animation: fulfilled || failed ? undefined : 'spin 0.9s linear infinite' }} aria-hidden>
          {fulfilled ? <Check strokeWidth={1.8} /> : null}
        </div>

        {failed ? (
          <>
            <h1 className="display" style={{ marginTop: 22 }} role="alert">
              Payment didn’t go through.
            </h1>
            <p style={{ marginTop: 14, fontSize: 17 }}>No credits were added and nothing was charged. Your photo and selection are saved.</p>
            <Button variant="outline" href="/credits" arrow style={{ marginTop: 30 }}>
              Back to credits
            </Button>
          </>
        ) : !fulfilled ? (
          <>
            <h1 className="display" style={{ marginTop: 22 }} aria-live="polite">
              {COPY.s13.confirming}
            </h1>
            <p style={{ marginTop: 14, fontSize: 17, maxWidth: 320 }}>
              {timedOut
                ? 'This is taking longer than usual. Your bank may still be confirming. Credits appear automatically once the payment settles — you can safely leave this page.'
                : 'We’re waiting for the payment provider to confirm. This usually takes a few seconds.'}
            </p>
            {timedOut ? (
              <Button variant="outline" href="/account" style={{ marginTop: 30 }}>
                Go to my account
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <h1 className="display" style={{ marginTop: 12, fontSize: 'clamp(2.5rem, 13vw, 3.25rem)' }}>
              {COPY.s13.heading}
            </h1>
            <div className="big-num" style={{ marginTop: 14 }} aria-hidden>
              {status.creditsAdded}
            </div>
            <div className="display display--section" style={{ marginTop: 6, fontSize: 34, letterSpacing: '-0.035em' }}>
              <span className="visually-hidden">{status.creditsAdded} </span>
              {COPY.s13.added}
            </div>
            {amount ? (
              <div style={{ color: '#fff', marginTop: 8, fontSize: 15, letterSpacing: '0.04em' }}>
                {isSub ? COPY.s13.monthly(formatUsd(status.amountTotalCents ?? 0, { trimZeros: true })) : COPY.s13.oneTime(amount)}
              </div>
            ) : null}
            {status.draftPreviewUrl ? (
              <div className="photo" style={{ width: '100%', aspectRatio: '350/176', marginTop: 16, borderRadius: 4 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={status.draftPreviewUrl} alt="Your saved photo" />
              </div>
            ) : null}
            <div style={{ color: '#fff', marginTop: 10, fontSize: 15, letterSpacing: '0.04em' }}>
              {status.draftId ? COPY.s13.ready : 'Your credits are ready in your account.'}
            </div>
            <Button variant="primary" arrow href={status.draftId ? `/create/${status.draftId}` : '/create'} style={{ marginTop: 14 }}>
              {status.draftId ? COPY.s13.cta : COPY.s13.ctaNoDraft}
            </Button>
            {status.receiptUrl ? (
              <Link href={status.receiptUrl} className="link" style={{ marginTop: 18, fontSize: 17, fontWeight: 400 }} target="_blank" rel="noopener">
                {COPY.s13.receipt}
              </Link>
            ) : null}
            <div style={{ color: '#fff', marginTop: 'auto', paddingTop: 18, paddingBottom: 26, fontSize: 14, letterSpacing: '0.04em' }}>
              {isSub ? 'Renews monthly until canceled. Manage it in your account.' : COPY.s13.noSub}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
