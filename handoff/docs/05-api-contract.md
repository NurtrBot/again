# Application-owned API contracts

The machine-readable definition is `contracts/openapi.json` (OpenAPI 3.1). These are routes Claude must implement, not claims that endpoints are live. Provider adapters are separate.

## Conventions
JSON bodies except signed raw Stripe webhook and binary media download. All protected operations verify the actual server session and ownership. UUID resources belonging to another user return neutral 404. All cookie-authenticated mutations require CSRF/Origin protection. Errors: `{error:{code,message,requestId,retryable,fieldErrors}}`; no stack traces/secrets. Client never supplies user ID, provider model/prompt/URL, price or entitlement quantities. Null media dimensions during validation are represented as 0 until ready in this contract.

Mutations with Idempotency-Key store owner/key/payload hash and return prior result for identical retries. Reused key with different payload -> 409. Dynamic draft expectedVersion prevents edits racing a generation. 402 only means customer insufficient credits; owner provider-out-of-funds -> 503. 429 includes Retry-After.

## Endpoints
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/v1/auth/otp` | Start unified sign in or signup. Rate limit email and IP; no account enumeration. |
| POST | `/api/v1/auth/verify` | Verify challenge and set HttpOnly session cookies; validate same-origin return path. |
| POST | `/api/v1/auth/oauth` | Start configured Apple or Google OAuth with PKCE and retained draft. |
| POST | `/api/v1/auth/signout` | End current session and clear cookies. |
| GET | `/api/v1/me` | Return authenticated profile. |
| PATCH | `/api/v1/me` | Update profile fields or onboarding; do not allow email mutation here. |
| POST | `/api/v1/uploads` | Allocate owner-scoped private storage key and signed PUT. |
| POST | `/api/v1/uploads/{mediaId}/complete` | Validate actual bytes and enqueue decoding. Metadata supplied by client is not trusted. |
| GET | `/api/v1/uploads/{mediaId}` | Read upload validation state after complete. |
| POST | `/api/v1/drafts` | Create owned draft from validated owned source; default gentle. |
| GET | `/api/v1/drafts/{draftId}` | Get owned draft and short-lived preview. |
| PATCH | `/api/v1/drafts/{draftId}` | Versioned update; only allow source replacement by another owned validated media item. |
| POST | `/api/v1/generations` | Atomically reserve one credit and enqueue generation. No provider work inside HTTP handler. |
| GET | `/api/v1/generations/{jobId}` | Read owned job; no mutation or generation triggered. |
| GET | `/api/v1/films` | Cursor-paginated owner gallery excluding deleted items. |
| GET | `/api/v1/films/{filmId}` | Return owner film with expiring URLs or creating/failed state. |
| PATCH | `/api/v1/films/{filmId}` | Rename owned film; no arbitrary media updates. |
| DELETE | `/api/v1/films/{filmId}` | Idempotently tombstone owned film; enqueue safe media purge; no credit refund. |
| GET | `/api/v1/films/{filmId}/download` | Stream verified stored output. Ready only, auth checked each request. |
| GET | `/api/v1/catalog` | Public server catalog; no Stripe secret Price IDs exposed. |
| GET | `/api/v1/credits` | Calculate spendable, held and expiring balances from ledger. |
| GET | `/api/v1/credits/history` | Owner-scoped paginated credit events. |
| POST | `/api/v1/billing/checkout` | Server-validate product and create Elements session; reject duplicate active subscriptions. |
| GET | `/api/v1/billing/checkout/{checkoutId}` | Return checkout only to its owner; include authoritative totals. |
| GET | `/api/v1/billing/session-status` | Reconcile payment/fulfillment for owner; query string is never proof of payment. |
| GET | `/api/v1/billing/subscription` | Owner subscription with current and scheduled terms. |
| POST | `/api/v1/billing/subscription/change` | Schedule supported plan for next renewal, no immediate proration. |
| POST | `/api/v1/billing/subscription/cancel` | Cancel at period end after user confirmation. |
| POST | `/api/v1/billing/subscription/resume` | Clear scheduled cancellation when still resumable. |
| POST | `/api/v1/billing/portal` | Create Stripe portal for current customer; fixed allowlisted return URL. |
| POST | `/api/v1/account/deletion` | Require recent reauthentication; cancel renewal and enqueue deletion, retain required audit. |
| POST | `/api/v1/support` | Create support ticket for current user; validate optional owned job ID. |
| POST | `/api/webhooks/stripe` | Raw signature verification, durable unique event intake, separate transactional fulfillment. |

## Auth callback route
`GET /auth/callback` exchanges OAuth authorization code under the configured PKCE flow; validate state and same-origin returnTo, then set session cookies. This is an auth-library callback, not a JSON REST endpoint. OTP challenge ID belongs to server session; email must not be encoded in a public URL.

## Gallery/download
Signed source/playback URLs are returned only after ownership verification, not persisted in the browser as permanent identifiers. Download uses an authenticated proxy or an equally scoped signed attachment URL; support byte ranges if proxying playback. Sharing uses a prepared File and fresh user gesture. No public share-link API in v1. Outbox workers never rely on browser calls to keep running.

## Higgsfield callbacks
v1 uses authenticated server polling. No unauthenticated external callback may finalize a job. Higgsfield webhook signing details were not retrievable in this review; therefore do not invent a signature header or verifier. Add callbacks only after verifying the vendor protocol, and re-fetch authoritative job status before applying any result. Polling/reconciliation remains the source of truth.
