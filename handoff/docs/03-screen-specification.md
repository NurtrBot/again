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
