import { CreateScreen } from '@/src/screens/CreateScreen';
import { SAMPLE } from '@/src/fixtures/review';
import { isUuid } from '@/src/domain/helpers';
import { requireViewer } from '@/src/server/loaders';
import { first, type SP } from '@/src/server/page-utils';

export const dynamic = 'force-dynamic';

const SAMPLES = [
  { src: SAMPLE.dog, video: SAMPLE.dogVideo, label: 'Dog on the beach' },
  { src: SAMPLE.family, video: '/samples/family-park.mp4', label: 'Family in the park' },
  { src: SAMPLE.restaurant, video: '/samples/restaurant.mp4', label: 'Restaurant at night' },
];

export default async function CreatePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const local = first(sp, 'local');
  const returnTo = local ? `/create?local=${local}` : '/create';
  const v = await requireViewer(returnTo);
  const error = first(sp, 'error');
  return (
    <CreateScreen
      demo={v.demo}
      credits={v.credits.available}
      samples={SAMPLES}
      localDraftId={isUuid(local) ? local : null}
      error={error && /^[a-z_]+$/.test(error) ? error : null}
      errorFilename={first(sp, 'name')?.slice(0, 120) ?? null}
      pick={first(sp, 'pick') === '1'}
      heicSupported={v.config.heicSupported}
    />
  );
}
