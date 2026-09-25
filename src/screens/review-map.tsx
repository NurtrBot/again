import { WelcomeScreen } from './WelcomeScreen';
import { AuthScreen } from './AuthScreen';
import { VerifyScreen } from './VerifyScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { CreateScreen } from './CreateScreen';
import { DirectionScreen } from './DirectionScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { FilmScreen } from './FilmScreen';
import { ShareScreen } from './ShareScreen';
import { GalleryScreen } from './GalleryScreen';
import { CreditsScreen } from './CreditsScreen';
import { CheckoutScreen } from './CheckoutScreen';
import { PurchaseCompleteScreen } from './PurchaseCompleteScreen';
import { AccountScreen } from './AccountScreen';
import { BillingScreen } from './BillingScreen';
import { CATALOG } from '@/src/domain/catalog';
import { SAMPLE, draft, job, failedJob, readyFilm, galleryFilms, profile, creditsFive, creditsSubscriber, subscriptionActive, subscriptionNone, reviewCheckout, reviewPaymentStatus } from '@/src/fixtures/review';
import { INSPIRATION } from '@/src/fixtures/review';

const REVIEW_NOW = '2026-09-25T15:04:00.000Z';

const SAMPLES = INSPIRATION;

export const REVIEW_NAMES: Record<string, string> = {
  '01': 'Welcome',
  '02': 'Sign up or sign in',
  '03': 'Email verification',
  '04': 'Quick start',
  '05': 'Create',
  '06': 'Direction',
  '07': 'Creating',
  '08': 'Ready to watch',
  '09': 'My films',
  '10': 'Buy credits',
  '11': 'Monthly plans',
  '12': 'Checkout',
  '13': 'Purchase complete',
  '14': 'Account',
  '15': 'Manage membership',
  '16': 'Empty gallery',
  '17': 'Photo needs attention',
  '18': 'Generation failed',
  '19': 'Film actions',
  '20': 'Share film',
  '21': 'Delete confirmation',
};
export const REVIEW_IDS = Object.keys(REVIEW_NAMES);

export function ReviewScreen({ id }: { id: string }) {
  switch (id) {
    case '01':
      return <WelcomeScreen review sampleSrc={SAMPLE.dog} sampleVideo={SAMPLE.dogVideo} />;
    case '02':
      return <AuthScreen review oauthProviders={['apple', 'google']} returnTo="/create" reviewThumb={SAMPLE.dog} />;
    case '03':
      return <VerifyScreen review challengeId="review" reviewCode="482" reviewEmail="you@example.com" reviewThumb={SAMPLE.dog} />;
    case '04':
      return <OnboardingScreen review returnTo="/create" sampleSrc={SAMPLE.dog} />;
    case '05':
      return <CreateScreen review credits={3} samples={SAMPLES} />;
    case '06':
      return <DirectionScreen review draft={draft} credits={3} />;
    case '07':
      return <ProcessingScreen review job={job} draftId={draft.id} credits={3} />;
    case '08':
      return <FilmScreen review film={readyFilm} />;
    case '09':
      return <GalleryScreen review films={galleryFilms} nextCursor={null} filter="all" credits={2} exampleVideo={SAMPLE.dogVideo} reviewNow={REVIEW_NOW} />;
    case '16':
      return <GalleryScreen review films={[]} nextCursor={null} filter="all" credits={0} exampleVideo={SAMPLE.dogVideo} reviewNow={REVIEW_NOW} />;
    case '18':
      return <ProcessingScreen review job={failedJob} draftId={draft.id} credits={3} />;
    case '19':
      return <GalleryScreen review films={galleryFilms} nextCursor={null} filter="all" credits={2} actionsId={readyFilm.id} exampleVideo={SAMPLE.dogVideo} reviewNow={REVIEW_NOW} />;
    case '20':
      return <ShareScreen review film={readyFilm} />;
    case '21':
      return <GalleryScreen review films={galleryFilms} nextCursor={null} filter="all" credits={2} deleteId={readyFilm.id} exampleVideo={SAMPLE.dogVideo} reviewNow={REVIEW_NOW} />;
    case '10':
      return <CreditsScreen review tab="packs" products={CATALOG} credits={0} subscription={subscriptionNone} draftId={draft.id} />;
    case '11':
      return <CreditsScreen review tab="monthly" products={CATALOG} credits={0} subscription={subscriptionNone} draftId={draft.id} />;
    case '12':
      return <CheckoutScreen review checkout={reviewCheckout} />;
    case '13':
      return <PurchaseCompleteScreen review sessionId="review" initial={reviewPaymentStatus} />;
    case '14':
      return <AccountScreen review profile={profile} credits={creditsFive} />;
    case '15':
      return <BillingScreen review subscription={subscriptionActive} credits={creditsSubscriber} />;
    case '17':
      return <CreateScreen review credits={3} samples={SAMPLES} error="unsupported_type" errorFilename="portrait.tiff" />;
    default:
      return <div style={{ padding: 24 }}>Screen {id} not built yet.</div>;
  }
}
