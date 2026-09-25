/* Shared API/UI types. Shapes follow handoff/contracts/openapi.json exactly. */
import type { Feeling } from './helpers';
import type { Product, ProductCode, PlanCode } from './catalog';

export type { Feeling, Product, ProductCode, PlanCode };

export interface ApiError {
  error: { code: string; message: string; requestId: string; retryable: boolean; fieldErrors: Record<string, string> };
}

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  onboardingComplete: boolean;
}

export interface AuthChallenge {
  challengeId: string;
  resendAfterSeconds: number;
  /** Present only in demo mode (AUTH_DRIVER=local + MAIL_DRIVER=console). */
  demoCode?: string;
  emailMasked?: string;
}

export interface AuthSuccess {
  nextPath: string;
  isNewUser: boolean;
}

export interface UploadTicket {
  mediaId: string;
  uploadUrl: string;
  expiresAt: string;
  headers: Record<string, string>;
}

export type MediaStatus = 'pending' | 'validating' | 'ready' | 'rejected';
export interface Media {
  id: string;
  status: MediaStatus;
  width: number;
  height: number;
  errorCode: string | null;
}

export type DraftStatus = 'validating' | 'ready' | 'generating' | 'completed' | 'invalid';
export interface Draft {
  id: string;
  mediaId: string;
  feeling: Feeling;
  direction: string;
  version: number;
  sourcePreviewUrl: string;
  status: DraftStatus;
  /** Extra (not in the OpenAPI minimum): aspect ratio helps stable layout. */
  width?: number;
  height?: number;
  activeJobId?: string | null;
}

export type JobStatus =
  | 'queued'
  | 'planning'
  | 'submitting'
  | 'submission_unknown'
  | 'processing'
  | 'validating_output'
  | 'ready'
  | 'failed'
  | 'abandoned';
export type CreditState = 'held' | 'captured' | 'released';

export interface Job {
  id: string;
  draftId: string;
  filmId: string;
  status: JobStatus;
  phaseLabel: string;
  creditState: CreditState;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
  /** Extras used by the UI. */
  sourcePreviewUrl?: string | null;
  sourceWidth?: number;
  sourceHeight?: number;
  planSummary?: string | null;
  /** Median seconds from Animate to Ready over recent films (for pacing the reveal; never shown as a percentage). */
  expectedSeconds?: number;
}

export type FilmStatus = 'creating' | 'ready' | 'failed';
export interface Film {
  id: string;
  draftId: string;
  jobId: string;
  title: string;
  status: FilmStatus;
  posterUrl: string | null;
  originalUrl: string | null;
  playbackUrl: string | null;
  durationSeconds: number | null;
  createdAt: string;
  creditReturned: boolean;
  /** Extras. */
  jobStatus?: JobStatus;
  phaseLabel?: string;
  width?: number;
  height?: number;
  isDemoRender?: boolean;
}

export interface FilmList {
  items: Film[];
  nextCursor: string | null;
}

export interface Credits {
  available: number;
  held: number;
  purchasedAvailable: number;
  monthlyAvailable: number;
  nextExpiryAt: string | null;
}

export interface CreditEntry {
  id: string;
  kind: string;
  amount: number;
  createdAt: string;
  filmId: string | null;
  description: string;
}
export interface CreditHistory {
  items: CreditEntry[];
  nextCursor: string | null;
}

export interface Catalog {
  products: Product[];
  version: string;
}

export type CheckoutFulfillment = 'pending' | 'fulfilled' | 'failed';
export interface Checkout {
  id: string;
  stripeSessionId: string;
  clientSecret: string;
  product: Product;
  draftId: string | null;
  fulfillmentStatus: CheckoutFulfillment;
  amountTotalCents: number;
  currency: string;
  /** Extras. */
  taxCents?: number | null;
  draftPreviewUrl?: string | null;
  provider?: 'mock' | 'stripe';
  status?: 'open' | 'pending' | 'fulfilled' | 'failed' | 'canceled';
}

export interface PaymentStatus {
  status: 'open' | 'pending' | 'fulfilled' | 'failed';
  creditsAdded: number;
  draftId: string | null;
  receiptUrl: string | null;
  /** Extras. */
  product?: Product | null;
  amountTotalCents?: number | null;
  mode?: 'payment' | 'subscription';
  draftPreviewUrl?: string | null;
}

export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled' | 'incomplete';
export interface Subscription {
  status: SubscriptionStatus;
  plan: PlanCode | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  scheduledPlan: string | null;
  nextAmountCents: number | null;
  /** Extras. */
  monthlyAvailable?: number;
  monthlyIssued?: number;
  purchasedAvailable?: number;
}

export interface SupportTicket {
  ticketId: string;
  status: 'received';
}

export const PHASE_LABELS: Record<JobStatus, string> = {
  queued: 'Photo received',
  planning: 'Photo received',
  submitting: 'Creating movement',
  submission_unknown: 'Creating movement',
  processing: 'Creating movement',
  validating_output: 'Finishing your film',
  ready: 'Ready',
  failed: 'Didn’t finish',
  abandoned: 'Didn’t finish',
};

export const UPLOAD_ERROR_COPY: Record<string, { title: string; body: string; filename?: boolean }> = {
  unsupported_type: { title: 'This file type isn’t supported.', body: 'Choose a JPG, PNG or HEIC under 20 MB.' },
  too_large: { title: 'This photo is too large.', body: 'Choose a JPG, PNG or HEIC under 20 MB.' },
  unreadable: { title: 'We couldn’t read this photo.', body: 'The file looks damaged or isn’t a photo. Try another JPG, PNG or HEIC.' },
  too_small: { title: 'This photo is too small.', body: 'Choose a photo at least 256 pixels on its shortest side.' },
  too_many_pixels: { title: 'This photo is too big to process.', body: 'Choose a photo under 40 megapixels.' },
  animated: { title: 'Animated images aren’t supported.', body: 'Choose a single still JPG, PNG or HEIC.' },
  heic_unsupported: { title: 'HEIC isn’t available here yet.', body: 'Export the photo as a JPG or PNG and try again.' },
  upload_interrupted: { title: 'The upload didn’t finish.', body: 'Check your connection and choose the photo again. No credits were used.' },
  missing: { title: 'We couldn’t find that upload.', body: 'Choose the photo again.' },
};

export const FAILURE_COPY: Record<string, string> = {
  provider_rejected: 'The animation service couldn’t work with this photo.',
  content_policy: 'This photo can’t be animated under the provider’s content rules.',
  output_invalid: 'The finished video didn’t pass our checks.',
  planner_refused: 'We couldn’t plan safe movement for this photo.',
  planner_unavailable: 'Our planning service was unavailable.',
  provider_unavailable: 'The animation service was unavailable.',
  abandoned: 'The animation service never confirmed this film.',
  timeout: 'This took too long and was stopped.',
  default: 'We couldn’t complete your video.',
};
