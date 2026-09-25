import { CreateScreen } from '@/src/screens/CreateScreen';
import { INSPIRATION } from '@/src/fixtures/review';
import { isUuid } from '@/src/domain/helpers';
import { requireViewer } from '@/src/server/loaders';
import { first, type SP } from '@/src/server/page-utils';

export const dynamic = 'force-dynamic';

const SAMPLES = INSPIRATION;

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
