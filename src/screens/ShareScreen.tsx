'use client';
import { useState } from 'react';
import { COPY } from '@/src/domain/copy';
import type { Film } from '@/src/domain/types';
import { Alert, Download, Play, Share } from '@/src/ui/icons';
import { Button, Header, Shell } from '@/src/ui/primitives';
import { api } from '@/src/ui/api';
import { formatTimecode, roundedSeconds } from '@/src/ui/format';
import { toast } from '@/src/ui/toast';

export interface ShareProps {
  demo?: boolean;
  review?: boolean;
  film: Film;
}

function safeName(title: string) {
  return `${title.replace(/[^\w\- ]+/g, '').trim() || 'film'}.mp4`;
}

export function ShareScreen({ demo, review, film }: ShareProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShare] = useState(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function');

  function download() {
    if (review) return;
    const a = document.createElement('a');
    a.href = api.films.downloadUrl(film.id);
    a.download = safeName(film.title);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function share() {
    if (review || pending) return;
    setError(null);
    if (!canShare) {
      download();
      return;
    }
    setPending(true);
    try {
      const res = await fetch(api.films.downloadUrl(film.id), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('download_failed');
      const blob = await res.blob();
      const file = new File([blob], safeName(film.title), { type: 'video/mp4' });
      const data = { files: [file], title: film.title };
      if (navigator.canShare && !navigator.canShare(data)) {
        download();
        return;
      }
      setPending(false);
      // navigator.share needs a fresh user gesture on some browsers; try directly, fall back to a second tap.
      try {
        await navigator.share(data);
        toast('Shared.', { tone: 'cobalt' });
      } catch (ex) {
        if ((ex as DOMException)?.name === 'AbortError') return; // user canceled: not an error
        if ((ex as DOMException)?.name === 'NotAllowedError') {
          setError('Tap Share video again to open the share sheet.');
          return;
        }
        download();
      }
    } catch {
      setError('We couldn’t prepare the video. Try Download instead.');
    } finally {
      setPending(false);
    }
  }

  const ratio = '350/290';
  return (
    <Shell theme="dark" demo={demo}>
      <Header backHref={`/films/${film.id}`} />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 6, fontSize: 'clamp(2.5rem, 12.2vw, 3.125rem)' }}>
          {COPY.s20.heading}
        </h1>
        <div className="photo photo--auto" style={{ ['--ar' as string]: ratio, marginTop: 20, borderRadius: 4 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={film.posterUrl ?? film.originalUrl ?? ''} alt={`${film.title} poster`} />
          <span className="play-badge play-badge--dark" style={{ left: 16, right: 'auto', bottom: 18, width: 56, height: 56, background: 'rgba(12,14,17,0.62)', border: '1.5px solid rgba(255,255,255,0.7)' }} aria-hidden>
            <Play style={{ width: 22, height: 22 }} />
          </span>
          <span className="duration-badge">{formatTimecode(roundedSeconds(film.durationSeconds))}</span>
        </div>
        <h2 className="display--section display" style={{ marginTop: 22, fontSize: 30, letterSpacing: '-0.03em' }}>
          {film.title}
        </h2>

        {error ? (
          <div className="inline-error" role="alert" style={{ marginTop: 14, color: '#ffb3bf' }}>
            <Alert />
            <span>{error}</span>
          </div>
        ) : null}
        <Button pending={pending} onClick={share} icon={<Share style={{ width: 30, height: 30 }} />} style={{ marginTop: 34, fontSize: 22, gap: 18 }}>
          {COPY.s20.cta}
        </Button>
        <p className="center" style={{ marginTop: 14, fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>
          {COPY.s20.sub}
        </p>
        <Button variant="outline" onClick={download} icon={<Download style={{ width: 26, height: 26 }} />} style={{ marginTop: 22, fontSize: 19, fontWeight: 600, gap: 14 }}>
          {COPY.s20.download}
        </Button>
        <p className="center" style={{ marginTop: 20, paddingBottom: 30, fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>
          {COPY.s20.only}
        </p>
      </div>
    </Shell>
  );
}
