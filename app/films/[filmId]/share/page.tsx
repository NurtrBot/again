import { notFound, redirect } from 'next/navigation';
import { ShareScreen } from '@/src/screens/ShareScreen';
import { isUuid } from '@/src/domain/helpers';
import { loadFilm, requireViewer } from '@/src/server/loaders';

export const dynamic = 'force-dynamic';

export default async function SharePage({ params }: { params: Promise<{ filmId: string }> }) {
  const { filmId } = await params;
  if (!isUuid(filmId)) notFound();
  const v = await requireViewer(`/films/${filmId}/share`);
  const film = await loadFilm(v.user.id, filmId);
  if (!film) notFound();
  if (film.status !== 'ready') redirect(`/films/${filmId}`);
  return <ShareScreen demo={v.demo} film={film} />;
}
