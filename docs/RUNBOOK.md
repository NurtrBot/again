# Deployment runbook

## 1. Services

| Service | What | Notes |
|---|---|---|
| Web | `npm run build && npm start` (Next.js) | Any Node host. Needs `DATABASE_URL`, `APP_SECRET`, provider keys, `APP_URL` = canonical HTTPS origin. Set `REVIEW_ROUTES_ENABLED=false`, `DEV_SEED_CREDITS=0`, `APP_MODE=live`. |
| Worker | `npm run worker` | Long-running process with ffmpeg/ffprobe (bundled via `ffmpeg-static`), sharp, enough temp disk (~1 GB) and outbound HTTPS. Run ≥1 instance; leases make it safe to run several. Must not be a short-lived function. |
| Postgres | Supabase or any Postgres ≥15 | `npm run db:migrate` from CI/deploy step. With Supabase set `AUTH_DRIVER=supabase` so the local auth tables are skipped. |
| Storage | Supabase private buckets or local disk (single host only) | Buckets: `sources`, `normalized`, `films`, `thumbnails`; all private. |

## 2. Configure

1. **Supabase**: create project → apply migrations → private buckets → Auth: enable email OTP, put `{{ .Token }}` in the template, production SMTP; add Google/Apple providers and redirect URL `${APP_URL}/auth/callback`. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooler), `OAUTH_PROVIDERS`.
2. **OpenAI**: `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-6-astra`, `PLANNER_PROVIDER=astra`. Rotate any key that was ever pasted in chat.
3. **Higgsfield**: `HF_CREDENTIALS=KEY_ID:KEY_SECRET`, `HF_MODEL=kling-video/v3.0/pro/image-to-video`, `VIDEO_PROVIDER=higgsfield`, `PROVIDER_MEDIA_ALLOWED_HOSTS=<vendor cdn hosts>`; source URLs come from Supabase signed URLs (TTL `PROVIDER_INPUT_URL_TTL_SECONDS`).
4. **Stripe**: products/prices for `pack_1/5/10`, `monthly_10`, `creator_25` → `STRIPE_PRICE_*`; `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; webhook endpoint `${APP_URL}/api/webhooks/stripe` subscribed to `checkout.session.*`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.*`, `charge.refunded`, `charge.dispute.created` → `STRIPE_WEBHOOK_SECRET`; customer portal enabled; tax settings decided by owner; wallet domain registered. `PAYMENTS_PROVIDER=stripe`.
5. **Budgets/gates**: `GENERATION_ENABLED`, `PAYMENTS_ENABLED`, `MAX_ACTIVE_JOBS_PER_USER`, `GLOBAL_GENERATION_CONCURRENCY`, `DAILY_PROVIDER_BUDGET_USD`, `MAX_JOB_PROVIDER_COST_USD`, `UNKNOWN_SUBMISSION_SLA_HOURS`, `QUALITY_REVIEW_ENABLED=false`.
6. **Policies**: replace `/terms` and `/privacy` drafts with owner-approved text; set `SUPPORT_EMAIL`.

## 3. Release checks

- `/api/health` returns `ok:true`, `worker: ok`, `appMode: live`; `/review` and `/dev/inbox` return 404 in production.
- Stripe test purchase → credits; replayed webhook → no duplicate; `invoice.paid` before `checkout.session.completed` → one grant.
- One staging generation per photo class; verify decode/duration/cost; failure returns exactly one credit.
- Mobile checks: iPhone Safari 393×852, Android 360×800, 430×932, landscape, keyboard open; desktop 1440.
- Secrets never in logs (`[api …]` lines log codes/messages only). Back up the database; rehearse restore.

## 4. Operate

- **Unknown submission** (`[reconcile] OPERATOR` log lines, `provider_attempts.state='unknown'`): check the vendor dashboard for a charge/result within `UNKNOWN_SUBMISSION_SLA_HOURS`; if found, set `provider_request_id` on the attempt and requeue `poll_generation`; otherwise the worker abandons the job and returns the credit once.
- **Long-held reservations** (`[maintenance]` warning): inspect `generations` stuck in `processing`; never edit ledger rows by hand — use `scripts/grant-credits.ts` for goodwill credits.
- **Provider 401/402** (`ProviderUnavailable`): intake pauses per job (retried up to 12 times over an hour); fix credentials/funds; jobs resume automatically.
- **Refund/dispute**: handled by webhooks; accounts with consumed credits from a refunded source get `spending_blocked=true` and need manual review (`credit_accounts.review_reason`).

## 5. Rollback

Set `GENERATION_ENABLED=false` first (lets in-flight jobs finish), then roll web and worker independently only with a compatible schema. Ledger rows are append-only; compensate with events, never delete. Never restart provider submissions blindly.
