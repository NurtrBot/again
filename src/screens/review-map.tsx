import { WelcomeScreen } from './WelcomeScreen';
import { SAMPLE } from '@/src/fixtures/review';

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
    default:
      return <div style={{ padding: 24 }}>Screen {id} not built yet.</div>;
  }
}
