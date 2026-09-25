# Build, setup and deploy runbook

## Development before keys
Install a supported Node LTS and package manager. Claude scaffolds the app and pins dependency versions. Copy .env.example -> .env.local and choose mock mode. Use local fixtures, labeled mock authentication and payments. Start web and worker separately in development. Do not require credentials to inspect the 21 screen states. The handoff itself only requires Node for reference tests and Python/Pillow for package validation.

## Configure live services
1. Supabase: create project; apply reviewed migrations and RLS; private buckets; configure email OTP template to include the six-digit token and production SMTP; register Apple/Google redirect URLs; set canonical web origin. Test OAuth callback retains draft; Apple provider setup requires its own credentials.
2. OpenAI: add server OPENAI_API_KEY; model gpt-6-astra. Verify access in a controlled staging request. No need to paste key in chat or commit it.
3. Higgsfield: developer API account/balance; HF_CREDENTIALS key ID + secret; endpoint configured as supplied. This is separate from consumer plan/plugin credits.
4. Stripe: test and live keys separated, five products/Price IDs, customer portal config, signing secret, webhook URL, enabled payment methods, registered wallet domain, tax settings decided by owner. App startup verifies catalog mapping. Do not charge real cards in automated tests.
5. Storage/worker: private media access, HEIC-capable image converter, FFmpeg, enough memory/temp disk for bounded media, outbound HTTPS controls, outbox runner with heartbeat, periodic reconciliation/expiration/purge tasks.
6. Deploy web and persistent worker as separate services. Next.js web can use a compatible managed host; worker must support long-running jobs and required binaries. Never assume a short-lived route function can render a multi-minute video reliably.

## Release checks
Domain/HTTPS, auth redirect allowlist, real policy pages, email sender, support destination, storage retention, rate limits, global generation spend cap, billing event replay, credit reconciliation, secrets redaction, backups and restore exercise, accessibility/mobile tests, no demo flag or /review public access, correct production provider credentials. Feature gates: payments, generation, quality retries, new account signup. Separate staging/live databases and Stripe customers.

## Health and observability
Track job phase durations, terminal outcome, unknown-submission count, finalization retries, credit balance reconciliation, invoice/webhook lag, per-job provider cost and failed deliveries. Alert for missing worker heartbeats, long-held reservations, provider 401/402, repeated Stripe errors and storage cleanup failures. Logging uses correlation IDs, never full private images or credentials. Add a support-friendly request reference to errors.

## Rollback
Turn off new generation intake first; allow existing known jobs to finalize. Roll back web separately from worker only with compatible schema. Do not reverse ledger entries by deleting them; compensate with explicit events. Never blindly restart all provider submissions. Maintain database migration rollback/forward recovery plan before live traffic.
