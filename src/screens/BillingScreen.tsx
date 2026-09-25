'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { formatUsd, getProduct } from '@/src/domain/catalog';
import type { Credits, Subscription } from '@/src/domain/types';
import { Alert, Card, ChevronRight, Receipt } from '@/src/ui/icons';
import { Button, Header, Shell } from '@/src/ui/primitives';
import { Sheet } from '@/src/ui/sheet';
import { api, ApiFailure } from '@/src/ui/api';
import { formatShortDate } from '@/src/ui/format';
import { toast } from '@/src/ui/toast';

export interface BillingProps {
  demo?: boolean;
  review?: boolean;
  subscription: Subscription;
  credits: Credits;
  cancelOpen?: boolean;
  portalAvailable?: boolean;
}

export function BillingScreen({ demo, review, subscription: initial, credits, cancelOpen, portalAvailable = true }: BillingProps) {
  const router = useRouter();
  const [sub, setSub] = useState(initial);
  const [confirming, setConfirming] = useState(!!cancelOpen);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = sub.plan ? getProduct(sub.plan) : null;
  const active = sub.status === 'active' || sub.status === 'past_due';
  const end = formatShortDate(sub.currentPeriodEnd);

  async function portal() {
    if (review) return;
    if (!portalAvailable) {
      toast('Stripe portal is unavailable in demo mode.');
      return;
    }
    try {
      const { url } = await api.billing.portal();
      window.location.assign(url);
    } catch {
      toast('We couldn’t open billing right now.');
    }
  }

  async function cancel() {
    if (review || pending) return;
    setPending(true);
    setError(null);
    try {
      const next = await api.billing.cancel();
      setSub(next);
      setConfirming(false);
      router.replace('/account/billing');
      toast(`Cancellation scheduled. Your plan stays active until ${formatShortDate(next.currentPeriodEnd)}.`, { tone: 'cobalt' });
    } catch (ex) {
      setError((ex as ApiFailure).message || 'We couldn’t cancel right now.');
    } finally {
      setPending(false);
    }
  }

  async function resume() {
    if (review || pending) return;
    setPending(true);
    try {
      const next = await api.billing.resume();
      setSub(next);
      toast('Your plan will continue.', { tone: 'cobalt' });
    } catch {
      toast('We couldn’t resume your plan.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Shell theme="white" demo={demo}>
      <Header backHref="/account" />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 14, fontSize: 'clamp(2.5rem, 13.2vw, 3.4rem)' }}>
          {COPY.s15.heading}
        </h1>

        {active && plan ? (
          <>
            <div className="plan-card" style={{ marginTop: 18, padding: '18px 22px 20px' }}>
              <div className="plan-card__name">{plan.name}</div>
              <div className="plan-card__price">
                {formatUsd(plan.amountCents, { trimZeros: true })} <small>{COPY.s15.perMonth}</small>
              </div>
              <div className="plan-card__sub">{COPY.s15.each(plan.credits)}</div>
            </div>
            {sub.status === 'past_due' ? (
              <div className="inline-error" role="alert" style={{ marginTop: 14 }}>
                <Alert />
                <span>Your last payment didn’t go through. Update your payment method to keep monthly credits coming.</span>
              </div>
            ) : null}
            <div style={{ marginTop: 14 }}>
              <div className="kv">
                <span>{sub.cancelAtPeriodEnd ? 'Plan ends' : COPY.s15.nextPayment}</span>
                <span className="kv__v">{sub.cancelAtPeriodEnd ? end : `${formatUsd(sub.nextAmountCents ?? plan.amountCents, { trimZeros: true })} on ${end}`}</span>
              </div>
              <div className="kv">
                <span>{COPY.s15.monthlyLeft}</span>
                <span className="kv__v">
                  {sub.monthlyAvailable ?? credits.monthlyAvailable} of {sub.monthlyIssued ?? plan.credits}
                </span>
              </div>
              <div className="kv">
                <span>{COPY.s15.purchased}</span>
                <span className="kv__v">
                  {sub.purchasedAvailable ?? credits.purchasedAvailable} — {COPY.s15.noExpiry}
                </span>
              </div>
            </div>
            <p className="helper" style={{ marginTop: 12, fontSize: 15 }}>
              {sub.scheduledPlan ? `Switches to ${getProduct(sub.scheduledPlan)?.name ?? sub.scheduledPlan} on ${end}. ` : ''}
              {sub.cancelAtPeriodEnd ? `Unused monthly credits expire on ${end}.` : COPY.s15.resets(end)}
            </p>
            <Button variant="outline-cobalt" arrow href="/account/billing/change" style={{ marginTop: 16 }}>
              {COPY.s15.change}
            </Button>
            <div className="row-list" style={{ marginTop: 14 }}>
              <button type="button" className="row" onClick={portal}>
                <span className="row__icon">
                  <Card />
                </span>
                <span className="row__label">{COPY.s15.paymentMethod}</span>
                <span className="row__chevron">
                  <ChevronRight />
                </span>
              </button>
              <button type="button" className="row" onClick={portal}>
                <span className="row__icon">
                  <Receipt />
                </span>
                <span className="row__label">{COPY.s15.billingHistory}</span>
                <span className="row__chevron">
                  <ChevronRight />
                </span>
              </button>
            </div>
            <div className="center" style={{ marginTop: 22, paddingBottom: 24 }}>
              {sub.cancelAtPeriodEnd ? (
                <>
                  <button type="button" className="link link--cobalt" style={{ fontSize: 17, fontWeight: 400 }} onClick={resume} disabled={pending}>
                    Resume subscription
                  </button>
                  <p className="helper" style={{ marginTop: 10, fontSize: 15 }}>
                    Your plan is scheduled to end on {end}. Purchased credits stay in your balance.
                  </p>
                </>
              ) : (
                <>
                  <button type="button" className="link link--cobalt" style={{ fontSize: 17, fontWeight: 400 }} onClick={() => setConfirming(true)}>
                    {COPY.s15.cancel}
                  </button>
                  <p className="helper" style={{ marginTop: 10, fontSize: 15 }}>
                    {COPY.s15.cancelNote(end)}
                  </p>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="lead" style={{ marginTop: 14, fontSize: 18, color: 'var(--ink)' }}>
              You’re on credit packs. No recurring charge.
            </p>
            <div style={{ marginTop: 14 }}>
              <div className="kv">
                <span>{COPY.s15.purchased}</span>
                <span className="kv__v">
                  {credits.purchasedAvailable} — {COPY.s15.noExpiry}
                </span>
              </div>
              {sub.status === 'canceled' ? (
                <div className="kv">
                  <span>Previous plan</span>
                  <span className="kv__v">Ended</span>
                </div>
              ) : null}
            </div>
            <Button arrow href="/credits" style={{ marginTop: 24 }}>
              Buy credits
            </Button>
            <Button variant="outline-cobalt" href="/credits?tab=monthly" style={{ marginTop: 12 }}>
              See monthly plans
            </Button>
            <div className="row-list" style={{ marginTop: 22 }}>
              <button type="button" className="row" onClick={portal}>
                <span className="row__icon">
                  <Receipt />
                </span>
                <span className="row__label">Receipts</span>
                <span className="row__chevron">
                  <ChevronRight />
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      <Sheet open={confirming && active} onClose={() => setConfirming(false)} label="Cancel subscription?">
        <div className="dialog-body" style={{ marginTop: 20 }}>
          <h2 className="display display--section" style={{ fontSize: 30 }}>
            Cancel your plan?
          </h2>
          <p className="lead">Your plan stays active until {end}. Monthly credits you haven’t used expire then. Purchased credits are yours to keep.</p>
        </div>
        {error ? (
          <div className="inline-error" role="alert" style={{ marginTop: 12 }}>
            <Alert />
            <span>{error}</span>
          </div>
        ) : null}
        <Button style={{ marginTop: 22 }} onClick={() => setConfirming(false)} autoFocus>
          Keep my plan
        </Button>
        <Button variant="danger-outline" style={{ marginTop: 12 }} pending={pending} onClick={cancel}>
          Cancel at period end
        </Button>
        <p className="helper center" style={{ marginTop: 14 }}>
          <Link href="/help" className="link link--muted" style={{ fontWeight: 400 }}>
            Questions? Get help
          </Link>
        </p>
      </Sheet>
    </Shell>
  );
}
