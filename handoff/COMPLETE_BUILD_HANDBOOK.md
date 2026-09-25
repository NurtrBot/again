# again. — Complete build handbook

September 25, 2026. Companion to the full ZIP, which contains all original images, schemas and code.


---

<!-- Source: README.md -->

# again. — Claude Code implementation handoff

Prepared September 25, 2026. This package specifies the mobile-first photo-to-video web app approved in the conversation. It includes all seven original 21-screen boards, the original approved visual direction, machine-readable route/API contracts, reference provider code, database schema, prompts, fixtures, and tests.

**Start here:** read `START_HERE_CLAUDE.md`, then let Claude read `CLAUDE.md` and the referenced documents. Open `DESIGN_REVIEW.html` to inspect all seven original boards locally. No login or network is required for the reference viewer.

## What this is
A complete implementation handoff, with runnable reference-core tests. It is not a deployed application, a finished Next.js repo, or a claim that live APIs have been tested with your credentials. Claude must build and integrate the application from these specifications.

## What to give Claude
Unzip the complete folder, open it in Claude Code, and paste:

> Read START_HERE_CLAUDE.md and CLAUDE.md. Implement again. from this handoff. Treat the seven boards and all 21 mapped states as the visual source of truth. Start with the no-key mock app and visual review routes, then implement the production backend and provider adapters. Preserve the approved design; do not redesign it. Follow the stage acceptance gates and continue through the complete scope. Record blockers and remaining live-integration checks accurately.

## Credentials later
- OpenAI API key with access to `gpt-6-astra` for scene direction.
- Higgsfield developer API key ID + secret, and a funded API balance, for rendering.
- Supabase project credentials for authentication, Postgres and private media.
- Stripe keys, webhook secret and Price IDs for money/credits.
- OAuth/SMTP configuration for the enabled sign-in choices.

Your ChatGPT subscription is not the backend credential. No keys are included. Copy `.env.example` when implementing; do not paste keys into Claude chat or source control.

## Honest fidelity target
Reproduce the approved artwork as closely as practical with real responsive controls. Generated mockups do not contain original font files, layout measurements, isolated photo assets or executable interaction definitions; therefore literal cross-device pixel identity is not a promise. The handoff supplies measured reference bounds, a fixed visual baseline, exact copy, tokens and a comparison workflow to minimize interpretation. Stripe/native OAuth and device share interfaces retain platform-controlled elements. `docs/02-design-system.md` lists the small intentional usability corrections.

## Check this package
Run `node --test tests/*.test.mjs` and `python3 tools/validate_package.py`. These run offline and do not spend API credits. `fixtures/restaurant-quality-reference.mp4` is the actual successful video from this conversation; use it for private evaluation. It is not a new user's generated result and is not cleared as public marketing media.

## Directory map
- `design/`: original boards, screen manifest, tokens.
- `docs/`: product, visual, routes, architecture, generation, billing, QA and deployment specifications.
- `contracts/`: OpenAPI, JSON schemas, example payloads and Postgres DDL.
- `reference-code/`: no-dependency Node reference adapters and behavior helpers; application integration still required.
- `prompts/`: Astra direction and evaluation instructions; original successful prompt.
- `fixtures/`: private quality reference and mock response fixtures.
- `tests/`: offline contract and failure-handling tests.
- `DESIGN_REVIEW.html`: local board and route navigator, not the app prototype.


---

<!-- Source: START_HERE_CLAUDE.md -->

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


---

<!-- Source: docs/01-product-and-flow.md -->

# Product and user flow

## Scope
Mobile-first browser app called again. A 10-second single-shot photo animation with optional natural ambience, available after purchase. Credit packs are the default offer; monthly plans are secondary. No native iOS build, no public social network, no video editor, no customer prompt engineering requirement, and no unlimited generation in v1.

## Primary journey
Landing -> choose a local photo -> unified sign in -> email code or OAuth callback -> one-page quick start for a new user -> upload/normalize saved photo -> direction -> check credits -> generation -> private playback -> My films. Returning signed-in users go directly from Create to Direction. Choosing a photo is allowed before authentication; paid external generation is not.

If credits are insufficient: Direction -> Credits -> Checkout -> verified Purchase Complete -> same Direction with photo/style/custom direction intact -> user presses Animate photo. Never auto-run on purchase. Guests opening Pricing may browse a public catalog but authenticate before checkout; the illustrated credits page is the logged-in variant.

## Proposed commercial rules
USD 1 credit $4.99; 5 credits $19; 10 credits $35. Monthly 10 credits/$29, Creator 25/$59. Prices are owner-editable server configuration, not a statement of guaranteed margins. Purchased credits do not expire. Monthly credits expire at the paid period end. Spend soonest-expiring valid credits first. No free generation grant in v1; sample media can be watched without a purchase. Demo balances on boards are illustrative.

## State transitions
Draft: local -> uploading -> validating -> ready -> generating -> completed, or a correctable upload error.
Job: queued -> planning -> submitting -> processing -> validating_output -> ready. At submission transport uncertainty: submission_unknown -> reconciliation; do not mark failed merely because a wait expired. Definitive unrecoverable failure -> failed with release. A paid attempt may continue externally even when local status is uncertain.
Film gallery: ready, creating, failed. Default All shows all non-deleted films. Ready and Creating filters are quick subsets; failed rows offer retry and state credit return only after settlement. Empty state 16 reuses /films.

## Navigation and URLs
Create / My films / Account form bottom navigation on logged-in top-level pages. Authentication, editing, checkout, processing and playback are focused routes. Closing a film returns to the prior gallery position. Back from a sheet closes it before changing routes. Query-driven sheets survive reload and direct entry, but require ownership checks.

