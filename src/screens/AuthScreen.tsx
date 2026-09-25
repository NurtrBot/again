'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { Alert, Apple, Google, Mail } from '@/src/ui/icons';
import { Button, Header, Shell } from '@/src/ui/primitives';
import { api, ApiFailure } from '@/src/ui/api';
import { getLocalDraft } from '@/src/ui/draft-store';

export interface AuthProps {
  demo?: boolean;
  review?: boolean;
  oauthProviders: Array<'apple' | 'google'>;
  returnTo: string;
  /** Review only: show a retained draft thumbnail without IndexedDB. */
  reviewThumb?: string | null;
  /** Local draft id from ?returnTo=/create?local=... (resolved by the page). */
  localDraftId?: string | null;
  error?: string | null;
}

export function AuthScreen({ demo, review, oauthProviders, returnTo, reviewThumb, localDraftId, error }: AuthProps) {
  const router = useRouter();
  const [thumb, setThumb] = useState<string | null>(reviewThumb ?? null);
  const [email, setEmail] = useState(review ? 'you@example.com' : '');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(error ?? null);

  useEffect(() => {
    if (review) return;
    let url: string | null = null;
    getLocalDraft(localDraftId ?? undefined).then((d) => {
      if (d) {
        url = URL.createObjectURL(d.blob);
        setThumb(url);
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [review, localDraftId]);

  useEffect(() => {
    if (review) return;
    // sessionStorage is an external store; read it asynchronously to avoid a synchronous setState in the effect body.
    const t = setTimeout(() => {
      try {
        const saved = sessionStorage.getItem('again:auth-email');
        if (saved) setEmail(saved);
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [review]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (review) return;
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setErr('Enter a valid email address.');
      return;
    }
    setErr(null);
    setPending(true);
    try {
      const res = await api.auth.otp(value, returnTo);
      try {
        sessionStorage.setItem('again:auth-email', value);
        if (res.demoCode) sessionStorage.setItem('again:demo-code', res.demoCode);
        else sessionStorage.removeItem('again:demo-code');
        sessionStorage.setItem('again:auth-resend', String(res.resendAfterSeconds));
      } catch {
        /* ignore */
      }
      router.push(`/auth/verify?c=${encodeURIComponent(res.challengeId)}`);
    } catch (ex) {
      const f = ex as ApiFailure;
      if (f.status === 429) setErr('Too many attempts. Please wait a minute and try again.');
      else if (f.status === 503) setErr('Sign-in is temporarily unavailable. Please try again shortly.');
      else setErr(f.fieldErrors?.email ?? 'We couldn’t send a code. Check the address and try again.');
      setPending(false);
    }
  }

  async function oauth(provider: 'apple' | 'google') {
    if (review) return;
    setPending(true);
    try {
      const { url } = await api.auth.oauth(provider, returnTo);
      window.location.assign(url);
    } catch {
      setErr(`${provider === 'apple' ? 'Apple' : 'Google'} sign-in isn’t available right now.`);
      setPending(false);
    }
  }

  void thumb;
  return (
    <Shell theme="white" demo={demo} className="auth-shell">
      <Header
        backHref="/"
        center={
          <Link href="/" className="brand" aria-label="again. home">
            again<span className="text-cobalt">.</span>
          </Link>
        }
      />
      <div className="shell__body">
        <div className="auth__collage" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/samples/auth-collage.jpg" alt="" />
        </div>
        <h1 className="display auth__title">{COPY.s02.heading}</h1>
        <p className="auth__sub">{COPY.s02.sub}</p>

        <form onSubmit={submit} className="stack auth__form" noValidate>
          {oauthProviders.includes('apple') ? (
            <Button variant="black" type="button" icon={<Apple />} onClick={() => oauth('apple')} disabled={pending} style={{ fontSize: 19 }}>
              {COPY.s02.apple}
            </Button>
          ) : null}
          {oauthProviders.includes('google') ? (
            <Button variant="white-outline" type="button" icon={<Google />} onClick={() => oauth('google')} disabled={pending} style={{ marginTop: 12, fontSize: 19, borderColor: 'var(--muted-2)', borderWidth: 1.5 }}>
              {COPY.s02.google}
            </Button>
          ) : null}
          {oauthProviders.length ? (
            <div className="rule--or" style={{ marginTop: 22, marginBottom: 16 }}>
              {COPY.s02.or}
            </div>
          ) : null}
          <label className="auth__label" htmlFor="email">
            {COPY.s02.emailLabel}
          </label>
          <div className="auth__input">
            <Mail />
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={COPY.s02.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? 'email-error' : undefined}
              required
            />
          </div>
          {err ? (
            <div className="inline-error" id="email-error" role="alert" style={{ marginTop: 10 }}>
              <Alert />
              <span>{err}</span>
            </div>
          ) : null}
          <Button type="submit" arrow pending={pending} className="auth__cta">
            {COPY.s02.cta}
          </Button>
        </form>
        <p className="auth__new">{COPY.s02.newHere}</p>
        <p className="auth__legal">
          {COPY.s02.legalPrefix}
          <br />
          <Link href="/terms" className="link">
            {COPY.s02.terms}
          </Link>
          {COPY.s02.and}
          <Link href="/privacy" className="link">
            {COPY.s02.privacy}
          </Link>
          .
        </p>
      </div>
    </Shell>
  );
}
