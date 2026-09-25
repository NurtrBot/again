'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { formatUsd, type Product } from '@/src/domain/catalog';
import type { Subscription } from '@/src/domain/types';
import { Alert, Check } from '@/src/ui/icons';
import { Button, Header, Shell } from '@/src/ui/primitives';
import { api, ApiFailure } from '@/src/ui/api';
import { formatLongDate } from '@/src/ui/format';
import { toast } from '@/src/ui/toast';

export function ChangePlanScreen({ demo, subscription, plans }: { demo?: boolean; subscription: Subscription; plans: Product[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(subscription.scheduledPlan ?? plans.find((p) => p.code !== subscription.plan)?.code ?? plans[0].code);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = formatLongDate(subscription.currentPeriodEnd);
  const target = plans.find((p) => p.code === selected);
  const same = selected === subscription.plan && !subscription.scheduledPlan;

  async function schedule() {
    if (pending || !target || same) return;
    setPending(true);
    setError(null);
    try {
      await api.billing.change(target.code);
      toast(`Switching to ${target.name} on ${end}.`, { tone: 'cobalt' });
      router.push('/account/billing');
      router.refresh();
    } catch (ex) {
      const f = ex as ApiFailure;
      setError(f.status === 409 ? 'There is no active plan to change. Start one from Credits.' : f.message || 'We couldn’t schedule that change.');
      setPending(false);
    }
  }

  return (
    <Shell theme="white" demo={demo}>
      <Header backHref="/account/billing" />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 14 }}>
          Change plan.
        </h1>
        <p className="lead" style={{ marginTop: 10 }}>
          Changes take effect at your next renewal on {end}. Nothing is charged today and your current credits stay as they are.
        </p>
        <div className="stack gap-3" role="radiogroup" aria-label="Plan" style={{ marginTop: 22 }}>
          {plans.map((p) => (
            <button key={p.code} type="button" role="radio" aria-checked={selected === p.code} className="option option--filled" style={{ minHeight: 104 }} onClick={() => setSelected(p.code)}>
              <span className="option__radio">
                <Check />
              </span>
              <span className="option__body">
                <span className="option__title">
                  {p.name}
                  {p.code === subscription.plan ? <span className="helper" style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, letterSpacing: 0 }}> · current</span> : null}
                </span>
                <span className="option__sub" style={{ display: 'block' }}>
                  {COPY.s11.monthlySub(p.credits)}
                </span>
              </span>
              <span className="option__price">
                {formatUsd(p.amountCents, { trimZeros: true })}
                <small>{COPY.s11.perMonth}</small>
              </span>
            </button>
          ))}
        </div>
        {error ? (
          <div className="inline-error" role="alert" style={{ marginTop: 14 }}>
            <Alert />
            <span>{error}</span>
          </div>
        ) : null}
        <div style={{ marginTop: 'auto', paddingTop: 26, paddingBottom: 24 }}>
          <Button pending={pending} disabled={same} onClick={schedule}>
            {target ? `Switch to ${target.name} on ${end}` : 'Schedule change'}
          </Button>
          <p className="helper center" style={{ marginTop: 12 }}>
            Next total: {target ? `${formatUsd(target.amountCents, { trimZeros: true })}/mo` : '—'}. No proration.
          </p>
        </div>
      </div>
    </Shell>
  );
}
