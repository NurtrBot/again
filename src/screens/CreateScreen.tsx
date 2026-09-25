'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { UPLOAD_ERROR_COPY } from '@/src/domain/types';
import { Alert, ImageGlyph, ImageGlyphFilled, Info, Play, Plus } from '@/src/ui/icons';
import { Button, Corners, CreditPill, Header, Shell } from '@/src/ui/primitives';
import { api, ApiFailure } from '@/src/ui/api';
import { deleteLocalDraft, getLocalDraft } from '@/src/ui/draft-store';
import { uploadPhoto, validateLocally, type UploadProgress } from '@/src/ui/upload-client';
import { ExampleOverlay } from '@/src/ui/example-overlay';

export interface CreateProps {
  demo?: boolean;
  review?: boolean;
  credits: number;
  samples: Array<{ src: string; video: string; label: string; real?: boolean }>;
  /** Local (pre-auth) draft id to claim on mount. */
  localDraftId?: string | null;
  /** Error variant (screen 17). */
  error?: string | null;
  errorFilename?: string | null;
  /** Focus the shutter on arrival (from empty gallery). */
  pick?: boolean;
  heicSupported?: boolean;
}

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreateScreen(props: CreateProps) {
  const { demo, review, credits, samples, localDraftId, error, errorFilename, pick, heicSupported = true } = props;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const shutterRef = useRef<HTMLButtonElement>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [claiming, setClaiming] = useState(!!localDraftId && !review);
  const [example, setExample] = useState<{ video: string; label: string } | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run(blob: Blob, filename: string, contentType: string, fromLocalId?: string) {
    setInlineError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const media = await uploadPhoto(blob, filename, contentType, setProgress, ac.signal);
      const draft = await api.drafts.create(media.id);
      if (fromLocalId) await deleteLocalDraft(fromLocalId);
      router.replace(`/create/${draft.id}`);
    } catch (ex) {
      if ((ex as DOMException)?.name === 'AbortError') return;
      const f = ex as ApiFailure;
      const code = f.code && UPLOAD_ERROR_COPY[f.code] ? f.code : f.status === 0 || f.code === 'upload_interrupted' ? 'upload_interrupted' : f.status === 422 ? 'unreadable' : null;
      setProgress(null);
      if (code) {
        if (fromLocalId && code !== 'upload_interrupted') await deleteLocalDraft(fromLocalId);
        router.replace(`/create?error=${code}&name=${encodeURIComponent(filename)}`);
      } else if (f.status === 401) {
        router.replace(`/auth?returnTo=${encodeURIComponent(fromLocalId ? `/create?local=${fromLocalId}` : '/create')}`);
      } else {
        setInlineError(f.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setClaiming(false);
    }
  }

  useEffect(() => {
    if (review || !localDraftId) return;
    let cancelled = false;
    (async () => {
      const d = await getLocalDraft(localDraftId);
      if (cancelled) return;
      if (!d) {
        setClaiming(false);
        setInlineError('We couldn’t find the photo you chose earlier. Please choose it again.');
        router.replace('/create');
        return;
      }
      await run(d.blob, d.filename, d.type, d.id);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDraftId, review]);

  useEffect(() => {
    if (pick && !review) shutterRef.current?.focus();
  }, [pick, review]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || review) return;
    const check = validateLocally(file);
    if (!check.ok) {
      router.replace(`/create?error=${check.code}&name=${encodeURIComponent(file.name)}`);
      return;
    }
    if (!heicSupported && (check.contentType === 'image/heic' || check.contentType === 'image/heif')) {
      router.replace(`/create?error=heic_unsupported&name=${encodeURIComponent(file.name)}`);
      return;
    }
    void run(file, file.name, check.contentType);
  }

  const picker = (
    <input
      ref={fileRef}
      type="file"
      accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
      className="visually-hidden"
      onChange={onFile}
      tabIndex={-1}
      aria-hidden
    />
  );

  /* ---------- 17: photo needs attention ---------- */
  if (error) {
    const copy = UPLOAD_ERROR_COPY[error] ?? UPLOAD_ERROR_COPY.unreadable;
    return (
      <Shell theme="white" demo={demo}>
        <Header backHref="/create" />
        <div className="shell__body">
          {picker}
          <h1 className="display" style={{ marginTop: 10, fontSize: 'clamp(2.5rem, 12vw, 3.125rem)' }}>
            {COPY.s17.heading}
          </h1>
          <div className="error-art" style={{ marginTop: 36, width: 152, height: 152 }} aria-hidden>
            <ImageGlyphFilled style={{ width: 78, height: 66 }} />
            <span className="error-art__badge" style={{ width: 44, height: 44, fontSize: 24, right: -12, bottom: 0 }}>
              !
            </span>
          </div>
          {errorFilename ? (
            <div className="caption center" style={{ marginTop: 10, textTransform: 'none', letterSpacing: '0.04em', overflowWrap: 'anywhere', fontSize: 13 }}>
              {errorFilename}
            </div>
          ) : null}
          <h2 className="display display--section center" style={{ marginTop: 30, fontSize: 28, letterSpacing: '-0.035em', lineHeight: 1.1 }} role="alert">
            {copy.title}
          </h2>
          <p className="lead center" style={{ marginTop: 8, fontSize: 16, maxWidth: 250, marginInline: 'auto' }}>
            {copy.body}
          </p>
          <Button arrow style={{ marginTop: 26 }} onClick={() => fileRef.current?.click()}>
            {COPY.s17.cta}
          </Button>
          <Button variant="outline" href="/create" style={{ marginTop: 12 }}>
            {COPY.s17.back}
          </Button>
          <div className="row-center" style={{ marginTop: 26, paddingBottom: 24, gap: 8, color: 'var(--muted)', fontSize: 15 }}>
            <Info style={{ width: 20, height: 20 }} />
            <span>{COPY.s17.noCredits}</span>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------- 05: create ---------- */
  const uploading = claiming || (progress && progress.phase !== 'error');
  let progressLabel: string | null = null;
  if (claiming && !progress) progressLabel = 'Uploading your photo…';
  else if (progress?.phase === 'requesting') progressLabel = 'Preparing upload…';
  else if (progress?.phase === 'uploading')
    progressLabel = progress.bytesTotal ? `Uploading · ${formatBytes(progress.bytesSent ?? 0)} of ${formatBytes(progress.bytesTotal)}` : 'Uploading…';
  else if (progress?.phase === 'validating') progressLabel = 'Checking your photo…';
  else if (progress?.phase === 'ready') progressLabel = 'Photo received.';

  return (
    <Shell theme="cobalt" nav="create" demo={demo}>
      <Header brandStart end={<CreditPill credits={credits} />} />
      <div className="shell__body">
        {picker}
        <h1 className="display" style={{ marginTop: 16, fontSize: 'clamp(2.5rem, 12.2vw, 3.25rem)' }}>
          {COPY.s05.heading}
        </h1>

        <div className="create-viewfinder" style={{ marginTop: 16, minHeight: 200 }} aria-hidden>
          <ImageGlyph className="glyph" style={{ width: 120, height: 92 }} />
          <Corners />
        </div>

        <div className="stack" style={{ alignItems: 'center', marginTop: 6 }}>
          <button
            ref={shutterRef}
            type="button"
            className="shutter shutter--sm"
            style={{ width: 126, height: 126 }}
            aria-label={COPY.s05.cta}
            aria-busy={uploading || undefined}
            disabled={!!uploading}
            onClick={() => fileRef.current?.click()}
          >
            <span className="shutter__disc" style={{ width: 102, height: 102 }}>
              {uploading ? <span className="btn__spinner" style={{ color: 'var(--cobalt)' }} /> : <Plus strokeWidth={2.4} style={{ width: 44, height: 44 }} />}
            </span>
          </button>
          <div className="shutter-label" style={{ fontSize: 23, marginTop: 8 }} aria-live="polite">
            {progressLabel ?? COPY.s05.cta}
          </div>
          <div className="caption" style={{ marginTop: 6, color: '#fff', fontSize: 12 }}>
            {heicSupported ? COPY.s05.formats : 'JPG or PNG · Up to 20 MB'}
          </div>
          {uploading && progress?.phase === 'uploading' ? (
            <button type="button" className="link" style={{ marginTop: 10, color: '#fff', fontSize: 14 }} onClick={() => abortRef.current?.abort()}>
              Cancel upload
            </button>
          ) : null}
          {inlineError ? (
            <div className="inline-error" role="alert" style={{ marginTop: 12, color: '#fff' }}>
              <Alert />
              <span>{inlineError}</span>
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 22, paddingBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>{COPY.s05.inspiration}</div>
          <div className="thumb-strip" role="list">
            {samples.map((s) => (
              <button key={s.src} type="button" className="thumb-strip__item" role="listitem" aria-label={`Play example: ${s.label}`} onClick={() => setExample({ video: s.video, label: s.real ? `Example · ${s.label} · made with again.` : 'Example · demo render, not a user film' })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt="" />
                <span className="play-badge play-badge--sm play-badge--dark" aria-hidden>
                  <Play />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {example ? <ExampleOverlay src={example.video} label={example.label} onClose={() => setExample(null)} /> : null}
      <Link href="/help" className="visually-hidden">
        How it works
      </Link>
    </Shell>
  );
}
