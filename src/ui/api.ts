/* Browser-side API client. All paths are same-origin; cookies carry the session. */
import type {
  ApiError,
  AuthChallenge,
  AuthSuccess,
  Catalog,
  Checkout,
  CreditHistory,
  Credits,
  Draft,
  Film,
  FilmList,
  Job,
  Media,
  PaymentStatus,
  Profile,
  Subscription,
  SupportTicket,
  UploadTicket,
} from '@/src/domain/types';

export class ApiFailure extends Error {
  status: number;
  code: string;
  retryable: boolean;
  fieldErrors: Record<string, string>;
  requestId: string;
  body: unknown;
  constructor(status: number, body: unknown) {
    const err = (body as ApiError)?.error;
    super(err?.message ?? `Request failed (${status})`);
    this.status = status;
    this.code = err?.code ?? 'unknown';
    this.retryable = err?.retryable ?? status >= 500;
    this.fieldErrors = err?.fieldErrors ?? {};
    this.requestId = err?.requestId ?? '';
    this.body = body;
  }
}

async function call<T>(method: string, path: string, body?: unknown, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
    signal: init.signal,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) throw new ApiFailure(res.status, json);
  return json as T;
}

export const api = {
  auth: {
    otp: (email: string, returnTo?: string) => call<AuthChallenge>('POST', '/api/v1/auth/otp', { email, returnTo }),
    verify: (challengeId: string, code: string) => call<AuthSuccess>('POST', '/api/v1/auth/verify', { challengeId, code }),
    oauth: (provider: 'apple' | 'google', returnTo?: string) => call<{ url: string }>('POST', '/api/v1/auth/oauth', { provider, returnTo }),
    signOut: () => call<{ ok: true }>('POST', '/api/v1/auth/signout'),
  },
  me: {
    get: () => call<Profile>('GET', '/api/v1/me'),
    patch: (patch: { displayName?: string; onboardingComplete?: boolean }) => call<Profile>('PATCH', '/api/v1/me', patch),
  },
  uploads: {
    create: (req: { filename: string; contentType: string; byteLength: number }) => call<UploadTicket>('POST', '/api/v1/uploads', req),
    complete: (mediaId: string) => call<Media>('POST', `/api/v1/uploads/${mediaId}/complete`),
    get: (mediaId: string) => call<Media>('GET', `/api/v1/uploads/${mediaId}`),
  },
  drafts: {
    create: (mediaId: string) => call<Draft>('POST', '/api/v1/drafts', { mediaId }),
    get: (id: string) => call<Draft>('GET', `/api/v1/drafts/${id}`),
    patch: (id: string, patch: { mediaId?: string; feeling?: string; direction?: string; expectedVersion: number }) =>
      call<Draft>('PATCH', `/api/v1/drafts/${id}`, patch),
  },
  generations: {
    create: (draftId: string, expectedDraftVersion: number, idempotencyKey: string) =>
      call<Job>('POST', '/api/v1/generations', { draftId, expectedDraftVersion }, { idempotencyKey }),
    get: (id: string) => call<Job>('GET', `/api/v1/generations/${id}`),
  },
  films: {
    list: (filter: 'all' | 'ready' | 'creating' = 'all', cursor?: string) =>
      call<FilmList>('GET', `/api/v1/films?filter=${filter}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),
    get: (id: string) => call<Film>('GET', `/api/v1/films/${id}`),
    rename: (id: string, title: string) => call<Film>('PATCH', `/api/v1/films/${id}`, { title }),
    delete: (id: string) => call<{ ok: true }>('DELETE', `/api/v1/films/${id}`),
    downloadUrl: (id: string) => `/api/v1/films/${id}/download`,
  },
  catalog: () => call<Catalog>('GET', '/api/v1/catalog'),
  credits: {
    get: () => call<Credits>('GET', '/api/v1/credits'),
    history: (cursor?: string) => call<CreditHistory>('GET', `/api/v1/credits/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  },
  billing: {
    checkout: (productCode: string, draftId?: string, idempotencyKey?: string) =>
      call<Checkout>('POST', '/api/v1/billing/checkout', { productCode, draftId }, { idempotencyKey }),
    getCheckout: (id: string) => call<Checkout>('GET', `/api/v1/billing/checkout/${id}`),
    sessionStatus: (sessionId: string) => call<PaymentStatus>('GET', `/api/v1/billing/session-status?session_id=${encodeURIComponent(sessionId)}`),
    subscription: () => call<Subscription>('GET', '/api/v1/billing/subscription'),
    change: (productCode: string) => call<Subscription>('POST', '/api/v1/billing/subscription/change', { productCode }),
    cancel: () => call<Subscription>('POST', '/api/v1/billing/subscription/cancel'),
    resume: () => call<Subscription>('POST', '/api/v1/billing/subscription/resume'),
    portal: () => call<{ url: string }>('POST', '/api/v1/billing/portal'),
    mockPay: (checkoutId: string, outcome: 'success' | 'fail' | 'cancel') =>
      call<{ redirectUrl: string }>('POST', `/api/v1/billing/checkout/${checkoutId}/mock-pay`, { outcome }),
  },
  account: {
    requestDeletion: (reauthToken: string) => call<{ ok: true }>('POST', '/api/v1/account/deletion', { confirmation: 'DELETE', reauthToken }),
  },
  support: (subject: string, message: string, jobId?: string) => call<SupportTicket>('POST', '/api/v1/support', { subject, message, jobId }),
};

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
