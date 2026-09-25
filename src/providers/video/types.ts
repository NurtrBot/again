/* Video renderer interface. Implementations: higgsfield (Kling 3.0 pro I2V, the specified default),
 * sora (OpenAI Videos API, explicit alternative for testing with an OpenAI key), mock (local demo push-in). */
export type ProviderName = 'higgsfield' | 'sora' | 'mock';

export interface SubmitInput {
  generationId: string;
  attemptId: string;
  prompt: string;
  /** Normalized source image bytes (JPEG) and dims. */
  imageBytes: Buffer;
  imageMime: string;
  width: number;
  height: number;
  /** HTTPS URL a provider can fetch, when the provider needs one (null if unavailable). */
  imageUrl: string | null;
}

export interface SubmitResult {
  requestId: string;
  status: string;
}

export type PollResult = { state: 'processing'; phase: string } | { state: 'completed'; outputUrl: string | null; downloadKind: 'url' | 'provider' } | { state: 'failed'; code: string };

export class SubmissionUnknown extends Error {
  constructor(message = 'PROVIDER_SUBMISSION_UNKNOWN') {
    super(message);
    this.name = 'SubmissionUnknown';
  }
}
export class SubmissionRejected extends Error {
  status: number;
  code: string;
  constructor(status: number, code = 'provider_rejected') {
    super(`PROVIDER_REJECTED_${status}`);
    this.name = 'SubmissionRejected';
    this.status = status;
    this.code = code;
  }
}
export class ProviderUnavailable extends Error {
  constructor(message = 'PROVIDER_UNAVAILABLE') {
    super(message);
    this.name = 'ProviderUnavailable';
  }
}

export interface VideoProvider {
  readonly name: ProviderName;
  readonly model: string;
  /** Whether the provider needs an HTTPS image URL (vs. bytes). */
  readonly needsImageUrl: boolean;
  /** Approximate max USD cost per 10s job, for budget gating (owner-configured; not a claim of actual price). */
  readonly estimatedCostUsd: number;
  /** Exactly one network POST. Never retried automatically. */
  submit(input: SubmitInput): Promise<SubmitResult>;
  poll(requestId: string): Promise<PollResult>;
  /** Download the completed output to `dest`. For url kind the caller applies safe-fetch policy. */
  download(requestId: string, outputUrl: string | null, dest: string): Promise<void>;
  /** Output duration the provider produces (10 = native; 12 = must trim). */
  readonly nativeSeconds: number;
}
