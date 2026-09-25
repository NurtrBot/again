# again.

A private photo-to-video web app. A customer picks one photo, signs in with an email code, chooses **Gentle / Lively / Surprise me**, pays if needed, and gets a downloadable ten-second film. `gpt-6-astra` plans believable motion; a video renderer (Kling 3.0 through Higgsfield by default) makes the clip; a persistent worker keeps jobs alive when the tab closes; **My films** is a private gallery; a failed delivery returns the reserved credit exactly once.

Built from the approved seven-board handoff in [`handoff/`](handoff/) (kept intact). Read `handoff/START_HERE_CLAUDE.md` for the product contract.

## What is here

| Area | Status |
|---|---|
| 21 approved screens (`/review/01`–`/review/21`) | Built, pixel-compared at 390px (see `e2e/__compare__`, `/review/sheet`) |
| Mock/demo mode (no keys) | Full journeys work: sign-in with on-screen code, upload, direction, generation (local demo render), gallery, share/download/delete, mock checkout, subscriptions |
| Postgres schema, ledger, outbox worker | Implemented and tested (23 unit/integration tests, 3 browser journeys, API smoke script) |
| `gpt-6-astra` planner | **Live-verified** with the supplied key (scripts/test-astra.ts) |
| Higgsfield Kling 3.0 renderer | Implemented from the vendor contract; **not live-tested** (no HF credentials yet) |
| OpenAI Sora renderer | Implemented as an explicit alternative; **unusable today** (`sora-2`/`sora-2-pro` show `shutdown_date: 2026-09-24` and `/v1/videos` returns 404) |
| Stripe Checkout (Elements) + webhooks + portal + schedules | Implemented against current docs; **not live-tested** (no Stripe keys) |
| Supabase Auth/Storage drivers | Implemented; **not live-tested** (no project) |

See [`docs/UNTESTED.md`](docs/UNTESTED.md) for the explicit list of live integrations still to be verified and [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for deployment.

## Quick start (local, no provider keys)

Requirements: Node ≥ 22, Postgres ≥ 15 running locally (Homebrew `postgresql@17` works), ~1 GB disk.

```sh
npm install                       # pinned versions, lockfile committed
createdb again_dev && createdb again_test
cp .env.example .env.local        # set APP_SECRET; defaults are demo mode
npm run db:migrate                # applies supabase/migrations/*.sql
npm run samples:build             # renders the labeled sample clips (ffmpeg is bundled)
npm run dev                       # web on http://localhost:3100 + worker
```

Then open http://localhost:3100 on your phone or in a mobile viewport. Demo mode shows a yellow banner. The sign-in code appears in that banner (and at `/dev/inbox`). Every **new** account in demo mode receives `DEV_SEED_CREDITS` test credits (default 10).

Give an existing account more test credits:

```sh
npm run credits:grant -- you@example.com 25 "Testing"
```

Useful routes: `/review` (all 21 states), `/review/sheet` (board vs. app contact sheet), `/dev/inbox` (demo mail), `/api/health`.

## Modes and providers

Everything is selected by environment (see `.env.example`). `APP_MODE=mock` forces demo adapters; `APP_MODE=live` uses whatever each provider variable says, so you can mix, e.g. real planner + demo renderer:

```
APP_MODE=live
PLANNER_PROVIDER=astra   OPENAI_API_KEY=sk-...   OPENAI_MODEL=gpt-6-astra
VIDEO_PROVIDER=mock      # or higgsfield (needs HF_CREDENTIALS + PUBLIC_MEDIA_BASE_URL or Supabase storage)
PAYMENTS_PROVIDER=mock   # or stripe
AUTH_DRIVER=local        # or supabase
STORAGE_DRIVER=local     # or supabase
```

Rules enforced in code: no generation from a GET, reload, payment return or webhook; one credit = one delivered film; credits are reserved transactionally and settled exactly once; provider POSTs are never auto-retried (ambiguous outcomes are reconciled, then abandoned after `UNKNOWN_SUBMISSION_SLA_HOURS` with one credit return); customer credits and provider billing are separate; no provider keys reach the browser; demo output is labeled.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | web + worker (dev) · `npm run dev:web` / `npm run worker:dev` separately |
| `npm run build && npm start` | production web · `npm run worker` production worker |
| `npm run db:migrate` / `npm run db:reset` | migrations (reset only on dev/test DB names) |
| `npm test` | vitest: adapters + DB-backed ledger/billing tests (uses `DATABASE_TEST_URL`) |
| `npm run test:e2e` | Playwright browser journeys + review-route screenshots (needs `npm run dev` running) |
| `node scripts/smoke-journey.mjs` | API-level end-to-end journey against the running app |
| `node e2e/compare.mjs [ids]` | screenshot `/review/NN` and diff against the board panel |
| `npx tsx scripts/test-astra.ts <image> <feeling>` | one live planner call (spends a few cents) |
| `npm run handoff:test` | the handoff package's own offline tests |

## Repository map

```
app/                 Next.js App Router routes (pages, /api/v1/**, /api/webhooks/stripe, /media/** local storage transport)
src/screens/         The 21 screens + supporting pages (client components, fixture-renderable)
src/ui/              Design-system primitives, icons, API client, IndexedDB draft store, upload client
src/domain/          Catalog, copy, types (match handoff/contracts/openapi.json), pure helpers
src/server/          env, db, http helpers, auth (local + Supabase), storage (local + Supabase), services (media, credits, drafts, generations, films, billing, webhooks)
src/providers/       astra (planner), video/{higgsfield,sora,mock}, stripe, ffmpeg, safe-fetch
worker/              Outbox runner + tasks (normalize, plan, submit, poll, finalize, reconcile, purge, expiry)
supabase/migrations/ Schema (from handoff), helpers, RLS
tests/               vitest suites · e2e/ Playwright + reference panels · scripts/ operator tools
public/samples/      Labeled sample media (see PROVENANCE.md — replace before launch)
docs/                RUNBOOK, UNTESTED, SCREEN-CHECKLIST
```
