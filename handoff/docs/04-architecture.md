# Application architecture

## Concrete stack
- Web: Next.js App Router, React, TypeScript, component CSS using supplied tokens. Use App Router route handlers for app APIs. Resolve supported stable versions at build start and pin them with a lockfile; do not infer a version from this document's date.
- Identity: Supabase Auth email OTP plus configured Apple/Google OAuth, server-side cookie sessions.
- Data: Supabase Postgres; migrations, RLS, transactional credit ledger and outbox.
- Media: private Supabase Storage buckets `sources`, `normalized`, `films`, `thumbnails`. Signed browser URLs; a signed read URL for a normalized source is issued just before provider submission.
- Worker: separately deployed persistent Node process, with FFmpeg/ffprobe and image decoder. Poll Postgres outbox using leases and SKIP LOCKED. No Redis dependency necessary for v1.
- Commerce: Stripe Checkout Sessions with Elements inside branded /checkout; webhook-backed grants and customer portal for provider-managed billing details.
- Providers: direct Responses HTTP adapter for Astra and direct Higgsfield REST adapter for Kling, isolated behind interfaces. MCP was used to create the reference clip; the production website uses developer APIs.

## Suggested monorepo
```
apps/web/app/(public)/page.tsx
apps/web/app/auth/page.tsx
apps/web/app/auth/verify/page.tsx
apps/web/app/auth/callback/route.ts
apps/web/app/(member)/onboarding/page.tsx
apps/web/app/(member)/create/page.tsx
apps/web/app/(member)/create/[draftId]/page.tsx
apps/web/app/(member)/create/[draftId]/processing/page.tsx
apps/web/app/(member)/films/page.tsx
apps/web/app/(member)/films/[filmId]/page.tsx
apps/web/app/(member)/films/[filmId]/share/page.tsx
apps/web/app/(member)/credits/page.tsx
apps/web/app/(member)/checkout/[checkoutId]/page.tsx
apps/web/app/(member)/checkout/success/page.tsx
apps/web/app/(member)/account/**/page.tsx
apps/web/app/api/v1/**/route.ts
apps/web/app/api/webhooks/stripe/route.ts
apps/web/app/review/[screenId]/page.tsx
apps/worker/src/{runner,planner,submitter,poller,finalizer,cleanup}.ts
packages/domain/src/{credits,jobs,billing,schemas}.ts
packages/providers/src/{astra,higgsfield,stripe,storage}.ts
packages/ui/src/**
supabase/migrations/**.sql
```

## Trust boundaries
The browser submits a draft ID and style; it never submits the provider prompt, model, price, user ID, credit amount or a source URL for arbitrary remote fetching. Server loads owner-scoped normalized media and compiles the provider request. Stripe secret and provider credentials only exist server-side. Browser sees a Stripe publishable key and user-scoped short-lived client secrets, never a service role key.

Service role bypasses RLS: all handlers and worker helpers require explicit user ID predicates and same-owner constraints. Use anon/authenticated role for user reads where possible; service role only for signed upload creation, worker and verified billing services. Do not trust browser-claimed ownership of an object path.

## Worker lifecycle
1. API transaction locks owner credit account, validates draft/media, checks unique (user,idempotency key + payload hash), reserves a valid credit, creates generation + film placeholder + outbox record. Commit, return 202.
2. Worker leases planning task. Persist lease owner/expiry, increment attempt count, heartbeat; stale leases can be reclaimed. Call Astra, validate/store plan and version, move job to submitting via compare-and-set.
3. Create provider attempt with state sending and unique attempt ordinal. Network POST occurs OUTSIDE database transaction. Disable automatic retries of this POST. Persist provider request ID before polling. A crash between provider acceptance and persistence requires reconciliation, not a blind second render.
4. With ID known, poll using independent durable tasks. Store last response status/timestamp. A poll timeout/5xx is not terminal; retry GET with bounded backoff/jitter. Incomplete source-signature TTL must be avoided through adequate validity and just-in-time URL creation.
5. On provider success, fetch result from provider-controlled HTTPS URL after validation, inspect metadata, persist into private storage, create preview and optionally QA samples. Retry storage/finalization on the SAME output, not a new generation.
6. Ready transition and credit capture commit in one transaction after durable output exists. Failure/release commits in one transaction. Only then update customer-facing return/refund copy. At-least-once worker delivery is safe because operations are idempotent.

## Outbox / scheduling
Outbox event types: plan_generation, submit_generation, poll_generation, finalize_generation, release_generation, delete_media, expire_grants, reconcile_payment, reconcile_unknown_submission, delete_account. Payload contains IDs, not credentials or raw photos. A unique dedupe key protects each logical action. Concurrency starts at two active generations per user and a server-configured global cap; provider budget/concurrency controls override. Lease is e.g. 60s renewed every 15s; processes release safely on shutdown. Do not hold SQL locks across network operations.

## Mock mode
`APP_MODE=mock` runs deterministic provider/storage/auth/payment adapters and a mock job clock. Seed balances are fixtures, not production grants. UI displays 'Demo mode — no payments or real generation'. Local file previews can display selected files; mock finished video must be labeled prerecorded example and is allowed only in review/demo. A production boot with APP_MODE=mock is rejected unless deployment is explicitly an owner-private staging demo with a visible banner. Review routes are not public production routes.

## Operational reliability
Track correlation ID, job ID, attempt ordinal, provider request ID, logical payment source ID and costs. Redact photos, prompts containing private descriptions, signed query strings, tokens and secrets from logs. Health endpoints expose no credentials. Any unknown submission triggers an operator task; after service SLA (proposed 24h) close delivery and restore credit exactly once, marking abandonment so late output is quarantined and cannot silently capture again. Web request polling never controls worker lifetime.
