'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { FAILURE_COPY, type Job } from '@/src/domain/types';
import { Alert, Check } from '@/src/ui/icons';
import { Button, Corners, CreditPill, Header, HeaderLink, Shell, ratioOf } from '@/src/ui/primitives';
import { api, ApiFailure, newIdempotencyKey } from '@/src/ui/api';

export interface ProcessingProps {
  demo?: boolean;
  review?: boolean;
  job: Job;
  draftId: string;
  credits: number;
  draftVersion?: number;
}

type StepState = 'done' | 'active' | 'todo';

/** Motion ticker: a ruler with a knob that sweeps while the film is being made. Reflects the real phase only. */
const TICK_HEIGHTS = [10, 16, 12, 22, 14, 10, 18, 26, 14, 12, 20, 10, 16, 24, 12, 18, 10, 14, 22, 12, 16, 28, 10, 14, 18, 12, 24, 10, 16, 20, 12, 14, 26, 10, 18, 12, 22, 14, 10, 16];
function MotionTicker({ phase }: { phase: 'photo' | 'motion' | 'finish' }) {
  const mode = phase === 'motion' ? 'sweep' : phase === 'finish' ? 'finish' : 'idle';
  const label = phase === 'motion' ? 'Creating motion' : phase === 'finish' ? 'Finishing your film' : 'Photo received';
  return (
    <div className={`ticker ticker--${mode}`} aria-hidden>
      <span className="viewfinder__corner viewfinder__corner--tl" />
      <span className="viewfinder__corner viewfinder__corner--tr" />
      <span className="viewfinder__corner viewfinder__corner--bl" />
      <span className="viewfinder__corner viewfinder__corner--br" />
      <div className="ticker__track">
        <div className="ticker__ticks ticker__ticks--dim">
          {TICK_HEIGHTS.map((h, i) => (
            <span key={i} style={{ ['--h' as string]: h }} />
          ))}
        </div>
        <div className="ticker__ticks ticker__ticks--lit">
          {TICK_HEIGHTS.map((h, i) => (
            <span key={i} style={{ ['--h' as string]: h }} />
          ))}
        </div>
        <span className="ticker__knob" />
      </div>
      <div className="ticker__label">
        <span>{label}</span>
        <span className="ticker__dots">
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}

function stepsFor(status: Job['status']): [StepState, StepState, StepState] {
  switch (status) {
    case 'queued':
    case 'planning':
      return ['active', 'todo', 'todo'];
    case 'submitting':
    case 'submission_unknown':
    case 'processing':
      return ['done', 'active', 'todo'];
    case 'validating_output':
      return ['done', 'done', 'active'];
    case 'ready':
      return ['done', 'done', 'done'];
    default:
      return ['done', 'todo', 'todo'];
  }
}

export function ProcessingScreen({ demo, review, job: initial, draftId, credits: initialCredits, draftVersion }: ProcessingProps) {
  const router = useRouter();
  const [job, setJob] = useState<Job>(initial);
  const [credits, setCredits] = useState(initialCredits);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(0);

  const terminal = job.status === 'ready' || job.status === 'failed' || job.status === 'abandoned';

  useEffect(() => {
    if (review || terminal) return;
    if (!started.current) started.current = Date.now();
    let delay = 2000;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') {
        timer.current = setTimeout(tick, delay);
        return;
      }
      try {
        const next = await api.generations.get(job.id);
        if (cancelled) return;
        setJob(next);
        if (next.status === 'ready') {
          router.replace(`/films/${next.filmId}`);
          return;
        }
        if (next.status === 'failed' || next.status === 'abandoned') {
          api.credits.get().then((c) => setCredits(c.available)).catch(() => {});
          return;
        }
      } catch (ex) {
        const f = ex as ApiFailure;
        if (f.status === 401) {
          router.replace(`/auth?returnTo=${encodeURIComponent(`/create/${draftId}/processing?job=${job.id}`)}`);
          return;
        }
        // Polling errors are not job failures.
      }
      if (Date.now() - started.current > 4 * 60_000) setSlow(true);
      delay = Math.min(8000, Math.round(delay * 1.4));
      timer.current = setTimeout(tick, delay);
    };
    timer.current = setTimeout(tick, delay);
    const onVis = () => {
      if (document.visibilityState === 'visible' && timer.current) {
        clearTimeout(timer.current);
        timer.current = setTimeout(tick, 200);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, review, terminal]);

  async function retry() {
    if (review || retrying) return;
    setRetrying(true);
    setError(null);
    try {
      const draft = draftVersion ? { version: draftVersion } : await api.drafts.get(draftId);
      const next = await api.generations.create(draftId, draft.version, newIdempotencyKey());
      router.replace(`/create/${draftId}/processing?job=${next.id}`);
      setJob(next);
      started.current = Date.now();
      setSlow(false);
    } catch (ex) {
      const f = ex as ApiFailure;
      if (f.status === 402) router.push(`/credits?returnTo=${encodeURIComponent(`/create/${draftId}`)}`);
      else if (f.status === 503) setError('Animation is temporarily unavailable. No credit was used.');
      else if (f.status === 429) setError('One film at a time — please wait for your current film to finish.');
      else setError('We couldn’t start again. No credit was used.');
    } finally {
      setRetrying(false);
    }
  }

  const ratio = ratioOf(job.sourceWidth, job.sourceHeight, '458/415');

  /* ---------- 18: failed ---------- */
  if (job.status === 'failed' || job.status === 'abandoned') {
    const released = job.creditState === 'released';
    return (
      <Shell theme="white" demo={demo}>
        <Header backHref="/films" end={<CreditPill credits={credits} boxed={false} />} />
        <div className="shell__body">
          <div className="viewfinder viewfinder--cobalt" style={{ marginTop: 4 }}>
            <div className="photo photo--auto" style={{ ['--ar' as string]: ratio, borderRadius: 0, maxHeight: 360 }}>
              {job.sourcePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={job.sourcePreviewUrl} alt="Your original photo" />
              ) : null}
            </div>
            <Corners />
          </div>
          <h1 className="display" style={{ marginTop: 18, fontSize: 'clamp(2.5rem, 12.8vw, 3.25rem)' }} role="alert">
            {COPY.s18.heading}
          </h1>
          <p className="lead" style={{ marginTop: 8, fontSize: 18 }}>
            {COPY.s18.sub}
          </p>
          {job.failureCode && FAILURE_COPY[job.failureCode] ? (
            <p className="helper" style={{ marginTop: 4, fontSize: 14 }}>
              {FAILURE_COPY[job.failureCode]}
            </p>
          ) : null}
          <div className={`notice${released ? '' : ' notice--pending'}`} style={{ marginTop: 16 }} role="status">
            <span className="notice__icon">{released ? <Check /> : null}</span>
            <span>{released ? COPY.s18.returned : COPY.s18.returning}</span>
          </div>
          {error ? (
            <div className="inline-error" role="alert" style={{ marginTop: 12 }}>
              <Alert />
              <span>{error}</span>
            </div>
          ) : null}
          <Button arrow style={{ marginTop: 14 }} pending={retrying} onClick={retry}>
            {COPY.s18.retry}
          </Button>
          <Button variant="outline" href="/create" style={{ marginTop: 12 }}>
            {COPY.s18.another}
          </Button>
          <p className="helper center" style={{ marginTop: 26, paddingBottom: 24, fontSize: 15 }}>
            {COPY.s18.trouble}
            <Link href={`/help?job=${job.id}`} className="link link--cobalt" style={{ fontWeight: 400 }}>
              {COPY.s18.help}
            </Link>
          </p>
        </div>
      </Shell>
    );
  }

  /* ---------- 07: creating ---------- */
  const steps = stepsFor(job.status);
  const fill = steps[2] !== 'todo' ? '100%' : steps[1] !== 'todo' ? '50%' : '0%';
  return (
    <Shell theme="cobalt" demo={demo}>
      <Header brandStart end={<HeaderLink href="/films">{COPY.nav.films}</HeaderLink>} />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 22, fontSize: 'clamp(2.5rem, 12.6vw, 3.25rem)' }}>
          {COPY.s07.heading}
        </h1>
        <div className="viewfinder viewfinder--white" style={{ marginTop: 22 }}>
          <div className="photo photo--auto" style={{ ['--ar' as string]: '350/258', borderRadius: 0 }}>
            {job.sourcePreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.sourcePreviewUrl} alt="Your original photo (not the finished film)" />
            ) : null}
          </div>
          <Corners />
        </div>

        <div style={{ marginTop: 22 }}>
          <MotionTicker phase={steps[2] !== 'todo' ? 'finish' : steps[1] !== 'todo' ? 'motion' : 'photo'} />
        </div>

        <ol className="steps" style={{ listStyle: 'none', padding: 0, margin: '26px 0 0' }} aria-label="Progress">
          <span className="steps__line" aria-hidden />
          <span className="steps__line-fill" aria-hidden style={{ width: `calc(66.8% * ${fill === '100%' ? 1 : fill === '50%' ? 0.5 : 0})` }} />
          {COPY.s07.steps.map((label, i) => (
            <li key={label} className={`step step--${steps[i]}`} aria-current={steps[i] === 'active' ? 'step' : undefined}>
              <span className="step__dot">{steps[i] === 'done' ? <Check style={{ color: 'var(--cobalt)' }} /> : null}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
        <p className="visually-hidden" aria-live="polite">
          {job.phaseLabel}
        </p>

        <div className="stack center" style={{ marginTop: 40, gap: 12 }}>
          <div style={{ color: '#fff', fontSize: 16, letterSpacing: '0.03em' }}>{COPY.s07.mayTake}</div>
          <div style={{ color: '#fff', fontSize: 14.5, letterSpacing: '0.03em', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
            {slow ? 'Still working. The animation service is taking longer than usual.\nYou can leave this page. Your film will appear in My films.' : COPY.s07.leave}
          </div>
          {slow ? (
            <Link href={`/help?job=${job.id}`} className="link" style={{ fontSize: 14, fontWeight: 400 }}>
              Need help? Reference {job.id.slice(0, 8)}
            </Link>
          ) : null}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 34, paddingBottom: 30 }}>
          <Button variant="outline" href="/films">
            {COPY.s07.cta}
          </Button>
        </div>
      </div>
    </Shell>
  );
}