## Draft preservation
Use IndexedDB to store source Blob and draft UUID with a 24-hour local TTL before auth. OAuth may leave/reload the origin; retain only same-origin return paths in an opaque session record. On private browsing quota errors, keep in memory and explain that sign-in may require reselection; never claim the file is saved if storage failed. After authentication, upload into a user-scoped object key and remove local source once confirmed. Store selected feeling and custom direction server-side after auth. Sign-out removes local private caches.

## Consent and privacy in product language
Just-in-time upload text explains that the photo is processed by the app's AI providers to make a film. Owner must publish actual Privacy/Terms before live payments. Private means not publicly listed; it must not imply the photo never leaves the device. Preserve watermark and existing lettering in generated output prompts. No identifiable-face accuracy guarantee.


---

<!-- Source: docs/02-design-system.md -->

# Visual fidelity and interaction system

## Authority and hierarchy
1. All seven approved PNG boards are authoritative for the look, content hierarchy and screen composition.
2. Original `00-approved-direction.png` controls brand color and type personality when later generated boards differ slightly.
3. tokens.css and screen specs normalize implementation details that the generated artwork never defined.
4. Accessibility, honest transaction state and provider/native UI requirements override nonfunctional details in mockups.

The PNGs are handoff reference images, not production UI backgrounds. Never flatten the screens into screenshots with invisible hotspots. Do not regenerate the entire design or replace it with a UI-library theme.

## Color and type
Modal cobalt pixels sampled from the approved original are RGB(2,59,243), hence `#023BF3`. Generation prompts mentioned `#173CEE`, but the visible approved image is the authority. Use one flat cobalt token; do not reproduce accidental raster noise or gradients. Ink `#0C0E11`, white `#FFFFFF`, canvas `#EFF2F7`, gray `#676D76`, line `#D7DAE1`, destructive `#C4223B`. Verify actual contrast on final rendering.

The mockups do not identify a font. Start with locally hosted Inter Tight 800 for headlines and Inter 400/500/600/700 for controls and body; IBM Plex Mono 400 for timecodes only. These are implementation selections, not claimed recovered source fonts. Adjust optical tracking/line-height to the PNG, then freeze tokens. No serif or system default headline fallback in screenshot tests. Wordmark is a small custom lowercase `again.` text treatment, weight 800, tightly tracked; do not use an image screenshot of a wordmark. Create a vector wordmark only after matching the approved typography; use CSS type initially.

## Dimensions
390px baseline width. Horizontal gutter 20px (16px at <=360px), 24px between major blocks, 12px inside rows, 32px around headline/media transitions. Header approx 56px plus safe-area top. Buttons min 56px high, 6px radius; sheet top corners 16px. Controls min 48x48px. Body 16px/1.45, helper >=12px/1.4, nav 12–14px, section title 28–32px, hero 40–50px with -0.045em tracking and 1.02 line height. Capture every screen and adjust per-state typographic wraps to supplied screenshot; do not make global font changes to fix a single page.

Credit packs, plans and tables may scroll. Bottom primary action is sticky only when it does not cover content, errors or keyboard. Reserve actual footer height in body padding. Use 100svh/100dvh deliberately and safe-area inset padding. Test iOS browser toolbar expansion, home indicator, keyboard, and rotation. Landscape views may be normal scroll layouts. Desktop extends the same app: centered creation workspace up to 1100px, gallery 2–3 columns, forms <=480px; do not invent a separate SaaS dashboard.

## Shared components
BrandMark; AppHeader; CreditBalanceLink; BottomNav; ShutterUploadButton; ViewfinderFrame; PhotoPreview; FeelingSelector; PrimaryButton; SecondaryButton; OTPInput; DraftResume; ProgressSteps; FilmPlayer; CompareControl; FilmRow; StatusBadge; ActionSheet; ConfirmDialog; CreditPackRow; PlanOption; OrderSummary; PaymentFormBoundary; InlineError; EmptyGallery; ToastRegion.

Use one outline icon family, 1.75–2px stroke, 20–24px icons, and custom simple play/shutter/viewfinder geometry. Avoid emoji and decorative icons. Movie duration is derived from media, not hard-coded to 00:10 in a real video if actual length differs by a frame.

## Motion choreography (intended behavior, not shown by PNGs)
- Shutter: pressed scale .96 for 120ms; no long ornamental ripple.
- Photo selected: 220ms translateY 8px -> 0 and fade-in; stable aspect-ratio container prevents layout shift.
- Upload -> Direction: shared photo rectangle transition <=320ms when feasible; simple crossfade fallback.
- Progress: restrained indeterminate dot pulse 1.2s; stage labels change only on real backend events.
- Ready: background transitions cobalt -> ink for 280ms then video fades in 240ms. Never autoplay audible sound without user activation.
- Sheet: 240ms translateY, scrim alpha .48. Focus moves into sheet, Escape/back closes, focus restored.
- Comparison: holding overlays original with same object-fit/position; release restores prior video state. Provide persistent keyboard toggle and accessible name.
- Reduced motion: instantaneous or short opacity transitions; all interactions remain available.

## Media fidelity
The dog, restaurant and family thumbnails in boards are not supplied as isolated production assets. Do not use an entire screenshot as an image asset in the live app or hallucinate that a stock dog is the exact original. For exact visual review, a developer may extract ONLY photographic rectangles from the supplied boards into documented local fixture assets, retaining provenance; use permitted project image tools. For launch, replace fixtures with separately licensed/owned examples and explicitly acknowledge that sample-photo pixels then differ. User-uploaded originals and generated films always come from private storage. Include sample restaurant video solely for private quality evaluation until the owner supplies marketing rights.

