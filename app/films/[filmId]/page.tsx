import { notFound, redirect } from 'next/navigation';
import { FilmScreen } from '@/src/screens/FilmScreen';
import { isUuid } from '@/src/domain/helpers';
import { loadFilm, requireViewer } from '@/src/server/loaders';

export const dynamic = 'force-dynamic';

export default async function FilmPage({ params }: { params: Promise<{ filmId: string }> }) {
  const { filmId } = await params;
  if (!isUuid(filmId)) notFound();
  const v = await requireViewer(`/films/${filmId}`);
  const film = await loadFilm(v.user.id, filmId);
  if (!film) notFound();
  if (film.status === 'creating') redirect(`/create/${film.draftId}/processing?job=${film.jobId}`);
  return <FilmScreen demo={v.demo} film={film} />;
}
