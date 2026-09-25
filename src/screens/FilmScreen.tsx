'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import type { Film } from '@/src/domain/types';
import { CheckCircle, ChevronRight, Download, FilmIcon, Fullscreen, ImageIcon, Pause, Pencil, Play, Share, Speaker, ViewfinderPlus } from '@/src/ui/icons';
import { Button, Corners, Header, Shell, ratioOf } from '@/src/ui/primitives';
import { api } from '@/src/ui/api';
import { formatLongDate, formatTimecode, roundedSeconds } from '@/src/ui/format';
import { toast } from '@/src/ui/toast';

export interface FilmProps {
  demo?: boolean;
  review?: boolean;
  film: Film;
}

export function FilmScreen({ demo, review, film: initialFilm }: FilmProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [film, setFilm] = useState(initialFilm);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(review ? 6 : 0);
  const [duration, setDuration] = useState(film.durationSeconds ?? 10);
  const [view, setView] = useState<'photo' | 'film'>('film');
  const [muted, setMuted] = useState(true);
  const resumeRef = useRef<{ wasPlaying: boolean; t: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(film.title);

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
    if (view === 'photo') showFilm();
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function fullscreen() {
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
  }

  /** Photo view: pause and overlay the original; Film view restores exact time and play state. */
  function showPhoto() {
    const v = videoRef.current;
    if (view === 'photo') return;
    resumeRef.current = { wasPlaying: !!v && !v.paused, t: v?.currentTime ?? 0 };
    v?.pause();
    setView('photo');
  }
  function showFilm() {
    const v = videoRef.current;
    const r = resumeRef.current;
    setView('film');
    if (v && r) {
      v.currentTime = r.t;
      if (r.wasPlaying) v.play().catch(() => {});
    }
    resumeRef.current = null;
  }

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

  async function commitTitle() {
    const clean = titleDraft.trim().slice(0, 80);
    setEditing(false);
    if (!clean || clean === film.title || review) {
      setTitleDraft(film.title);
      return;
    }
    const prev = film.title;
    setFilm((f) => ({ ...f, title: clean }));
    try {
      const updated = await api.films.rename(film.id, clean);
      setFilm((f) => ({ ...f, title: updated.title }));
      setTitleDraft(updated.title);
    } catch {
      setFilm((f) => ({ ...f, title: prev }));
      setTitleDraft(prev);
      toast('We couldn’t rename that film.');
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
        <Link href="/films" className="saved-row">
          <CheckCircle strokeWidth={1.6} />
          <span>
            {COPY.s08.saved}
            {COPY.s08.savedLink}
          </span>
        </Link>
        <h1 className="display" style={{ marginTop: 10, fontSize: 'clamp(2.75rem, 13.6vw, 3.5rem)' }}>
          {COPY.s08.heading}
        </h1>

        <div className="player-card">
          <div className="player-card__frame">
            <span className="film-tag">{view === 'photo' ? 'YOUR PHOTO' : COPY.s08.yourFilm}</span>
            <div className="photo photo--auto" style={{ ['--ar' as string]: ratio, maxHeight: 460 }}>
              {film.playbackUrl && !review ? (
                <video ref={videoRef} src={film.playbackUrl} poster={film.posterUrl ?? undefined} playsInline preload="metadata" loop muted onClick={togglePlay} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={film.posterUrl ?? film.originalUrl ?? ''} alt={`${film.title} poster`} />
              )}
              {film.originalUrl ? (
                <div className={`compare${view === 'photo' ? ' compare--on' : ''}`} aria-hidden={view !== 'photo'}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={film.originalUrl} alt="Original photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : null}
              {film.isDemoRender ? (
                <span className="example-tag" style={{ left: 'auto', right: 10, bottom: 10 }}>
                  Demo render
                </span>
              ) : null}
            </div>
            <Corners />
          </div>
          <div className="player">
            <button type="button" className="player__btn player__btn--icon" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
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
            <button type="button" className="player__btn player__btn--icon" aria-label={muted ? 'Turn sound on' : 'Mute'} aria-pressed={!muted} onClick={toggleMute}>
              <Speaker muted={muted && !review} />
            </button>
            <button type="button" className="player__btn player__btn--icon" aria-label="Fullscreen" onClick={fullscreen}>
              <Fullscreen />
            </button>
          </div>
        </div>

        <div className="film-title-row">
          {editing ? (
            <input
              className="film-title-input"
              value={titleDraft}
              maxLength={80}
              autoFocus
              aria-label="Film title"
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void commitTitle();
                }
                if (e.key === 'Escape') {
                  setTitleDraft(film.title);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <>
              <h2 className="film-title">{film.title}</h2>
              <button type="button" className="icon-btn" aria-label="Rename film" onClick={() => setEditing(true)}>
                <Pencil strokeWidth={1.8} />
              </button>
            </>
          )}
        </div>
        <div className="film-date">{formatLongDate(film.createdAt)}</div>

        <div className="seg" role="radiogroup" aria-label="Show photo or film">
          <button type="button" role="radio" aria-checked={view === 'photo'} className="seg__opt" onClick={showPhoto}>
            <ImageIcon strokeWidth={1.8} />
            <span>{COPY.s08.photo}</span>
          </button>
          <button type="button" role="radio" aria-checked={view === 'film'} className="seg__opt" onClick={showFilm}>
            <Play />
            <span>{COPY.s08.film}</span>
          </button>
        </div>

        <Button className="btn--download" icon={<Download strokeWidth={2.2} />} pending={saving} onClick={save}>
          {COPY.s08.download}
        </Button>
        <div className="film-actions">
          <Link href={`/films/${film.id}/share`} className="btn btn--outline">
            <Share strokeWidth={2} />
            <span>{COPY.s08.share}</span>
          </Link>
          <Link href="/films" className="btn btn--outline">
            <FilmIcon strokeWidth={2} />
            <span>{COPY.s08.myFilms}</span>
          </Link>
        </div>

        <Link href="/create" className="another-row" style={{ marginBottom: 12 }}>
          <span className="another-row__icon">
            <ViewfinderPlus strokeWidth={2} />
          </span>
          <span>{COPY.s08.anotherMoment}</span>
          <span className="another-row__chev">
            <ChevronRight />
          </span>
        </Link>
      </div>
    </Shell>
  );
}
