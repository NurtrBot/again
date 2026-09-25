import { notFound } from 'next/navigation';
import { getEnv } from '@/src/server/env';
import { ReviewScreen, REVIEW_IDS } from '@/src/screens/review-map';

export const dynamic = 'force-dynamic';

export default async function ReviewPage({ params }: { params: Promise<{ screenId: string }> }) {
  if (!getEnv().reviewRoutesEnabled) notFound();
  const { screenId } = await params;
  if (!REVIEW_IDS.includes(screenId)) notFound();
  return (
    <div data-review="1">
      <ReviewScreen id={screenId} />
    </div>
  );
}
