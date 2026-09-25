'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import type { Film } from '@/src/domain/types';
import { ImageIcon, Pause, Play, PlusCircle, Share } from '@/src/ui/icons';
import { Button, Header, Shell, ratioOf } from '@/src/ui/primitives';
import { api } from '@/src/ui/api';
import { formatTimecode, roundedSeconds } from '@/src/ui/format';
import { toast } from '@/src/ui/toast';

export interface FilmProps {
  demo?: boolean;
  review?: boolean;
  film: Film;
}

export function FilmScreen({ demo, review, film }: FilmProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(review ? 4 : 0);
  const [duration, setDuration] = useState(film.durationSeconds ?? 10);
  const [comparing, setComparing] = useState(false);
  const [muted, setMuted] = useState(true);
  const resumeRef = useRef<{ wasPlaying: boolean; t: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (review) return;
    if (film.status === 'creating') router.replace(`/create/${film.draftId}/processing?job=${film.jobId}`);
  }, [film, review, router]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || review) return;
    const onTime = () => setTime(v.currentTime);
    const onMeta = () => setDuration(v.duration || duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.muted = true;
    v.play().catch(() => {});
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  function unmute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  const startCompare = useCallback(() => {
    const v = videoRef.current;
    if (comparing) return;
    resumeRef.current = { wasPlaying: !!v && !v.paused, t: v?.currentTime ?? 0 };
    v?.pause();
    setComparing(true);
  }, [comparing]);

  const endCompare = useCallback(() => {
    const v = videoRef.current;
    const r = resumeRef.current;
    setComparing(false);
    if (v && r) {
      v.currentTime = r.t;
      if (r.wasPlaying) v.play().catch(() => {});
    }
    resumeRef.current = null;
  }, []);

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    const t = Number(e.target.value);
    setTime(t);
    if (v) v.currentTime = t;
  }

  async function save() {
    if (review) return;
    setSaving(true);
    try {
      const a = document.createElement('a');
      a.href = api.films.downloadUrl(film.id);
      a.download = `${film.title.replace(/[^\w\- ]+/g, '').trim() || 'film'}.mp4`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('Saving your film…', { tone: 'cobalt' });
    } finally {
      setTimeout(() => setSaving(false), 1200);
    }
  }

  const ratio = ratioOf(film.width, film.height, '458/415');
  const pct = duration ? Math.min(100, (time / duration) * 100) : 0;
  const total = roundedSeconds(film.durationSeconds ?? duration);

  if (film.status === 'failed') {
    return (
      <Shell theme="dark" demo={demo}>
        <Header brandStart closeHref="/films" />
        <div className="shell__body">
          <h1 className="display" style={{ marginTop: 20 }}>
            {COPY.s18.heading}
          </h1>
          <p className="lead" style={{ marginTop: 12 }}>
            {film.creditReturned ? COPY.s18.returned : COPY.s18.returning}
          </p>
          <Button variant="outline" href={`/create/${film.draftId}`} style={{ marginTop: 24 }}>
            {COPY.s18.retry}
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell theme="dark" demo={demo}>
      <Header brandStart closeHref="/films" />
      <div className="shell__body">
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.78)', marginTop: 2 }}>
          {COPY.s08.saved}
          <Link href="/films" className="link" style={{ color: '#fff', fontWeight: 400, textDecoration: 'none' }}>
            {COPY.s08.savedLink}
          </Link>
        </p>
        <h1 className="display" style={{ marginTop: 8, fontSize: 'clamp(2.5rem, 12.6vw, 3.25rem)' }}>
          {COPY.s08.heading}
        </h1>

        <div className="photo photo--auto" style={{ ['--ar' as string]: ratio, marginTop: 20, borderRadius: 0, maxHeight: 420 }}>
          {film.playbackUrl && !review ? (
            <video ref={videoRef} src={film.playbackUrl} poster={film.posterUrl ?? undefined} playsInline preload="metadata" loop muted onClick={togglePlay} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={film.posterUrl ?? film.originalUrl ?? ''} alt={`${film.title} poster`} />
          )}
          {film.originalUrl ? (
            <div className={`compare${comparing ? ' compare--on' : ''}`} aria-hidden={!comparing}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={film.originalUrl} alt="Original photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : null}
          {film.isDemoRender ? <span className="example-tag">Demo render</span> : null}
        </div>

        <div className="player">
          <button type="button" className="player__btn" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
            {playing || review ? <Pause /> : <Play />}
          </button>
          <span className="player__time">{formatTimecode(time)}</span>
          <div className="player__track">
            <span className="player__rail" aria-hidden />
            <span className="player__fill" style={{ width: `${pct}%` }} aria-hidden />
            <span className="player__thumb" style={{ left: `${pct}%` }} aria-hidden />
            <input className="player__range" type="range" min={0} max={duration || 10} step={0.05} value={time} onChange={seek} aria-label="Seek" aria-valuetext={formatTimecode(time)} />
          </div>
          <span className="player__time" style={{ textAlign: 'right' }}>
            {formatTimecode(total)}
          </span>
          {!review ? (
            <button type="button" className="link" style={{ color: '#fff', fontSize: 12, fontWeight: 500, marginLeft: 4 }} onClick={unmute} aria-pressed={!muted}>
              {muted ? 'Sound on' : 'Mute'}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="btn btn--outline"
          style={{ marginTop: 6, fontSize: 19, fontWeight: 500, gap: 16 }}
          aria-pressed={comparing}
          aria-label="Press and hold to see the original photo"
          onPointerDown={(e) => {
            e.preventDefault();
            startCompare();
          }}
          onPointerUp={endCompare}
          onPointerLeave={() => comparing && endCompare()}
          onPointerCancel={endCompare}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              if (comparing) endCompare();
              else startCompare();
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <ImageIcon style={{ width: 28, height: 28 }} />
          <span>{comparing ? 'Release to see film' : COPY.s08.pressToSee}</span>
        </button>

        <div className="btn-row" style={{ marginTop: 20 }}>
          <Button pending={saving} onClick={save} style={{ fontSize: 24 }}>
            {COPY.s08.save}
          </Button>
          <Link href={`/films/${film.id}/share`} className="btn btn--outline btn--square" aria-label="Share film">
            <Share />
            <span>{COPY.s08.share}</span>
          </Link>
        </div>

        <div className="row-center" style={{ marginTop: 'auto', paddingTop: 30, paddingBottom: 26 }}>
          <Link href="/create" className="row-center" style={{ textDecoration: 'none', color: '#fff', fontSize: 17, gap: 14 }}>
            <PlusCircle style={{ width: 36, height: 36 }} strokeWidth={1.6} />
            <span>{COPY.s08.another}</span>
          </Link>
        </div>
      </div>
    </Shell>
  );
}
