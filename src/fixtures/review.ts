/* Deterministic review fixtures for /review/[01-21]. These are scenario values,
 * not one continuous account: the pack buyer and the subscriber are separate. */
import type { Checkout, Credits, Draft, Film, Job, PaymentStatus, Profile, Subscription } from '@/src/domain/types';
import { CATALOG } from '@/src/domain/catalog';

export const SAMPLE = {
  dog: '/samples/dog-beach.jpg',
  dogVideo: '/samples/dog-beach.mp4',
  family: '/samples/family-park.jpg',
  restaurant: '/samples/restaurant.jpg',
  eveningHome: '/samples/evening-home.jpg',
  restaurantFilm: '/samples/restaurant-film.jpg',
};

/** Inspiration strip on Create. `real` = an actual again. film (Kling via Higgsfield); otherwise a labeled demo push-in. */
export const INSPIRATION: Array<{ src: string; video: string; label: string; real?: boolean }> = [
  { src: SAMPLE.eveningHome, video: '/samples/evening-home.mp4', label: 'Evening at home', real: true },
  { src: SAMPLE.restaurantFilm, video: '/samples/restaurant-film.mp4', label: 'Yakitori night', real: true },
  { src: SAMPLE.dog, video: SAMPLE.dogVideo, label: 'Dog on the beach' },
  { src: SAMPLE.family, video: '/samples/family-park.mp4', label: 'Family in the park' },
];

const FIXED_NOW = '2026-09-25T15:04:00.000Z';

export const profile: Profile = { id: '11111111-1111-4111-8111-111111111111', email: 'you@example.com', displayName: 'Zack', onboardingComplete: true };

export const draft: Draft = {
  id: '22222222-2222-4222-8222-222222222222',
  mediaId: '33333333-3333-4333-8333-333333333333',
  feeling: 'gentle',
  direction: '',
  version: 1,
  sourcePreviewUrl: SAMPLE.dog,
  status: 'ready',
  width: 458,
  height: 415,
};

export const job: Job = {
  id: '44444444-4444-4444-8444-444444444444',
  draftId: draft.id,
  filmId: '55555555-5555-4555-8555-555555555555',
  status: 'processing',
  phaseLabel: 'Creating movement',
  creditState: 'held',
  failureCode: null,
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
  sourcePreviewUrl: SAMPLE.dog,
  sourceWidth: 458,
  sourceHeight: 415,
};

export const failedJob: Job = { ...job, status: 'failed', phaseLabel: 'Didn’t finish', creditState: 'released', failureCode: 'provider_rejected' };

export const readyFilm: Film = {
  id: job.filmId,
  draftId: draft.id,
  jobId: job.id,
  title: 'Beach day',
  status: 'ready',
  posterUrl: SAMPLE.dog,
  originalUrl: SAMPLE.dog,
  playbackUrl: SAMPLE.dogVideo,
  durationSeconds: 10,
  createdAt: FIXED_NOW,
  creditReturned: false,
  width: 458,
  height: 415,
  isDemoRender: true,
};

export const creatingFilm: Film = {
  id: '66666666-6666-4666-8666-666666666666',
  draftId: '77777777-7777-4777-8777-777777777777',
  jobId: '88888888-8888-4888-8888-888888888888',
  title: 'Friday night',
  status: 'creating',
  posterUrl: SAMPLE.restaurant,
  originalUrl: SAMPLE.restaurant,
  playbackUrl: null,
  durationSeconds: null,
  createdAt: FIXED_NOW,
  creditReturned: false,
  jobStatus: 'processing',
  phaseLabel: 'Creating movement',
};

export const olderFilm: Film = {
  id: '99999999-9999-4999-8999-999999999999',
  draftId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  jobId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  title: 'Park picnic',
  status: 'ready',
  posterUrl: SAMPLE.family,
  originalUrl: SAMPLE.family,
  playbackUrl: null,
  durationSeconds: 10,
  createdAt: '2026-09-21T10:00:00.000Z',
  creditReturned: false,
};

const extra = (id: string, title: string, poster: string, createdAt: string): Film => ({
  id,
  draftId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  jobId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  title,
  status: 'ready',
  posterUrl: poster,
  originalUrl: poster,
  playbackUrl: null,
  durationSeconds: 10,
  createdAt,
  creditReturned: false,
});

/** 09 review: five ready films (hero + 2×2 grid), matching the "All 5 · Ready 5 · Creating 0" mock. */
export const galleryFilms: Film[] = [
  readyFilm,
  extra('99999999-9999-4999-8999-999999999991', 'Mountain escape', SAMPLE.restaurant, '2026-09-24T18:00:00.000Z'),
  extra('99999999-9999-4999-8999-999999999992', 'Afternoon light', SAMPLE.family, '2026-09-23T12:00:00.000Z'),
  extra('99999999-9999-4999-8999-999999999993', 'Those blue eyes', SAMPLE.dog, '2026-09-22T12:00:00.000Z'),
  { ...olderFilm, title: 'Under the pier', posterUrl: SAMPLE.restaurant, originalUrl: SAMPLE.restaurant },
];

export const creditsThree: Credits = { available: 3, held: 0, purchasedAvailable: 3, monthlyAvailable: 0, nextExpiryAt: null };
export const creditsTwo: Credits = { available: 2, held: 1, purchasedAvailable: 2, monthlyAvailable: 0, nextExpiryAt: null };
export const creditsZero: Credits = { available: 0, held: 0, purchasedAvailable: 0, monthlyAvailable: 0, nextExpiryAt: null };
export const creditsFive: Credits = { available: 5, held: 0, purchasedAvailable: 5, monthlyAvailable: 0, nextExpiryAt: null };
export const creditsSubscriber: Credits = { available: 12, held: 0, purchasedAvailable: 5, monthlyAvailable: 7, nextExpiryAt: '2026-10-24T16:00:00.000Z' };

export const subscriptionActive: Subscription = {
  status: 'active',
  plan: 'monthly_10',
  currentPeriodEnd: '2026-10-24T16:00:00.000Z',
  cancelAtPeriodEnd: false,
  scheduledPlan: null,
  nextAmountCents: 2900,
  monthlyAvailable: 7,
  monthlyIssued: 10,
  purchasedAvailable: 5,
};

export const subscriptionNone: Subscription = { status: 'none', plan: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, scheduledPlan: null, nextAmountCents: null };

export const reviewCheckout: Checkout = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  stripeSessionId: 'mock_review',
  clientSecret: '',
  product: CATALOG.find((p) => p.code === 'pack_5')!,
  draftId: draft.id,
  fulfillmentStatus: 'pending',
  amountTotalCents: 1900,
  currency: 'usd',
  taxCents: 0,
  draftPreviewUrl: SAMPLE.dog,
  provider: 'mock',
  status: 'open',
};

export const reviewPaymentStatus: PaymentStatus = {
  status: 'fulfilled',
  creditsAdded: 5,
  draftId: draft.id,
  receiptUrl: '#receipt',
  product: CATALOG.find((p) => p.code === 'pack_5')!,
  amountTotalCents: 1900,
  mode: 'payment',
  draftPreviewUrl: SAMPLE.dog,
};
