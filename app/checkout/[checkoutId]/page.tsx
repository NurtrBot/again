import { notFound, redirect } from 'next/navigation';
import { CheckoutScreen } from '@/src/screens/CheckoutScreen';
import { isUuid } from '@/src/domain/helpers';
import { loadCheckout, requireViewer } from '@/src/server/loaders';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: Promise<{ checkoutId: string }> }) {
  const { checkoutId } = await params;
  if (!isUuid(checkoutId)) notFound();
  const v = await requireViewer(`/checkout/${checkoutId}`);
  const checkout = await loadCheckout(v.user.id, checkoutId);
  if (!checkout) notFound();
  if (checkout.fulfillmentStatus === 'fulfilled') redirect(`/checkout/success?session_id=${encodeURIComponent(checkout.stripeSessionId)}`);
  return <CheckoutScreen demo={v.demo} checkout={checkout} stripePublishableKey={v.config.stripePublishableKey} />;
}
