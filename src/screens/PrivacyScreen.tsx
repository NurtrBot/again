'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/src/ui/icons';
import { Button, Header, Shell } from '@/src/ui/primitives';
import { Sheet } from '@/src/ui/sheet';
import { api, ApiFailure } from '@/src/ui/api';
import { clearLocalDrafts } from '@/src/ui/draft-store';

export function PrivacyScreen({ demo, email, hasActivePlan }: { demo?: boolean; email: string; hasActivePlan: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestDeletion() {
    if (confirm !== 'DELETE' || pending) return;
    setPending(true);
    setError(null);
    try {
      await api.account.requestDeletion('recent');
      await clearLocalDrafts();
      router.replace('/?deleted=1');
    } catch (ex) {
      const f = ex as ApiFailure;
      if (f.code === 'reauth_required' || f.status === 401) {
        setError('For safety, please sign in again and then request deletion within a few minutes.');
      } else setError(f.message || 'We couldn’t start deletion. Please contact support.');
      setPending(false);
    }
  }

  return (
    <Shell theme="white" demo={demo}>
      <Header backHref="/account" />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 14 }}>
          Privacy &amp; data.
        </h1>
        <div className="stack gap-4" style={{ marginTop: 20, fontSize: 16, lineHeight: 1.5 }}>
          <p>
            <strong>What happens to your photo.</strong> When you press Animate photo, a normalized copy of your photo is sent to our AI providers (an OpenAI model that plans
            the motion and a video model that renders it) to make your film. It is processed for that purpose only.
          </p>
          <p>
            <strong>Private means not listed.</strong> Your films and photos are only visible to you when signed in. They are stored in private storage and served through
            expiring links. “Private” does not mean the photo never leaves your device — it is processed by the providers above.
          </p>
          <p>
            <strong>Metadata.</strong> Location and camera metadata are stripped from the copy we send to providers. The original is kept privately so you can compare it with
            your film.
          </p>
          <p>
            <strong>Deleting a film</strong> removes it from My films immediately and queues the stored video and source for purge. Downloaded copies on your device are not
            affected. Spent credits are not refunded.
          </p>
          <p>
            <strong>Deleting your account</strong> stops any renewal, hides all your content, and purges your media. Payment records required for accounting and dispute
            handling are retained separately, without your photos.
          </p>
          <p className="helper">
            Full details:{' '}
            <Link href="/privacy" className="link">
              Privacy Policy
            </Link>{' '}
            ·{' '}
            <Link href="/terms" className="link">
              Terms
            </Link>
          </p>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 28, paddingBottom: 24 }}>
          <Button variant="danger-outline" onClick={() => setOpen(true)}>
            Delete my account
          </Button>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} label="Delete account">
        <div className="stack gap-3" style={{ paddingTop: 16 }}>
          <h2 className="display display--section" style={{ fontSize: 28 }}>
            Delete your account?
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.5 }}>
            This signs you out of {email}, {hasActivePlan ? 'cancels your monthly plan at the end of the current period, ' : ''}removes every film and photo, and forfeits
            remaining credits. It can’t be undone.
          </p>
          <p className="helper">Records we must keep: payment receipts and dispute history (no photos), for as long as the law requires.</p>
          <div className="field">
            <label className="field__label" htmlFor="confirm">
              Type DELETE to confirm
            </label>
            <input id="confirm" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} autoComplete="off" />
          </div>
          {error ? (
            <div className="inline-error" role="alert">
              <Alert />
              <span>{error}</span>
            </div>
          ) : null}
          <Button variant="danger-outline" disabled={confirm !== 'DELETE'} pending={pending} onClick={requestDeletion}>
            Delete account
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep my account
          </Button>
        </div>
      </Sheet>
    </Shell>
  );
}