## Screenshot comparison
`design/screens.json` gives manually estimated panel bounds in the 1474px-wide boards. Refine bounds to the panel edge, exclude gray gutters/captions, then scale proportionally to 390px. Do not stretch to a common height: boards use different aspect ratios. Capture `/review/01` ... `/review/21` at corresponding height; compare screenshot overlay at 50% and pixel diff. Aim for major control/media bounds within 3 CSS px at baseline, correct text wrapping and no unexplained layout drift. Antialiasing, source photo differences and native payment controls are evaluated separately. Once human-reviewed implementation is accepted, save its screenshots as deterministic Playwright baselines. Do not baseline an obviously divergent screen merely to pass tests.

## Intentional corrections to artwork
- OTP Continue disabled until valid-length code; expired/invalid states added.
- All balances say credits; a film is an output item.
- Signup buttons appear only for configured OAuth providers; unavailable buttons must not be dead links.
- Stripe Elements own card entry; never replicate raw card inputs that post to our server. Apple Pay depends on actual eligibility. Final total includes confirmed tax; never charge more than displayed total.
- Step 03 onboarding text should describe saving, not generating again.
- Example numbers and dates are fixture data only. Public sample thumbnails clearly labeled.
- Main gallery floating plus respects bottom safe area and never blocks a film menu.


---

<!-- Source: docs/03-screen-specification.md -->

# Screen-by-screen implementation specification

All 21 visual states are required. Original board artwork is included unchanged. This document governs interactions, live values and intentional corrections; the PNG governs composition.

| ID | State | App route | Guard | Board/panel |
|---|---|---|---|---|
| 01 | Welcome | `/` | public | 01-arrival.png / 1 |
| 02 | Sign up or sign in | `/auth` | public | 01-arrival.png / 2 |
| 03 | Email verification | `/auth/verify` | challenge | 01-arrival.png / 3 |
| 04 | Quick start | `/onboarding` | member | 02-create.png / 1 |
| 05 | Create | `/create` | member | 02-create.png / 2 |
| 06 | Direction | `/create/{draftId}` | owner | 02-create.png / 3 |
| 07 | Creating | `/create/{draftId}/processing?job={jobId}` | owner | 03-films.png / 1 |
| 08 | Ready to watch | `/films/{filmId}` | owner | 03-films.png / 2 |
| 09 | My films | `/films` | member | 03-films.png / 3 |
| 10 | Buy credits | `/credits?tab=packs` | member | 04-payments.png / 1 |
| 11 | Monthly plans | `/credits?tab=monthly` | member | 04-payments.png / 2 |
| 12 | Checkout | `/checkout/{checkoutId}` | owner | 04-payments.png / 3 |
| 13 | Purchase complete | `/checkout/success?session_id={stripeId}` | owner | 05-account.png / 1 |
| 14 | Account | `/account` | member | 05-account.png / 2 |
| 15 | Manage membership | `/account/billing` | member | 05-account.png / 3 |
| 16 | Empty gallery | `/films` | member | 06-recovery.png / 1 |
| 17 | Photo needs attention | `/create?error=unsupported_type` | member | 06-recovery.png / 2 |
| 18 | Generation failed | `/create/{draftId}/processing?job={jobId}` | owner | 06-recovery.png / 3 |
| 19 | Film actions | `/films?actions={filmId}` | owner | 07-gallery-details.png / 1 |
| 20 | Share film | `/films/{filmId}/share` | owner | 07-gallery-details.png / 2 |
| 21 | Delete confirmation | `/films?delete={filmId}` | owner | 07-gallery-details.png / 3 |

