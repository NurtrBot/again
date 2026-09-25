# Data model, ownership and transaction boundaries

`contracts/schema.sql` is a migration starting point and constraint contract, not an already deployed schema. It assumes Supabase auth.users and requires application transactional functions specified here. Never treat absence of a function as permission to update balances directly from clients.

## Records
Profiles + credit_accounts: user settings and serialization lock. Media_assets: original/normalized/poster/video objects, decoded metadata and deletion state. Drafts: source, feeling and custom direction. Generations: frozen input version, status and idempotency key/payload hash. Provider_attempts: external ID and submission uncertainty. Films: customer-facing title/poster/output, soft deletion. Credit_grants/reservations/events: append-only business audit with constrained counters. Orders/subscriptions/webhook_events: authoritative billing correlation. Outbox: durable queue. Support_tickets: user-submitted support messages, never automatically sent by a bot outside configured support system.

## Required SQL functions / service transactions to implement
- reserve_generation(owner,draft,key,hash): authenticate outside, lock account row; return existing matching request if key repeated; verify validated media/draft ownership; choose credit; atomically hold one, insert job/film/reservation/event/outbox. Reject no-credit before network side effects.
- complete_generation(job,media): lock job/account/reservation; verify status eligible and storage metadata exists; capture hold and mark film ready in one transaction. Duplicate completion returns existing result.
- fail_generation(job,code): only definitive failure/abandonment; release once; failed film state in same transaction; expired-credit replacement behavior as billing doc.
- fulfill_pack(session) and fulfill_invoice(invoice): server verified object only; business-source unique grant, event mark and order/subscription update in same transaction.
- expire_grants(now), cancel_plan, schedule_plan_change, tombstone_film and account_deletion: audit and durable outbox, not client counter arithmetic.

Use explicit server-only role grants on these functions. SECURITY DEFINER functions need fixed search_path, qualified table names, revoked PUBLIC execution and authenticated owner checks. Do not expose a function that accepts arbitrary user_id to regular users. DDL supplies RLS reads; server writes remain responsible for invariants and linkage.

## Private media and upload
Never accept arbitrary user-provided remote URLs. API allocates random user-scoped object keys and signed PUT URLs (short expiry, expected MIME/size); complete endpoint independently HEADs/decodes actual object. Client reported content type, dimensions or byte count do not certify validity. Normalize before provider submission and strip metadata. Signed input URLs must outlast expected queue delay (initial 2h policy; raise safely if needed) and be generated just before submit. Do not expose public bucket URLs. Output signed URLs expire promptly; refresh only after authorization. Request download via app proxy with safe filename/content-disposition and range support as needed for playback.

Fetched provider output URLs are untrusted transport inputs: allow only HTTPS and configured trusted provider/CDN hosts, prohibit local/private/link-local IPs and credentials, revalidate every redirect and DNS resolution, enforce byte/time limits, and decode actual media. Network policy/egress guard is required in addition to simple string checks. Do not pass Authorization headers to CDN downloads. Store outputs on your own storage rather than depend on third-party retention.

## Authorization and web security
HttpOnly, Secure, SameSite cookies. Validate session on server. Mutations check Origin/CSRF token as appropriate; cookie sessions alone are not CSRF defense. Same-origin allowlist for returnTo. Rate limits: auth requests, verification attempts, upload bytes, active jobs, checkout creation; exact thresholds owner-tunable. Server errors do not enumerate accounts. CSP allows only needed payment/auth/media origins. Encrypt transport, do not log keys/source URLs. Upload moderation follows providers and product policy; never auto-bypass rejection. Frontend accessible errors never expose provider internals.

## Retention / deletion decisions
Proposed v1: authenticated drafts and unused uploads removed after 7 days; completed originals retained with film for compare; completed films kept while account active subject to an explicit storage policy. Film delete immediately hides and revokes future signed-URL issuance, then purges source only if no other film/draft references it. In-flight signed URLs can survive until short expiry. Account deletion requires recent authentication, cancels renewal, tombstones content, stops future work and purges user media via outbox. Retain only legally/operationally necessary payment audit separately; owner must finalize retention/legal copy before public launch. Deleting one film never deletes another's reused source or refunds its spent credit.
