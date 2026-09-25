'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { UPLOAD_ERROR_COPY } from '@/src/domain/types';
import { Play, Plus, Close } from '@/src/ui/icons';
import { Header, Shell } from '@/src/ui/primitives';
import { newDraftId, saveLocalDraft } from '@/src/ui/draft-store';
import { validateLocally } from '@/src/ui/upload-client';
import { toast } from '@/src/ui/toast';

export interface WelcomeProps {
  demo?: boolean;
  review?: boolean;
  signedIn?: boolean;
  sampleSrc: string;
  sampleVideo: string | null;
}

export function WelcomeScreen({ demo, review, signedIn, sampleSrc, sampleVideo }: WelcomeProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || review) return;
    const check = validateLocally(file);
    if (!check.ok) {
      const c = UPLOAD_ERROR_COPY[check.code];
      toast(`${c.title} ${c.body}`);
      return;
    }
    setBusy(true);
    const id = newDraftId();
    const saved = await saveLocalDraft({ id, blob: file, filename: file.name, type: check.contentType, createdAt: Date.now() });
    if (!saved.persisted) toast('Private browsing may not keep your photo. You might need to choose it again after sign-in.');
    const next = `/create?local=${id}`;
    router.push(signedIn ? next : `/auth?returnTo=${encodeURIComponent(next)}`);
  }

  return (
    <Shell theme="cobalt" demo={demo} className="welcome-shell">
      <Header
        brandStart
        end={
          <Link href={signedIn ? '/films' : '/auth'} className="header-link">
            {signedIn ? COPY.nav.films : COPY.s01.signIn}
          </Link>
        }
      />
      <div className="shell__body welcome">
        <h1 className="display welcome__title">{COPY.s01.heading}</h1>
        <p className="welcome__sub">{COPY.s01.sub}</p>

        <div className="welcome__card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sampleSrc} alt="Example: the first frame of a film made with again." />
          {sampleVideo ? (
            <button type="button" className="welcome__watch" onClick={() => setPlaying(true)}>
              <Play />
              <span>{COPY.s01.watch}</span>
            </button>
          ) : null}
        </div>

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif" className="visually-hidden" onChange={onFile} tabIndex={-1} aria-hidden />
        <button type="button" className="welcome__cta" aria-busy={busy || undefined} onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <span className="btn__spinner" /> : <Plus strokeWidth={2.2} />}
          <span>{COPY.s01.cta}</span>
        </button>
        <p className="welcome__pick">{COPY.s01.pick}</p>

        <div className="welcome__links">
          <Link href="/help" className="link">
            {COPY.s01.howItWorks}
          </Link>
          <Link href="/pricing" className="link">
            {COPY.s01.pricing}
          </Link>
        </div>
      </div>

      {playing && sampleVideo ? (
        <div className="scrim" role="dialog" aria-modal="true" aria-label="Example film" onClick={() => setPlaying(false)} style={{ background: 'rgba(12, 14, 17, 0.86)' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="example-panel" onClick={(e) => e.stopPropagation()}>
              <div className="example-panel__head">
                <span>Example · Evening at home · made with again.</span>
                <button type="button" className="icon-btn" aria-label="Close" onClick={() => setPlaying(false)}>
                  <Close />
                </button>
              </div>
              <video src={sampleVideo} controls autoPlay loop playsInline />
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
