'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { ArrowRight, ImageGlyphFilled, Play } from '@/src/ui/icons';
import { Button, Header, HeaderLink, Shell } from '@/src/ui/primitives';
import { api } from '@/src/ui/api';
import { getLocalDraft } from '@/src/ui/draft-store';
import { toast } from '@/src/ui/toast';

export interface OnboardingProps {
  demo?: boolean;
  review?: boolean;
  returnTo: string;
  sampleSrc: string;
}

export function OnboardingScreen({ demo, review, returnTo, sampleSrc }: OnboardingProps) {
  const router = useRouter();
  const [pending, setPending] = useState<'cta' | 'skip' | null>(null);
  const [localId, setLocalId] = useState<string | null>(null);

  useEffect(() => {
    if (review) return;
    getLocalDraft().then((d) => setLocalId(d?.id ?? null));
  }, [review]);

  async function finish(kind: 'cta' | 'skip') {
    if (review) return;
    setPending(kind);
    try {
      await api.me.patch({ onboardingComplete: true });
      const fromReturn = /[?&]local=/.test(returnTo);
      const next = !fromReturn && localId ? `/create?local=${localId}` : returnTo || '/create';
      router.replace(next);
    } catch {
      toast('We couldn’t save that. Please try again.');
      setPending(null);
    }
  }

  return (
    <Shell theme="white" demo={demo}>
      <Header brandStart end={<HeaderLink onClick={() => finish('skip')}>{COPY.s04.skip}</HeaderLink>} />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 16, fontSize: 'clamp(2.5rem, 13.2vw, 3.25rem)' }}>
          {COPY.s04.heading}
        </h1>

        <div className="onboarding-preview" style={{ marginTop: 24 }}>
          <div className="onboarding-preview__thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sampleSrc} alt="" />
            <span className="onboarding-preview__glyph">
              <ImageGlyphFilled />
            </span>
          </div>
          <div className="onboarding-preview__arrow" aria-hidden>
            <ArrowRight strokeWidth={2.2} />
          </div>
          <div className="onboarding-preview__thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sampleSrc} alt="" />
            <span className="play-badge play-badge--sm" style={{ width: 38, height: 38, right: 10, bottom: 10, background: 'rgba(255,255,255,0.92)' }}>
              <Play style={{ width: 16, height: 16 }} />
            </span>
          </div>
        </div>

        <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, marginTop: 10 }}>
          {COPY.s04.steps.map((s) => (
            <li key={s.n} className="onboarding-step">
              <div className="onboarding-step__num" aria-hidden>
                {s.n}
              </div>
              <div>
                <div className="onboarding-step__title">
                  <span className="visually-hidden">Step {Number(s.n)}: </span>
                  {s.title}
                </div>
                <div className="onboarding-step__body">{s.body}</div>
              </div>
            </li>
          ))}
        </ol>
        <p className="helper center" style={{ marginTop: 14, fontSize: 15 }}>
          {COPY.s04.note}
        </p>
        <Button arrow style={{ marginTop: 12 }} pending={pending === 'cta'} disabled={pending === 'skip'} onClick={() => finish('cta')}>
          {COPY.s04.cta}
        </Button>
        <p className="helper center" style={{ marginTop: 14, paddingBottom: 20, fontSize: 15 }}>
          {COPY.s04.privacy}
        </p>
      </div>
    </Shell>
  );
}