## 01 — Welcome
- Reference: `design/references/01-arrival.png`, panel 1; review route `/review/01`.
- Theme: cobalt. Heading: **Give your photo a pulse.**. Primary action: **Choose a photo**.
- Layout: Sample photo dominates; white circular shutter; Sign in top right; Pricing footer.
- Behavior: Open native file picker; keep valid source Blob and draft UUID in IndexedDB. Then /auth with same-origin returnTo to /create/{draftId}. Sample play is a labeled example, not a generated user film.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 02 — Sign up or sign in
- Reference: `design/references/01-arrival.png`, panel 2; review route `/review/02`.
- Theme: white. Heading: **Keep your moment.**. Primary action: **Email me a code**.
- Layout: Retained draft thumbnail; Apple black, Google outline; email label and input; Terms and Privacy.
- Behavior: POST /api/v1/auth/otp; route /auth/verify. Apple and Google use OAuth start and callback. A single entry handles signup and returning users.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 03 — Email verification
- Reference: `design/references/01-arrival.png`, panel 3; review route `/review/03`.
- Theme: white. Heading: **Check your inbox.**. Primary action: **Continue**.
- Layout: Six visual OTP cells backed by one accessible input; paste/autofill; disable Continue until six digits; inline invalid/expired code.
- Behavior: POST /api/v1/auth/verify. New user -> /onboarding; returning user -> validated returnTo. Resend rate limited; changing email keeps draft.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 04 — Quick start
- Reference: `design/references/02-create.png`, panel 1; review route `/review/04`.
- Theme: white. Heading: **A little life. In three steps.**. Primary action: **Let’s make a film**.
- Layout: Three short rows: Choose a photo; Pick the feeling; Save your film. This is one page, not a questionnaire.
- Behavior: PATCH /api/v1/me onboardingComplete=true. Skip does the same. If saved draft exists, claim/upload and route to /create/{draftId}; otherwise /create.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 05 — Create
- Reference: `design/references/02-create.png`, panel 2; review route `/review/05`.
- Theme: cobalt. Heading: **What comes to life next?**. Primary action: **Choose a photo**.
- Layout: Viewfinder brackets, white shutter, small sample strip; Create/My films/Account nav. Show available credits, never a hard-coded 3.
- Behavior: Validate locally, POST /api/v1/uploads, PUT to signed URL, POST /api/v1/uploads/{id}/complete, POST /api/v1/drafts; then /create/{draftId}.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 06 — Direction
- Reference: `design/references/02-create.png`, panel 3; review route `/review/06`.
- Theme: white. Heading: **Make it move.**. Primary action: **Animate photo**.
- Layout: Gentle default; Lively; Surprise me. 1 credit / 10 seconds. Change photo retains draft style. Optional text field max 500 characters.
- Behavior: PATCH draft on style/direction change. POST /api/v1/generations with Idempotency-Key. 202 -> /create/{draftId}/processing?job={id}; 402 -> /credits?returnTo=<draft>. No automatic generation after purchase.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 07 — Creating
- Reference: `design/references/03-films.png`, panel 1; review route `/review/07`.
- Theme: cobalt. Heading: **A moment in the making.**. Primary action: **Go to My films**.
- Layout: Use original photo, never pretend it is already a video. Photo received / Creating movement / Finishing your film; no invented percentage or ETA.
- Behavior: GET /api/v1/generations/{jobId} using backoff; ready -> /films/{filmId}; terminal failure -> same processing URL error state. Closing tab does not cancel worker.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 08 — Ready to watch
- Reference: `design/references/03-films.png`, panel 2; review route `/review/08`.
- Theme: dark. Heading: **Now it’s a moment.**. Primary action: **Save film**.
- Layout: Saved to My films; playback timeline; press and keyboard-accessible toggle comparison; Animate another. Sound starts only after user gesture.
- Behavior: GET film; GET /api/v1/films/{id}/download; Share -> /films/{id}/share; compare temporarily overlays original and restores exact play time on release.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 09 — My films
- Reference: `design/references/03-films.png`, panel 3; review route `/review/09`.
- Theme: white. Heading: **My films.**. Primary action: **Create (+)**.
- Layout: Large landscape rows, title/date, durations and text statuses. Persistent bottom nav. Preserve filter and scroll when returning from playback.
- Behavior: GET /api/v1/films?filter=all|ready|creating&cursor=...; tap ready film -> playback; active item -> processing; ellipsis -> ?actions={id}.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 10 — Buy credits
- Reference: `design/references/04-payments.png`, panel 1; review route `/review/10`.
- Theme: white. Heading: **More moments. Your pace.**. Primary action: **Continue with 5 credits**.
- Layout: Cobalt top quarter; 1/$4.99, 5/$19 selected, 10/$35. One-time purchase. Purchased credits never expire; purchased credits are not cash.
- Behavior: GET /api/v1/catalog and /api/v1/credits; select pack; POST /api/v1/billing/checkout using productCode, then /checkout/{checkoutId}.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 11 — Monthly plans
- Reference: `design/references/04-payments.png`, panel 2; review route `/review/11`.
- Theme: white. Heading: **Keep creating.**. Primary action: **Choose Monthly — $29/mo**.
- Layout: 10 credits/$29 monthly; 25/$59. Clearly show recurring billing, reset rules, purchased-credit persistence, cancel anytime.
- Behavior: Choose monthly_10 or creator_25 -> billing checkout. Existing active member routes to plan management instead of creating a second subscription.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 12 — Checkout
- Reference: `design/references/04-payments.png`, panel 3; review route `/review/12`.
- Theme: white. Heading: **Make it yours.**. Primary action: **Pay {authoritative total}**.
- Layout: Retain draft thumbnail; pack vs subscription clearly distinguished; show taxes and final total from Stripe; wallet only when actually available.
- Behavior: GET /api/v1/billing/checkout/{id}; mount Stripe Elements session. Browser completes payment with Stripe; return to /checkout/success?session_id=... .
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 13 — Purchase complete
- Reference: `design/references/05-account.png`, panel 1; review route `/review/13`.
- Theme: cobalt. Heading: **You’re ready to roll.**. Primary action: **Back to my photo**.
- Layout: Do not show success just from URL query. Pending settlement says Confirming payment; no double credits on refresh; receipt links owner scoped.
- Behavior: GET /api/v1/billing/session-status?session_id=... until entitlement grant confirmed. Then display added count. If no draft, CTA Go to Create.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 14 — Account
- Reference: `design/references/05-account.png`, panel 2; review route `/review/14`.
- Theme: white. Heading: **Your account.**. Primary action: **Get more credits**.
- Layout: Avatar uses initials, no invented photo. Balance block cobalt. Credit history is distinct from monetary receipts. Three-item nav.
- Behavior: GET/PATCH /api/v1/me, GET /api/v1/credits. Profile, plans, history, privacy, support, sign out.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 15 — Manage membership
- Reference: `design/references/05-account.png`, panel 3; review route `/review/15`.
- Theme: white. Heading: **Your plan.**. Primary action: **Change plan**.
- Layout: Dates and counts are live. Cancel has one accessible confirmation, period end disclosed. No-plan state offers credit packs and monthly options.
- Behavior: GET /api/v1/billing/subscription; POST change/cancel/resume endpoints. Payment method and invoice history use authenticated Stripe customer portal.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 16 — Empty gallery
- Reference: `design/references/06-recovery.png`, panel 1; review route `/review/16`.
- Theme: white. Heading: **Your first film starts with a photo.**. Primary action: **Choose a photo**.
- Layout: No fake user films. My films nav selected. Quiet viewfinder icon; one primary action.
- Behavior: Same gallery endpoint returns empty items. Choose -> /create and file picker from user gesture; sample is explicit example.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 17 — Photo needs attention
- Reference: `design/references/06-recovery.png`, panel 2; review route `/review/17`.
- Theme: white. Heading: **Let’s try another photo.**. Primary action: **Choose another photo**.
- Layout: Unsupported file, too large, unreadable and too small each have accurate copy. Supported JPG/PNG/HEIC up to 20MB after server validation.
- Behavior: No generation request or debit. Show decoded server/local error; preserve earlier valid draft where applicable.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 18 — Generation failed
- Reference: `design/references/06-recovery.png`, panel 3; review route `/review/18`.
- Theme: white. Heading: **This one didn’t finish.**. Primary action: **Try again · 1 credit**.
- Layout: Retain original. Only show credit returned when DB settlement committed. Unknown provider outcome is still processing, not this state.
- Behavior: Confirmed terminal failure releases reservation exactly once. Retry creates a new idempotency key and job; do not reuse failed submission.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 19 — Film actions
- Reference: `design/references/07-gallery-details.png`, panel 1; review route `/review/19`.
- Theme: sheet. Heading: **Beach day**. Primary action: **Play film**.
- Layout: Sheet focus trap, escape/back closes, restore focus to ellipsis, large icon rows; date/title dynamic.
- Behavior: Play -> film route; Rename -> editable dialog and PATCH film; Download -> download API; Share -> share route; Delete -> confirm.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 20 — Share film
- Reference: `design/references/07-gallery-details.png`, panel 2; review route `/review/20`.
- Theme: dark. Heading: **Pass the moment on.**. Primary action: **Share video**.
- Layout: Share video file, no public gallery link by default. Canceling system share is not an app error; do not mark as shared until success.
- Behavior: GET owner-authorized download; prepare File then separate user tap calls navigator.share when canShare(files) permits. Otherwise download fallback.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## 21 — Delete confirmation
- Reference: `design/references/07-gallery-details.png`, panel 3; review route `/review/21`.
- Theme: sheet. Heading: **Delete this film?**. Primary action: **Keep film**.
- Layout: Keep film primary blue; Delete outlined red. No credit refund for deleting successful output; downloaded copies unaffected.
- Behavior: DELETE /api/v1/films/{id}; hide only after accepted tombstone, queue storage purge. Return to gallery and show confirmation.
- Every query/UUID is validated; owner-only resources return a neutral 404 for unauthorized access. Buttons show pending and recoverable error states. Dynamic text must fit at 200% zoom.

