import { notFound, redirect } from 'next/navigation';
import { DirectionScreen } from '@/src/screens/DirectionScreen';
import { isUuid } from '@/src/domain/helpers';
import { loadDraft, requireViewer } from '@/src/server/loaders';
import { getEnv } from '@/src/server/env';

export const dynamic = 'force-dynamic';

export default async function DirectionPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  if (!isUuid(draftId)) notFound();
  const v = await requireViewer(`/create/${draftId}`);
  const draft = await loadDraft(v.user.id, draftId);
  if (!draft) notFound();
  if (draft.status === 'generating' && draft.activeJobId) redirect(`/create/${draftId}/processing?job=${draft.activeJobId}`);
  return <DirectionScreen demo={v.demo} draft={draft} credits={v.credits.available} generationEnabled={getEnv().GENERATION_ENABLED} />;
}
