'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { Alert } from '@/src/ui/icons';
import { Button, DemoBanner, Header, Shell } from '@/src/ui/primitives';
import { api, ApiFailure } from '@/src/ui/api';
import { getLocalDraft } from '@/src/ui/draft-store';

export interface VerifyProps {
  demo?: boolean;
  review?: boolean;
  challengeId: string;
  reviewCode?: string;
  reviewEmail?: string;
  reviewThumb?: string | null;
  returnTo?: string;
}

export function VerifyScreen({ demo, review, challengeId, reviewCode, reviewEmail, reviewThumb, returnTo }: VerifyProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(reviewCode ?? '');
  const [email, setEmail] = useState(reviewEmail ?? '');
  const [thumb, setThumb] = useState<string | null>(reviewThumb ?? null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [focused, setFocused] = useState(!!review);
  const [resent, setResent] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState(challengeId);

  useEffect(() => {
    if (review) return;
    try {
      setEmail(sessionStorage.getItem('again:auth-email') ?? '');
      setDemoCode(sessionStorage.getItem('again:demo-code'));
      const r = Number(sessionStorage.getItem('again:auth-resend') ?? 0);
      if (r > 0) setCooldown(r);
    } catch {
      /* ignore */
    }
    let url: string | null = null;
    getLocalDraft().then((d) => {
      if (d) {
        url = URL.createObjectURL(d.blob);
        setThumb(url);
      }
    });
    inputRef.current?.focus();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [review]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const digits = code.replace(/\D/g, '').slice(0, 6);
  const complete = digits.length === 6;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (review || !complete || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await api.auth.verify(currentChallenge, digits);
      try {
        sessionStorage.removeItem('again:demo-code');
        sessionStorage.removeItem('again:auth-resend');
      } catch {
        /* ignore */
      }
      router.replace(res.nextPath);
    } catch (ex) {
      const f = ex as ApiFailure;
      if (f.code === 'code_expired') setError('That code has expired. Request a new one below.');
      else if (f.code === 'code_invalid') setError('That code doesn’t match. Check the email and try again.');
      else if (f.status === 429) setError('Too many attempts. Please wait a minute, then request a new code.');
      else if (f.status === 404 || f.code === 'challenge_not_found') setError('This sign-in link is no longer valid. Request a new code below.');
      else setError('We couldn’t verify that code. Please try again.');
      setPending(false);
      inputRef.current?.focus();
    }
  }

  async function resend() {
    if (review || cooldown > 0 || !email) return;
    setError(null);
    try {
      const res = await api.auth.otp(email, returnTo);
      setCurrentChallenge(res.challengeId);
      setCooldown(res.resendAfterSeconds);
      setCode('');
      setResent(true);
      if (res.demoCode) {
        setDemoCode(res.demoCode);
        try {
          sessionStorage.setItem('again:demo-code', res.demoCode);
        } catch {
          /* ignore */
        }
      }
      router.replace(`/auth/verify?c=${encodeURIComponent(res.challengeId)}`);
      inputRef.current?.focus();
    } catch (ex) {
      const f = ex as ApiFailure;
      setError(f.status === 429 ? 'Please wait before requesting another code.' : 'We couldn’t send a new code right now.');
    }
  }

  useEffect(() => {
    if (complete && !review && !pending && !error) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  const activeIndex = Math.min(digits.length, 5);

  return (
    <Shell theme="white" demo={demo}>
      {demo && demoCode ? <DemoBanner text={`Demo mode — your sign-in code is ${demoCode}`} /> : null}
      <Header backHref="/auth" />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 58, fontSize: 'clamp(2.5rem, 12.8vw, 3.25rem)' }}>
          {COPY.s03.heading}
        </h1>
        <p className="lead" style={{ marginTop: 18, fontSize: 18, color: 'var(--ink)' }}>
          {COPY.s03.subPrefix}
          <strong className="fw-700">{email || 'your email'}</strong>.
        </p>

        <form onSubmit={submit} style={{ marginTop: 40 }} noValidate>
          <label htmlFor="otp" className="visually-hidden">
            6-digit code
          </label>
          <div className={`otp${error ? ' otp--error' : ''}`} onClick={() => inputRef.current?.focus()}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`otp__cell${digits[i] ? ' otp__cell--filled' : ''}${focused && i === activeIndex && !complete ? ' otp__cell--active' : ''}`}
                aria-hidden
              >
                {digits[i] ?? ''}
              </div>
            ))}
            <input
              ref={inputRef}
              id="otp"
              className="otp__input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={digits}
              onChange={(e) => {
                setError(null);
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'otp-error' : 'otp-help'}
            />
          </div>
          <p id="otp-help" className="visually-hidden">
            Enter the six digits from your email. Paste works too.
          </p>
          {error ? (
            <div className="inline-error" id="otp-error" role="alert" style={{ marginTop: 14 }}>
              <Alert />
              <span>{error}</span>
            </div>
          ) : null}
          {resent && !error ? (
            <p className="helper" role="status" style={{ marginTop: 14 }}>
              A new code is on its way.
            </p>
          ) : null}
          <Button type="submit" arrow disabled={!complete && !review} pending={pending} style={{ marginTop: 40 }}>
            {COPY.s03.cta}
          </Button>
        </form>

        <div className="row-center" style={{ marginTop: 26, gap: 30, fontSize: 17 }}>
          <button type="button" className="link" style={{ fontWeight: 400 }} onClick={resend} disabled={cooldown > 0} aria-disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : COPY.s03.resend}
          </button>
          <span aria-hidden style={{ color: 'var(--muted-2)' }}>
            |
          </span>
          <Link href="/auth" className="link" style={{ fontWeight: 400 }}>
            {COPY.s03.changeEmail}
          </Link>
        </div>

        {thumb ? (
          <div className="stack" style={{ alignItems: 'center', marginTop: 'auto', paddingTop: 56, paddingBottom: 30 }}>
            <div style={{ width: 138, height: 138, borderRadius: '50%', overflow: 'hidden', background: '#1a1f2a' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div className="display--md display" style={{ marginTop: 22, fontSize: 20, letterSpacing: '-0.02em' }}>
              {COPY.s03.waiting}
            </div>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