## Review fixtures
Review routes are deterministic render-only fixtures gated to development/staging. Populate approved sample counts, titles and dates per state; the pack purchaser and active subscriber are intentionally separate scenarios. Do not pretend all balances represent one uninterrupted transaction. Review pages never hit real payment or generation providers. Each screen supports screenshot capture with animations disabled and fonts/media loaded.


---

<!-- Source: docs/04-architecture.md -->

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


---

<!-- Source: docs/05-api-contract.md -->

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


---

<!-- Source: docs/06-generation-pipeline.md -->

# Astra + Higgsfield pipeline

## Verified division of responsibility
OpenAI `gpt-6-astra` receives text + normalized image and returns a constrained motion plan through the Responses API. Higgsfield `kling-video/v3.0/pro/image-to-video` receives that image URL plus compiled instructions and produces video. Astra does not directly render the MP4. The precise API endpoint spelling is in reference-code/higgsfield.mjs; it is not the MCP model alias `kling3_0`.

## Quality reference
The included private restaurant clip was actually generated in this conversation using Kling 3.0, mode pro, duration 10 and sound on. The initial Seedance 2.5 attempt failed; do not use that failed attempt as a quality baseline or make it the default fallback. prompts/restaurant-successful-prompt.txt preserves the successful creative instructions. That reference proves a successful sample, not a guarantee for every photo or a live test of the new developer-API integration.

## Input preparation
Accept actual decoded JPEG, PNG and HEIC/HEIF <=20 MiB; inspect magic bytes, byte size and pixel count <=40 MP, with minimum short edge 256px. Reject animated or unreadable input with specific actionable copy. Run image decoding/HEIC conversion in a resource-limited worker; verify libheif capability before advertising HEIC live. Normalize orientation once, convert sRGB, remove EXIF/location metadata, preserve original aspect ratio and the entire scene. A normalized JPEG max long edge 2560px is a starting policy; test any model-specific size restrictions before launch. Keep original and normalized variants privately. Do not colorize, beautify, remove watermarks, invent limbs or crop off faces automatically.

## Planning
`prompts/astra-director.txt` is a versioned instruction, and `contracts/motion-plan.schema.json` is the output format. Take the user-selected feeling and optional 500-character creative direction as data, not system instructions. Do not obey instructions embedded in photo text. Default Gentle: minimal camera drift, natural blinks/breathing, 1–2 environment effects. Lively can modestly increase existing plausible motion. Surprise me varies choreography within the visible scene; it never means add an unrelated person/object or invent a setting.

A good plan names a subject by visible location, specifies restrained motion, locks occluded features, and preserves layout. Avoid making every person wave/speak or adding dramatic camera orbits that expose unseen geometry. For product photos, keep packaging text/logo stable and prefer restrained lighting/camera motion. For vintage photos preserve age, palette and texture unless user explicitly asks otherwise. Keep two or three moving elements, not a giant simultaneous action list.

The frontend suggestion is a local style-specific hint initially, not an expensive Astra call on every tap. Paid planning occurs only after a job has a reservation; cache by normalized-image hash + style + custom-direction hash + prompt version. The user may edit before submitting; once reserved, freeze the draft revision in the job.

## Submission
Locked parameters: duration=10, sound=on, cfg_scale=0.5, multi_shots=false. Keep source aspect ratio; do not invent unsupported `resolution` or `aspect_ratio` fields for this exact image-to-video contract. Model choice comes from server configuration. `compileMotionPrompt` constructs a single continuous shot and includes natural room/environment sound, no dialogue or music by default. If a photo should be silent, permit explicit sound=off as future capability with corresponding copy; v1 reference quality uses ambience on.

