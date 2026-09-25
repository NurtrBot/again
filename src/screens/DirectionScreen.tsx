'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import { FEELINGS, FEELING_HINTS, type Feeling } from '@/src/domain/helpers';
import type { Draft } from '@/src/domain/types';
import { Alert, Pencil } from '@/src/ui/icons';
import { Button, Corners, CreditPill, Header, Shell, ratioOf } from '@/src/ui/primitives';
import { api, ApiFailure, newIdempotencyKey } from '@/src/ui/api';
import { uploadPhoto, validateLocally, type UploadProgress } from '@/src/ui/upload-client';
import { UPLOAD_ERROR_COPY } from '@/src/domain/types';

export interface DirectionProps {
  demo?: boolean;
  review?: boolean;
  draft: Draft;
  credits: number;
  generationEnabled?: boolean;
}

export function DirectionScreen({ demo, review, draft: initial, credits, generationEnabled = true }: DirectionProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(initial);
  const [feeling, setFeeling] = useState<Feeling>(initial.feeling);
  const [direction, setDirection] = useState(initial.direction);
  const [showDirection, setShowDirection] = useState(!!initial.direction);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const keyRef = useRef<string | null>(null);
  const versionRef = useRef(initial.version);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queued = useRef<{ feeling?: Feeling; direction?: string } | null>(null);

  useEffect(() => {
    versionRef.current = draft.version;
  }, [draft.version]);

  async function flushSave() {
    const patch = queued.current;
    queued.current = null;
    if (!patch || review) return;
    setSaving(true);
    try {
      const next = await api.drafts.patch(draft.id, { ...patch, expectedVersion: versionRef.current });
      versionRef.current = next.version;
      setDraft((d) => ({ ...d, ...next }));
    } catch (ex) {
      const f = ex as ApiFailure;
      if (f.status === 409) {
        const fresh = await api.drafts.get(draft.id).catch(() => null);
        if (fresh) {
          versionRef.current = fresh.version;
          setDraft(fresh);
          queued.current = patch;
          await flushSave();
          return;
        }
      }
      setError('We couldn’t save that change. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  function scheduleSave(patch: { feeling?: Feeling; direction?: string }) {
    queued.current = { ...(queued.current ?? {}), ...patch };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 500);
  }

  function pickFeeling(f: Feeling) {
    setFeeling(f);
    setError(null);
    scheduleSave({ feeling: f });
  }

  async function animate() {
    if (pending || review) return;
    setError(null);
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      await flushSave();
    }
    setPending(true);
    if (!keyRef.current) keyRef.current = newIdempotencyKey();
    try {
      const job = await api.generations.create(draft.id, versionRef.current, keyRef.current);
      router.push(`/create/${draft.id}/processing?job=${job.id}`);
    } catch (ex) {
      const f = ex as ApiFailure;
      if (f.status === 402) {
        router.push(`/credits?returnTo=${encodeURIComponent(`/create/${draft.id}`)}`);
        return;
      }
      keyRef.current = null;
      if (f.status === 409) {
        const fresh = await api.drafts.get(draft.id).catch(() => null);
        if (fresh) {
          versionRef.current = fresh.version;
          setDraft(fresh);
          setFeeling(fresh.feeling);
          setDirection(fresh.direction);
          if (fresh.activeJobId) {
            router.push(`/create/${draft.id}/processing?job=${fresh.activeJobId}`);
            return;
          }
        }
        setError('Your draft changed. Check the feeling and try again.');
      } else if (f.status === 503) setError('Animation is temporarily unavailable. Your credit wasn’t used. Please try again soon.');
      else if (f.status === 429) setError('One film at a time — please wait for your current film to finish.');
      else if (f.status === 401) router.push(`/auth?returnTo=${encodeURIComponent(`/create/${draft.id}`)}`);
      else setError(f.message || 'We couldn’t start this film. No credit was used.');
      setPending(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || review) return;
    const check = validateLocally(file);
    if (!check.ok) {
      const c = UPLOAD_ERROR_COPY[check.code];
      setError(`${c.title} ${c.body}`);
      return;
    }
    setError(null);
    try {
      const media = await uploadPhoto(file, file.name, check.contentType, setUpload);
      const next = await api.drafts.patch(draft.id, { mediaId: media.id, expectedVersion: versionRef.current });
      versionRef.current = next.version;
      setDraft(next);
      keyRef.current = null;
    } catch (ex) {
      const f = ex as ApiFailure;
      const c = UPLOAD_ERROR_COPY[f.code];
      setError(c ? `${c.title} ${c.body}` : 'We couldn’t replace the photo. Your earlier photo is still here.');
    } finally {
      setUpload(null);
    }
  }

  const uploading = upload && upload.phase !== 'error';
  const ratio = ratioOf(draft.width, draft.height, '458/415');

  return (
    <Shell theme="white" demo={demo}>
      <Header backHref="/create" center={null} end={<CreditPill credits={credits} boxed={false} />} />
      <div className="shell__body">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif" className="visually-hidden" onChange={onFile} tabIndex={-1} aria-hidden />
        <div className="viewfinder viewfinder--cobalt" style={{ marginTop: 6 }}>
          <div className="photo photo--auto photo--enter" style={{ ['--ar' as string]: ratio, borderRadius: 0, maxHeight: 400 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.sourcePreviewUrl} alt="Your photo" style={{ opacity: uploading ? 0.5 : 1 }} />
            {uploading ? (
              <div className="row-center" style={{ position: 'absolute', inset: 0, color: '#fff', fontWeight: 600 }} aria-live="polite">
                <span className="btn__spinner" /> Uploading…
              </div>
            ) : null}
          </div>
          <Corners />
        </div>
        <div className="photo-meta">
          <span>{COPY.s06.yourPhoto}</span>
          <span>{COPY.s06.tenSec}</span>
        </div>
        <div className="center" style={{ marginTop: 8 }}>
          <button type="button" className="link link--cobalt" style={{ fontSize: 16, fontWeight: 400 }} onClick={() => fileRef.current?.click()} disabled={!!uploading}>
            {COPY.s06.changePhoto}
          </button>
        </div>

        <h1 className="display" style={{ marginTop: 12, fontSize: 'clamp(2.5rem, 13.2vw, 3.3rem)' }}>
          {COPY.s06.heading}
        </h1>

        <div className="segmented" role="radiogroup" aria-label="Feeling" style={{ marginTop: 18 }}>
          {FEELINGS.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={feeling === f} className="segmented__opt" onClick={() => pickFeeling(f)}>
              {FEELING_HINTS[f].label}
            </button>
          ))}
        </div>
        <p style={{ marginTop: 22, fontSize: 18, letterSpacing: '0.005em' }} aria-live="polite">
          {FEELING_HINTS[feeling].hint}
        </p>

        {!showDirection ? (
          <button type="button" className="row-center" style={{ justifyContent: 'flex-start', marginTop: 18, gap: 16, fontSize: 17, color: 'var(--ink)' }} onClick={() => setShowDirection(true)} aria-expanded={false}>
            <Pencil style={{ width: 26, height: 26 }} />
            <span className="link" style={{ fontWeight: 400 }}>
              {COPY.s06.addDirection}
            </span>
          </button>
        ) : (
          <div className="field" style={{ marginTop: 18 }}>
            <label className="field__label" htmlFor="direction">
              Your direction <span className="helper">(optional)</span>
            </label>
            <textarea
              id="direction"
              className="input textarea"
              maxLength={500}
              value={direction}
              placeholder="e.g. A slow smile, the curtain barely moves."
              onChange={(e) => {
                setDirection(e.target.value);
                scheduleSave({ direction: e.target.value });
              }}
              aria-describedby="direction-count"
            />
            <div className="helper" id="direction-count" style={{ textAlign: 'right' }}>
              {direction.length}/500{saving ? ' · Saving…' : ''}
            </div>
          </div>
        )}

        {error ? (
          <div className="inline-error" role="alert" style={{ marginTop: 16 }}>
            <Alert />
            <span>{error}</span>
          </div>
        ) : null}

        <div style={{ marginTop: 'auto', paddingTop: 30, paddingBottom: 26 }}>
          <Button arrow pending={pending} disabled={!!uploading || !generationEnabled} onClick={animate} style={{ fontSize: 22, minHeight: 62 }}>
            {COPY.s06.cta}
          </Button>
          <p className="helper center" style={{ marginTop: 12, fontSize: 15 }}>
            {generationEnabled ? COPY.s06.note : 'Animation is paused right now. Your photo is saved.'}
          </p>
        </div>
      </div>
    </Shell>
  );
}
