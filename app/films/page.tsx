import { GalleryScreen, type GalleryFilter } from '@/src/screens/GalleryScreen';
import { SAMPLE } from '@/src/fixtures/review';
import { isUuid } from '@/src/domain/helpers';
import { loadFilms, requireViewer } from '@/src/server/loaders';
import { first, type SP } from '@/src/server/page-utils';

export const dynamic = 'force-dynamic';

export default async function FilmsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f = first(sp, 'filter');
  const filter: GalleryFilter = f === 'ready' || f === 'creating' ? f : 'all';
  const v = await requireViewer(`/films${filter !== 'all' ? `?filter=${filter}` : ''}`);
  const list = await loadFilms(v.user.id, filter, first(sp, 'cursor'));
  const pick = (k: string) => {
    const id = first(sp, k);
    return isUuid(id) ? id : null;
  };
  return (
    <GalleryScreen
      demo={v.demo}
      films={list.items}
      nextCursor={list.nextCursor}
      filter={filter}
      credits={v.credits.available}
      actionsId={pick('actions')}
      deleteId={pick('delete')}
      renameId={pick('rename')}
      exampleVideo={SAMPLE.dogVideo}
    />
  );
}