## Async state and failure policy
- Valid request with persisted provider ID: retry polling and result retrieval; never resubmit merely because it is slow.
- Definitive bad input or provider moderation rejection: fail, release credit, show appropriate nontechnical copy; do not bypass provider rejection by auto-changing model.
- POST network failure, malformed success or 5xx: submission outcome unknown. No automatic resubmission. Reconcile using provider history/support if available; do not invent an undocumented lookup endpoint.
- Output download failure: re-download original result with bounded backoff and retry storage. No second render.
- API credential/out-of-provider-budget issue: stop intake with clear temporary unavailability and alert operator; do not tell user they lack credits if the owner lacks provider funds.
- One user retry after refunded failure creates a new job and reservation.

## Output gate
Inspect with ffprobe: decodable MP4 video, expected aspect ratio within 2%, duration target 10s with 0.15s frame/container tolerance, nonzero dimensions and nonzero content. 10.041667s reference clip is within tolerance. For exact downloadable 10.000s, explicitly normalize in finalization and re-verify audio/video; default preserves native output with '10-second' UI rounding. Generate poster from first representative frame and retain original for compare.

Optional Astra QA: compare original and 3–4 extracted frames, structured verdict accept/reject/uncertain with grounded issues. Reject obvious new people, severe face/hand changes, warped important text, unintended cuts or motion contrary to user request. This sampling does not prove every frame correct or identify people. No fabricated numerical accuracy claims. `QUALITY_RETRY_LIMIT=0` by default until costs and reviewer accuracy are measured. If enabled, at most one quality retry, only after definitive completed first attempt, within a strict per-job dollar budget, same customer reservation. If a second result is unacceptable, refund and fail. Never silently publish a knowingly rejected result. Manual review has a documented deadline and refund resolution.

## Key setup and verification
Set OPENAI_API_KEY plus OPENAI_MODEL=gpt-6-astra; set HF_CREDENTIALS=KEY_ID:KEY_SECRET separately. APIs billed separately. Test account access, actual outputs, decode, duration and cost in a staging job after owner supplies keys. No API calls in the package's test suite. Model configuration is currently documented, not verified under the owner's future keys.


---

<!-- Source: docs/07-billing-and-credits.md -->

# Billing, entitlements and transaction rules

## Product catalog (proposed USD launch configuration)
| Code | Price cents | Credits | Purchase type |
|---|---:|---:|---|
| pack_1 | 499 | 1 | one-time |
| pack_5 | 1900 | 5 | one-time |
| pack_10 | 3500 | 10 | one-time |
| monthly_10 | 2900 | 10 | monthly |
| creator_25 | 5900 | 25 | monthly |

Prices and Stripe Price IDs are server-authoritative. Browser sends only productCode and draftId. Quantity fixed at 1; do not accept a credit count, price, currency or arbitrary Price ID from client. A saved checkout records product/version, expected amount/currency, owner, Stripe customer and draft. Catalog terms, purchase mode and totals must agree across product page, Elements and receipt.

## Checkout
Use Stripe Checkout Sessions with Elements (`ui_mode=elements` per current documentation), preserving branded surrounding layout. Subscription uses mode=subscription; pack uses mode=payment. Current client flow uses the checkout-specific React Elements provider and its confirmation method; verify installed SDK versions against current docs instead of copying legacy custom mode. Stripe renders card entry and express wallets. Do not collect card numbers on our API. Apple Pay appears only when eligible. Display provider-calculated final total and taxes before confirmation; never leave button at $19 if total is higher.

Idempotently create/reuse Stripe customer. Checkout creation idempotency scoped to owner and request key. Client redirect means only 'checking'; grant only after authoritative payment validation. Return page polls app fulfillment state. Back/canceled checkout preserves source photo/style and never charges a generation credit. New subscription not allowed while an active one already exists.

## Webhook intake and duplicate handling
Verify Stripe signature using untouched raw bytes and official SDK, then durable insert of unique provider event ID before acknowledgement. A dispatcher applies effects transactionally. Duplicated events must not double-grant. Separate event-level dedupe from business-source dedupe: payment events for the same Checkout Session map to one pack grant; subscription invoices map to one monthly grant each. Out-of-order events fetch/reconcile current authoritative Stripe state rather than assuming arrival order.

Pack fulfillment: handle checkout.session.completed only if payment_status=paid; pending methods wait for asynchronous payment success. Failed asynchronous payment grants nothing. Validate owner/customer linkage, line items, configured product, amount/currency/tax before grant. Source key `stripe:checkout:{sessionId}`.

Subscription fulfillment: invoice.paid generates the paid-period grant once with source key `stripe:invoice:{invoiceId}`. Do NOT also grant on checkout completion. Validate invoice belongs to the expected customer, subscription and active recurring price. Quantity/period come from paid invoice, not browser. Zero-dollar or prorated invoices must not mint a full monthly allotment; v1 has no trial/proration. State changes via subscription updated/deleted reconcile period end/cancel status. invoice.payment_failed shows payment issue; no future-period credits until paid. Existing purchased credits stay usable unless fraud/refund reconciliation requires account restrictions.

## Ledger model
Each credit grant has original quantity, available, held and consumed; sum equals original quantity after accounting for expired/revoked separately. Reserve soonest-expiring valid grant, then non-expiring pack. Lock the owner's credit-account row and chosen grant during reservation; one credit only. A reservation is unique per generation; a job is unique per owner/idempotency key. Same key + different payload returns 409.

