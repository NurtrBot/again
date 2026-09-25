'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { initialsFor } from '@/src/domain/helpers';
import type { Profile } from '@/src/domain/types';
import { Alert } from '@/src/ui/icons';
import { Button, Header, Shell } from '@/src/ui/primitives';
import { api, ApiFailure } from '@/src/ui/api';
import { toast } from '@/src/ui/toast';

export function ProfileScreen({ demo, profile }: { demo?: boolean; profile: Profile }) {
  const router = useRouter();
  const [name, setName] = useState(profile.displayName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim().slice(0, 80);
    if (!clean) {
      setError('Enter a name (1–80 characters).');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api.me.patch({ displayName: clean });
      toast('Name saved.', { tone: 'cobalt' });
      router.push('/account');
      router.refresh();
    } catch (ex) {
      setError((ex as ApiFailure).fieldErrors?.displayName ?? 'We couldn’t save that name.');
      setPending(false);
    }
  }

  return (
    <Shell theme="white" demo={demo}>
      <Header backHref="/account" />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 14 }}>
          Your profile.
        </h1>
        <div className="row-center" style={{ justifyContent: 'flex-start', gap: 16, marginTop: 22 }}>
          <span className="avatar" aria-hidden>
            {initialsFor(name, profile.email).slice(0, 1)}
          </span>
          <div className="helper" style={{ fontSize: 15 }}>
            Your initials update with your name. We never invent a photo for you.
          </div>
        </div>
        <form onSubmit={save} className="stack gap-4" style={{ marginTop: 26 }} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="displayName">
              Display name
            </label>
            <input id="displayName" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="email">
              Email
            </label>
            <input id="email" className="input" value={profile.email} readOnly aria-describedby="email-help" />
            <div className="helper" id="email-help">
              Your email is your sign-in. Changing it requires signing in again with the new address; contact support if you need help.
            </div>
          </div>
          {error ? (
            <div className="inline-error" role="alert">
              <Alert />
              <span>{error}</span>
            </div>
          ) : null}
          <Button type="submit" pending={pending}>
            Save
          </Button>
        </form>
      </div>
    </Shell>
  );
}
