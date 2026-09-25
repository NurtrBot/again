'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { formatUsd } from '@/src/domain/catalog';
import type { PaymentStatus } from '@/src/domain/types';
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
      <Header brandStart closeHref={fulfilled && status.draftId ? `/create/${status.draftId}` : '/create'} />
      <div className="shell__body ready">
        <div className={`ready__art${!fulfilled && !failed ? ' ready__art--pending' : ''}`} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/samples/ready-tile.png" alt="" />
          {!fulfilled && !failed ? <span className="ready__spinner" /> : null}
        </div>

        {failed ? (
          <>
            <h1 className="display ready__title" role="alert">
              Payment didn’t{'\n'}go through.
            </h1>
            <p className="ready__line">No credits were added and nothing was charged. Your photo and selection are saved.</p>
            <div className="ready__actions">
              <Button href="/credits" arrow className="ready__cta">
                Back to credits
              </Button>
            </div>
          </>
        ) : !fulfilled ? (
          <>
            <h1 className="display ready__title" aria-live="polite">
              {COPY.s13.confirming}
            </h1>
            <p className="ready__line">
              {timedOut
                ? 'This is taking longer than usual. Your bank may still be confirming. Credits appear automatically once the payment settles — you can safely leave this page.'
                : 'We’re waiting for the payment provider to confirm. This usually takes a few seconds.'}
            </p>
            {timedOut ? (
              <div className="ready__actions">
                <Button href="/account" className="ready__cta">
                  Go to my account
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <h1 className="display ready__title">{COPY.s13.heading}</h1>
            <p className="ready__added">
              {status.creditsAdded} credit{status.creditsAdded === 1 ? '' : 's'} added
            </p>
            {amount ? (
              <div className="ready__card">
                <span>{isSub ? COPY.s13.monthlyLabel : COPY.s13.oneTimeLabel}</span>
                <strong>{isSub ? `${formatUsd(status.amountTotalCents ?? 0, { trimZeros: true })}/mo` : amount}</strong>
              </div>
            ) : null}
            <p className="ready__line">{COPY.s13.tagline}</p>
            <div className="ready__actions">
              <Button href={status.draftId ? `/create/${status.draftId}` : '/create'} arrow className="ready__cta">
                {COPY.s13.cta}
              </Button>
              <Link href="/films" className="ready__films">
                {COPY.s13.myFilms}
              </Link>
              {status.receiptUrl ? (
                <Link href={status.receiptUrl} className="link ready__receipt" target="_blank" rel="noopener">
                  {COPY.s13.receipt}
                </Link>
              ) : null}
            </div>
            <div className="ready__foot">{isSub ? COPY.s13.renews : COPY.s13.noSub}</div>
          </>
        )}
      </div>
    </Shell>
  );
}