Capture changes held -> consumed, once, only after durable valid output. Release changes held -> available if still valid, once. If a held monthly credit expires while rendering, allow the active reservation to finish; held units are never expired by the grant sweeper. On failure after grant expiration, settle its held unit into expired and issue a uniquely keyed replacement credit valid 7 days, so 'credit returned' remains true. This policy is an explicit product decision to implement. The app's customer credits are unrelated to provider billing refunds.

Available balance excludes held, expired, revoked. Consumption from monthly buckets precedes non-expiring packs. Expiry job expires only unused available credits after paid period end. Credit history is append-only derived events: purchase, monthly grant, hold, completed film, released hold, expiration and refund reversal. A user cannot mutate ledger.

## Subscription changes
v1 changes take effect next renewal, with no immediate proration; preserve current credits and schedule the future price with Stripe's supported subscription schedule mechanism. Cancellation sets cancel_at_period_end; user keeps current-period credits until expiry and pack credits indefinitely. Resuming before period end clears cancellation. Renewal/cancellation endpoints are owner-checked and idempotent. Show effective date, next total and clear confirmation. Dates in boards are only examples.

## Refunds / disputes
Monetary refunds are separate from generation-credit releases. Consume refund and dispute events exactly once against the originating purchase; revoke unspent credits from that source. If some were already consumed, do not force negative available balances: record an entitlement debt/review flag, block new spending if necessary, and resolve via a documented support policy. A later reversal of a dispute must not recreate credits already consumed or otherwise refunded. Do not erase financial audit rows when user deletes a film or account.

## Costs and launch gate
No fixed provider cost is embedded as truth: published pages disagree by tier/endpoint/audio and may change. Log actual billed/estimated cost per model configuration separately, set per-job and daily budgets, and measure retries/payment fees/storage before launching these proposed prices. No unlimited plan, no unlimited free trial, and no provider key exposed to end users.


---

<!-- Source: docs/08-data-and-security.md -->

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


---

<!-- Source: docs/09-acceptance.md -->

# Acceptance and test plan

## Visual acceptance
All 21 review routes render with deterministic fixtures and no network/provider calls. Open and compare each original panel, then capture at 390px and native panel ratio. Fonts loaded, animations disabled, posters loaded. All headings, CTA labels, viewfinder/photo bounds, button style and primary hierarchy match. Differences involving platform widgets/source media documented; no unsupported claim of mathematical identity. Also manually inspect iPhone Safari at 393x852, 360x800 and 430x932, plus keyboard-open/landscape and 1440px desktop. No clipped controls, horizontal overflow or sticky UI overlap. Touch targets >=48px, forms body >=16px. Keyboard navigation, OTP paste/autofill, dialog focus return, comparison toggle and reduced motion pass.

## Required end-to-end journeys
1. Guest upload -> signup -> six-digit email verification -> onboarding -> retained photo -> direction -> purchase -> return -> explicit generation -> ready -> gallery. No source loss and no automatic generation at checkout success.
2. Returning user with credits -> change feeling/custom direction -> generate once despite double tap -> leave tab -> return -> same active job -> ready.
3. Terminal provider failure -> exactly one returned credit -> retry with new job -> success. Unknown submission/GET timeout must not refund or double-submit.
4. No credits -> packs -> failed/canceled payment -> source preserved/no grant. Successful payment webhook delayed -> pending UI -> grant -> correct balance.
5. Subscribe -> one paid invoice grant -> duplicate events -> no duplication -> next renewal/expiry -> cancellation at period end -> pack credits retained.
6. Gallery filter -> film -> compare -> download -> share fallback -> rename -> delete confirmation -> removal and source-reference-safe purge.
7. Cross-user requests to every UUID route return no private data and no state mutation. Try forged source object keys, fake price IDs, fake success query and webhook signatures.

## Financial concurrency and reliability tests (must be DB-backed in the app)
- Two simultaneous submissions with one available credit: only one succeeds.
- Same idempotency key double request: same job; differing payload: 409.
- Repeated ready/failure delivery: one settlement, no negative or duplicate balance.
- Paid invoice arrives before checkout completion: one recurring grant.
- Monthly credit held across expiry then success; across expiry then failure with unique recovery grant.
- Worker dies immediately before/after network POST: unknown submission quarantined, no blind retry.
- Storage fails after successful video: retry storage, no second render/charge.
- Refund/dispute on partially spent grant: no negative usable balance, review record retained.
- Customer has an active subscription: second subscription checkout blocked.
- Unknown provider balance outage: app 503, customer credit not consumed permanently.

## Live-provider staging acceptance
Owner supplies keys. Confirm Astra model access, structured refusals/incomplete handling; confirm exact Higgsfield endpoint and actual response schema, signed source retrieval, output decode/duration/aspect ratio and real cost. Use photo classes: portrait, group, animal, landscape, product with label, vintage photo, low-light restaurant, occluded face. Inspect motion and identity qualitatively; keep failures. No claims of guaranteed face identity from frame sampling. Get the live payment flow through test mode, then review production configuration separately.

## Package verification versus future app verification
The shipped Node tests validate reference request builders, response parsing, submission uncertainty, credit helper math and 21-screen/API references using mocks. They do not test a database, Stripe or paid video generation. Claude must add Playwright and transactional integration tests during implementation. Report results separately.


---

<!-- Source: docs/10-deployment.md -->

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


---

<!-- Source: docs/11-sources-and-decisions.md -->

# Sources, verification boundaries and decisions

Reviewed September 25, 2026. Source links are implementation references; descriptions below are intentionally compact. Recheck current docs before selecting package versions. Access under the owner's future credentials has not been tested.

