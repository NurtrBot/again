'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COPY } from '@/src/domain/copy';
import type { Film } from '@/src/domain/types';
import { Download, Ellipsis, Pencil, Play, PlayOutline, Plus, Share, Trash } from '@/src/ui/icons';
import { Button, Corners, CreditPill, Header, Shell } from '@/src/ui/primitives';
import { Sheet } from '@/src/ui/sheet';
import { api } from '@/src/ui/api';
import { formatFilmDate, formatTimecode, roundedSeconds } from '@/src/ui/format';
import { toast } from '@/src/ui/toast';
import { ExampleOverlay } from '@/src/ui/example-overlay';

export type GalleryFilter = 'all' | 'ready' | 'creating';

export interface GalleryProps {
  demo?: boolean;
  review?: boolean;
  films: Film[];
  nextCursor: string | null;
  filter: GalleryFilter;
  credits: number;
  actionsId?: string | null;
  deleteId?: string | null;
  renameId?: string | null;
  exampleVideo: string;
  /** Review: freeze "today" for date labels. */
  reviewNow?: string;
}

export function GalleryScreen(props: GalleryProps) {
  const { demo, review, filter, credits, exampleVideo, reviewNow } = props;
  const router = useRouter();
  const [films, setFilms] = useState<Film[]>(props.films);
  const [cursor, setCursor] = useState(props.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [example, setExample] = useState(false);
  const [renaming, setRenaming] = useState<Film | null>(null);
  const [deleting, setDeleting] = useState(false);
  const moreRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const now = reviewNow ? new Date(reviewNow) : undefined;

  useEffect(() => setFilms(props.films), [props.films]);

  const actionsFilm = props.actionsId ? films.find((f) => f.id === props.actionsId) ?? null : null;
  const deleteFilm = props.deleteId ? films.find((f) => f.id === props.deleteId) ?? null : null;
  useEffect(() => {
    if (props.renameId && !review) setRenaming(films.find((f) => f.id === props.renameId) ?? null);
  }, [props.renameId, films, review]);

  // Preserve scroll position when returning from playback.
  useEffect(() => {
    if (review) return;
    const key = `again:gallery-scroll:${filter}`;
    try {
      const y = sessionStorage.getItem(key);
      if (y) window.scrollTo(0, Number(y));
    } catch {
      /* ignore */
    }
    const save = () => {
      try {
        sessionStorage.setItem(key, String(window.scrollY));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [filter, review]);

  const closeSheet = useCallback(() => {
    if (review) return;
    router.push(`/films${filter !== 'all' ? `?filter=${filter}` : ''}`, { scroll: false });
  }, [router, filter, review]);

  function hrefWith(params: Record<string, string | null>) {
    const q = new URLSearchParams();
    if (filter !== 'all') q.set('filter', filter);
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    const s = q.toString();
    return `/films${s ? `?${s}` : ''}`;
  }

  async function loadMore() {
    if (!cursor || loadingMore || review) return;
    setLoadingMore(true);
    try {
      const page = await api.films.list(filter, cursor);
      setFilms((f) => [...f, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      toast('We couldn’t load more films.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmDelete() {
    if (!deleteFilm || review || deleting) return;
    setDeleting(true);
    try {
      await api.films.delete(deleteFilm.id);
      setFilms((f) => f.filter((x) => x.id !== deleteFilm.id));
      toast('Film deleted.');
      router.replace(hrefWith({}), { scroll: false });
    } catch {
      toast('We couldn’t delete that film. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function submitRename(title: string) {
    if (!renaming || review) return;
    const clean = title.trim().slice(0, 80);
    if (!clean) return;
    const prev = renaming;
    setFilms((f) => f.map((x) => (x.id === prev.id ? { ...x, title: clean } : x)));
    setRenaming(null);
    router.replace(hrefWith({}), { scroll: false });
    try {
      const updated = await api.films.rename(prev.id, clean);
      setFilms((f) => f.map((x) => (x.id === prev.id ? { ...x, title: updated.title } : x)));
    } catch {
      setFilms((f) => f.map((x) => (x.id === prev.id ? { ...x, title: prev.title } : x)));
      toast('We couldn’t rename that film.');
    }
  }

  function download(f: Film) {
    if (review) return;
    const a = document.createElement('a');
    a.href = api.films.downloadUrl(f.id);
    a.download = `${f.title.replace(/[^\w\- ]+/g, '').trim() || 'film'}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const visible = films.filter((f) => (filter === 'all' ? true : filter === 'ready' ? f.status === 'ready' : f.status === 'creating'));
  const empty = films.length === 0;

  /* ---------- 16: empty ---------- */
  if (empty) {
    return (
      <Shell theme="white" nav="films" demo={demo}>
        <Header brandStart end={<CreditPill credits={credits} boxed={false} />} />
        <div className="shell__body">
          <h1 className="display" style={{ marginTop: 20, fontSize: 'clamp(2.75rem, 14vw, 3.5rem)' }}>
            {COPY.s09.heading}
          </h1>
          <p className="lead" style={{ marginTop: 6, fontSize: 18, color: '#3d424a' }}>
            {COPY.s09.sub}
          </p>
          <div className="empty-viewfinder" style={{ marginTop: 30, width: 224, height: 214 }} aria-hidden>
            <Play style={{ width: 64, height: 64 }} />
            <Corners />
          </div>
          <h2 className="display" style={{ marginTop: 24, fontSize: 'clamp(2rem, 9.8vw, 2.5rem)', letterSpacing: '-0.04em' }}>
            {COPY.s16.heading}
          </h2>
          <p className="lead" style={{ marginTop: 10, fontSize: 18 }}>
            {COPY.s16.sub}
          </p>
          <Button arrow href="/create?pick=1" style={{ marginTop: 26 }}>
            {COPY.s16.cta}
          </Button>
          <div className="center" style={{ marginTop: 20, paddingBottom: 24 }}>
            <button type="button" className="link link--cobalt" style={{ fontSize: 17, fontWeight: 400 }} onClick={() => setExample(true)}>
              {COPY.s16.example}
            </button>
          </div>
        </div>
        {example ? <ExampleOverlay src={exampleVideo} onClose={() => setExample(false)} /> : null}
      </Shell>
    );
  }

  /* ---------- 09 / 19 / 21 ---------- */
  return (
    <Shell theme="white" nav="films" demo={demo} wide>
      <Header brandStart end={<CreditPill credits={credits} />} />
      <div className="shell__body">
        <h1 className="display" style={{ marginTop: 14, fontSize: 'clamp(2.75rem, 14.6vw, 3.6rem)' }}>
          {COPY.s09.heading}
        </h1>
        <p className="lead" style={{ marginTop: 4, fontSize: 18, color: '#3d424a' }}>
          {COPY.s09.sub}
        </p>
        <nav className="tabs tabs--start" style={{ marginTop: 14 }} aria-label="Filter films">
          {(['all', 'ready', 'creating'] as GalleryFilter[]).map((f, i) => (
            <Link key={f} href={`/films${f === 'all' ? '' : `?filter=${f}`}`} className="tabs__tab" aria-current={filter === f ? 'page' : undefined} style={{ minWidth: 0, marginRight: i === 0 ? 40 : 66, paddingInline: i === 0 ? '30px 0' : 0, paddingLeft: i === 0 ? 30 : 0, marginLeft: i === 0 ? 0 : 0, fontSize: 18, minHeight: 44 }}>
              {COPY.s09.tabs[i]}
            </Link>
          ))}
        </nav>

        <div className="gallery-grid" style={{ marginTop: 16 }}>
          {visible.map((f) => (
            <article key={f.id} className="film-row" aria-label={f.title}>
              {f.status === 'ready' ? (
                <Link href={`/films/${f.id}`} className="film-row__media" aria-label={`Play ${f.title}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {f.posterUrl ? <img src={f.posterUrl} alt="" /> : null}
                  <span className="play-badge play-badge--center" aria-hidden>
                    <Play />
                  </span>
                  <span className="duration-badge">{formatTimecode(roundedSeconds(f.durationSeconds))}</span>
                </Link>
              ) : f.status === 'creating' ? (
                <Link href={`/create/${f.draftId}/processing?job=${f.jobId}`} className="film-row__media" aria-label={`${f.title}, creating`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {f.posterUrl ? <img src={f.posterUrl} alt="" /> : null}
                  <span className="status-chip">
                    <span className="status-chip__spinner" aria-hidden />
                    {COPY.s09.creating}
                  </span>
                </Link>
              ) : (
                <Link href={`/create/${f.draftId}/processing?job=${f.jobId}`} className="film-row__media" aria-label={`${f.title}, didn’t finish`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {f.posterUrl ? <img src={f.posterUrl} alt="" style={{ opacity: 0.7 }} /> : null}
                  <span className="status-chip status-chip--failed">Didn’t finish</span>
                </Link>
              )}
              <div className="film-row__meta">
                <div>
                  <div className="film-row__title">{f.title}</div>
                  <div className="film-row__date">
                    {f.status === 'creating' ? COPY.s09.inProgress : f.status === 'failed' ? (
                      <>
                        {f.creditReturned ? 'Credit returned · ' : 'Returning credit · '}
                        <Link href={`/create/${f.draftId}`} className="link link--cobalt" style={{ fontWeight: 500 }}>
                          Try again
                        </Link>
                      </>
                    ) : (
                      formatFilmDate(f.createdAt, now)
                    )}
                  </div>
                </div>
                <button
                  ref={(el) => {
                    moreRefs.current[f.id] = el;
                  }}
                  type="button"
                  className="film-row__more"
                  aria-label={`More actions for ${f.title}`}
                  aria-haspopup="dialog"
                  onClick={() => router.push(hrefWith({ actions: f.id }), { scroll: false })}
                >
                  <Ellipsis />
                </button>
              </div>
            </article>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="helper" style={{ marginTop: 12 }}>
            {filter === 'creating' ? 'Nothing is being created right now.' : 'No finished films yet.'}
          </p>
        ) : null}
        {cursor ? (
          <Button variant="outline" size="sm" onClick={loadMore} pending={loadingMore} style={{ marginTop: 8, marginBottom: 24 }}>
            Load more
          </Button>
        ) : null}
      </div>

      <Link href="/create" className="fab" aria-label="Create a new film">
        <Plus strokeWidth={2.2} />
      </Link>

      {/* 19: actions sheet */}
      <Sheet open={!!actionsFilm && !deleteFilm && !renaming} onClose={closeSheet} label={`Actions for ${actionsFilm?.title ?? 'film'}`} restoreFocusTo={actionsFilm ? moreRefs.current[actionsFilm.id] : null}>
        {actionsFilm ? (
          <>
            <div className="sheet__head">
              <div className="sheet__thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {actionsFilm.posterUrl ? <img src={actionsFilm.posterUrl} alt="" /> : null}
              </div>
              <div>
                <div className="sheet__title">{actionsFilm.title}</div>
                <div className="sheet__sub">{COPY.s19.seconds(roundedSeconds(actionsFilm.durationSeconds))}</div>
              </div>
            </div>
            <div className="row-list">
              {actionsFilm.status === 'ready' ? (
                <Link href={`/films/${actionsFilm.id}`} className="row">
                  <span className="row__icon">
                    <PlayOutline />
                  </span>
                  <span className="row__label">{COPY.s19.play}</span>
                  <span className="row__chevron" style={{ color: 'var(--muted-2)' }}>
                    <ChevronThin />
                  </span>
                </Link>
              ) : null}
              <button type="button" className="row" onClick={() => setRenaming(actionsFilm)}>
                <span className="row__icon">
                  <Pencil />
                </span>
                <span className="row__label">{COPY.s19.rename}</span>
                <span className="row__chevron" style={{ color: 'var(--muted-2)' }}>
                  <ChevronThin />
                </span>
              </button>
              {actionsFilm.status === 'ready' ? (
                <>
                  <button type="button" className="row" onClick={() => download(actionsFilm)}>
                    <span className="row__icon">
                      <Download />
                    </span>
                    <span className="row__label">{COPY.s19.download}</span>
                    <span className="row__chevron" style={{ color: 'var(--muted-2)' }}>
                      <ChevronThin />
                    </span>
                  </button>
                  <Link href={`/films/${actionsFilm.id}/share`} className="row">
                    <span className="row__icon">
                      <Share />
                    </span>
                    <span className="row__label">{COPY.s19.share}</span>
                    <span className="row__chevron" style={{ color: 'var(--muted-2)' }}>
                      <ChevronThin />
                    </span>
                  </Link>
                </>
              ) : null}
              <button type="button" className="row row--danger" onClick={() => router.push(hrefWith({ delete: actionsFilm.id }), { scroll: false })}>
                <span className="row__icon">
                  <Trash />
                </span>
                <span className="row__label">{COPY.s19.delete}</span>
                <span className="row__chevron" style={{ color: 'var(--muted-2)' }}>
                  <ChevronThin />
                </span>
              </button>
            </div>
          </>
        ) : null}
      </Sheet>

      {/* 21: delete confirmation */}
      <Sheet open={!!deleteFilm} onClose={closeSheet} label="Delete this film?" restoreFocusTo={deleteFilm ? moreRefs.current[deleteFilm.id] : null}>
        {deleteFilm ? (
          <>
            <div className="dialog-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {deleteFilm.posterUrl ? <img src={deleteFilm.posterUrl} alt="" /> : null}
            </div>
            <div className="dialog-body" style={{ marginTop: 18 }}>
              <h2 className="display display--section" style={{ fontSize: 32 }}>
                {COPY.s21.heading}
              </h2>
              <p className="lead" style={{ fontSize: 16 }}>
                {COPY.s21.body(deleteFilm.title)}
              </p>
              <p className="helper" style={{ fontSize: 15 }}>
                {COPY.s21.note}
              </p>
            </div>
            <Button style={{ marginTop: 22 }} onClick={closeSheet} autoFocus>
              {COPY.s21.keep}
            </Button>
            <Button variant="danger-outline" icon={<Trash />} style={{ marginTop: 12, fontSize: 20, gap: 14 }} pending={deleting} onClick={confirmDelete}>
              {COPY.s21.delete}
            </Button>
          </>
        ) : null}
      </Sheet>

      {/* Rename dialog */}
      <Sheet open={!!renaming} onClose={() => setRenaming(null)} label="Rename film">
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void submitRename(String(fd.get('title') ?? ''));
            }}
            className="stack gap-4"
            style={{ paddingTop: 12 }}
          >
            <h2 className="display display--section" style={{ fontSize: 28 }}>
              Rename film
            </h2>
            <div className="field">
              <label className="field__label" htmlFor="rename-title">
                Title
              </label>
              <input id="rename-title" name="title" className="input" defaultValue={renaming.title} maxLength={80} required autoFocus autoComplete="off" />
              <div className="helper">1–80 characters.</div>
            </div>
            <Button type="submit">Save</Button>
            <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
          </form>
        ) : null}
      </Sheet>
    </Shell>
  );
}

function ChevronThin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden width="22" height="22">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
