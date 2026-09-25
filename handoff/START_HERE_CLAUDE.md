# Build again. faithfully, end to end

You are implementing a production-oriented mobile web app, not inventing its design. The owner approved the electric cobalt concept and then seven boards covering 21 screens. This package is the project source of truth.

## Mission
A customer selects a photo, signs in with minimal friction, chooses Gentle / Lively / Surprise me, pays if needed, and receives a downloadable ten-second video. Astra examines the image and proposes believable motion. Kling 3.0 through Higgsfield makes the video. Jobs continue when the tab closes. My films is a private personal gallery. Failed delivery restores the reserved credit once.

## Deliverable repository
Create the runnable app at `app/` (or a clearly named sibling if integrating an existing repository). Keep this handoff intact. Use `apps/web`, `apps/worker`, `packages/domain`, `packages/providers`, `packages/ui`, and `supabase/migrations` if a monorepo is helpful. Provide a root README with exact commands, pinned dependencies, .env examples, migration and seed scripts, mock/live commands, tests and deployment instructions.

## Build sequence and required gates
1. **Reference audit:** open every board; list screen IDs 01–21, extracted copy and any unavoidable platform differences. Do not substitute mockup imagery with emojis. Implement normalized tokens and use local font files. Source separate demo media or create a documented placeholder for private review, never ship screenshots as the app.
2. **No-key visual app:** all 21 states, routing, navigation, dialogs, accessible controls, mock fixtures and `/review/[screenId]`; preserve draft across sign-in and payment. Clearly labeled demo mode, including mock payment. The owner can inspect on mobile without provisioning accounts.
3. **Functional mock journeys:** choose photo -> mock signin -> short onboarding -> direction -> out-of-credit purchase -> return -> explicit animate -> progressing -> ready -> gallery -> share/download/delete. Include failure and expired OTP. Do not depend on actual camera-roll access in automated tests; use file fixtures.
4. **Backend:** schema migrations, RLS, private media upload/validation, app APIs, durable outbox worker, transactions, provider attempt audit and idempotency. Run integration tests with local database before accepting this stage.
5. **AI integration:** Responses API `gpt-6-astra`, strict scene schema, locked Kling request, polling worker, output validation, sample-frame review, durable storage. Add provider feature flag and kill switch. Offline reference adapter tests come with this package; complete live tests only when credentials are available.
6. **Commerce:** Stripe test-mode packs and subscriptions, signed webhook processing, monthly grants and expiration, duplicate/out-of-order reconciliation, portal, pending payments, rollback/compensation. Pixel-match the surrounding checkout; keep payment fields inside Stripe Elements.
7. **Hardening and polish:** screenshot comparison, real touch/keyboard testing, mobile safe areas, long names, errors, retries, network loss, a11y, cross-user authorization, logs without secrets. Finish all supporting account states in docs/12.
8. **Handoff:** provide a working app, test output, 21-screen checklist and screenshot contact sheet, deployment runbook, and an explicit list of untested live integrations. Do not describe a mock integration as production ready.

## Acceptance target
Match the original composition, cobalt, bold grotesk headlines, media scale, sharp controls and calm pacing. Standard comparison viewport is 390px wide; refer to individual panel aspect ratios for screenshot height. Also pass 360x800, 393x852, 430x932, landscape and desktop. A production mobile web page scrolls when needed; it must not shrink text to force every screen into one viewport.

## Critical behavior
- Upload before signup can stay local in IndexedDB. After auth claim/upload it and continue. No token-bearing URLs or raw files in localStorage.
- One credit = one successfully delivered 10-second film, regardless of selected feeling.
- User credits and Higgsfield's provider billing are separate systems.
- No live generation from a route GET, page reload, payment-return URL or webhook alone. The user explicitly presses Animate photo.
- Keep completed movies private. Sharing exports a video file; it does not publish a profile or public gallery.
- No fake progress percentages. Show actual phase only.
- Use real dates, email, balances, prices and titles; demo values only in fixtures.

Start with the visual inventory and implementation. Make concrete progress through all stages, without asking the owner to restate decisions already in this package.