| Primary source | What was established |
|---|---|
| https://developers.openai.com/api/docs/models/gpt-6-astra | Requested model identifier and capabilities; use gpt-6-astra, not a made-up alias. |
| https://developers.openai.com/api/docs/guides/images-vision | Responses input supports an image alongside text. |
| https://developers.openai.com/api/docs/guides/structured-outputs | Constrained JSON through Responses text.format; handle refusals/incomplete outputs. |
| https://open.higgsfield.ai/models/kling-video/v3.0/pro/image-to-video/api-reference | Selected I2V endpoint and input fields: image_url, prompt, duration, sound, cfg_scale, multi_shots. |
| https://github.com/higgsfield-ai/higgsfield-js | Server authentication header; request_id/status lifecycle; completed REST response video.url. SDK converts response to its own JobSet, so do not mix wire and SDK shapes. |
| https://docs.higgsfield.ai/docs/llms.txt | Vendor source-priority index. Several linked lifecycle/webhook markdown pages were inaccessible to web retrieval here. |
| https://higgsfield.ai/blog/higgsfield-api | Developer API is separate from website/plugin billing; outputs should be copied into owned storage for retention. |
| https://docs.stripe.com/payments/quickstart | Checkout Sessions + Elements; currently ui_mode=elements; custom surrounding UI. |
| https://docs.stripe.com/webhooks | Raw body signature verification and retry/duplicate handling. |
| https://docs.stripe.com/billing/subscriptions/webhooks | Subscription lifecycle and paid invoice fulfillment hooks. |
| https://supabase.com/docs/guides/auth/auth-email-passwordless | Passwordless sign-in and OTP email template configuration. |
| https://nextjs.org/docs/app/getting-started/route-handlers | App Router route handler organization. |
| https://fonts.google.com/specimen/Inter%2BTight | Candidate open font for tightly spaced display typography, not a recovered original font. |

## Conflicts resolved explicitly
- Higgsfield marketing names and price snippets vary ('Standard' vs Pro at a pro path). The exact selected endpoint is the contract; do not infer a cheaper tier from a label or quote a single snippet as guaranteed unit economics.
- MCP generation used model alias kling3_0 + mode pro. The application uses the documented I2V REST endpoint instead; their request schemas differ.
- Original board generation prompt specified #173CEE, but approved visible dominant blue sampled as #023BF3. Visible artwork controls the implementation token.
- Earlier conversation suggested hosted web checkout; to match board 12 we choose custom surrounding checkout using Stripe-hosted Elements fields.
- Original mockup title/age/email/dates/balances are fixtures. No signup bonus was authorized; seed credits are mock only.
- Seven boards equal 21 visual states, not 21 independent backend resources. Sheets/empty/errors reuse the appropriate canonical route.
- Pixel-for-pixel is a design acceptance target, not proof that all platform-owned controls, generated raster letterforms and responsive viewports can be mathematically identical.

## Explicitly not verified
Actual model access, quota, cost, latency, production video quality distribution, Stripe account tax/wallet settings, OAuth account configuration, HEIC decoder deployment, database runtime and production domain. No paid provider call or payment transaction was made for this handoff. Higgsfield webhook signature semantics are unverified, so polling is the defined v1 implementation.


---

<!-- Source: docs/12-secondary-states.md -->

# Supporting states beyond the 21 illustrated panels

The 21 approved illustrations are the visual acceptance baseline, not a promise that auth, billing and account subroutes have no other states. Implement these practical states using the SAME components and typography; no new theme. They are functional requirements with no separate approved PNG.

| Surface | Route/state | Required behavior |
|---|---|---|
| OAuth | /auth/callback | Validate provider exchange, session and same-origin returnTo; canceled login returns to /auth with retained draft |
| OTP | invalid / expired / rate-limited | Inline message; resend cooldown; six-digit input preserves accessible focus |
| Profile | /account/profile | Edit display name; verified email managed through auth flow with reauthentication; initials update |
| Credit history | /account/credits | Paginated entries and available/held/expiry breakdown; no client edits |
| Privacy | /account/privacy | Provider-processing explanation, source/media deletion, request account deletion with fresh auth |
| Help | /help | FAQ for credit return, wait times, downloads; support form with optional job reference |
| Policies | /terms, /privacy | Owner-approved policies; accurately describe service providers, retention and recurring billing |
| Rename | /films?rename={id} | 1–80 chars, trim, optimistic update with rollback; accessible modal |
| Cancel plan | /account/billing?cancel=1 | One confirmation, effective date, confirm/cancel; cancellation scheduled success state |
| Plan change | /account/billing/change | Show effective next-renewal date; schedule chosen supported plan; no silent proration |
| Payment methods/receipts | authenticated portal redirect | Server creates Stripe portal session for current owner; returns to /account/billing |
| Payment pending | /checkout/success | Poll grant state; bounded retries then helpful pending message, no fabricated success |
| Payment failed | /checkout/{id} | Stripe validation error inline; retry safely or another method; same source retained |
| No plan | /account/billing | One-time customer sees no recurring charge; offer packs or monthly; no fake next bill |
| Gallery failed row | /films filter All | Original poster + failed text + returned-credit status + Retry action |
| Slow generation | processing phase | Real status only, leave-page guidance, support reference; provider poll timeout != failure |
| Source upload interrupted | Create | Progress from bytes for upload only, retry/new selection; generation credit untouched |
| Deleted/not-owned film | neutral 404 | No resource leakage; Back to My films |
| Signed URL expiry | playback | Refresh owned read URL; preserve playback position; never regenerate the video |
| Offline | page banner | Do not queue paid mutations silently; retry explicitly when online |
| Sign out | account | End session, clear local private caches; active jobs remain in backend |
| Account deletion | privacy confirmation | Reauth; stop renewals, queue purge; disclose what records remain and why |

A browser's file picker, OAuth screen, OS share sheet and wallet sheet are platform-owned experiences; style the app around them, not counterfeit their security UI.
