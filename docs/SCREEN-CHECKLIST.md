# 21-screen checklist

Review routes render deterministic fixtures. Compare: `node e2e/compare.mjs` → `e2e/__compare__/NN-side.png` (board left, app right) and `/review/sheet`. "diff" is the share of pixels differing by more than 40/255 at 390px; most residual comes from different photo crops per board and antialiasing.

| ID | State | Route | Review | diff | Notes |
|---|---|---|---|---|---|
| 01 | Welcome | `/` | ✅ | 20.6% | Sample carries a small "Example" tag (honesty). |
| 02 | Sign up or sign in | `/auth` | ✅ | 14.6% | Apple/Google only when `OAUTH_PROVIDERS` configured. |
| 03 | Email verification | `/auth/verify` | ✅ | 13.2% | One input behind six cells; Continue disabled until 6 digits; invalid/expired/rate-limited inline. |
| 04 | Quick start | `/onboarding` | ✅ | 24.6% | Skip and CTA both complete onboarding. |
| 05 | Create | `/create` | ✅ | 26.6% | Live credit pill; inspiration strip plays labeled examples. |
| 06 | Direction | `/create/[draftId]` | ✅ | 25.3% | Gentle default; 500-char direction; 402 → credits with returnTo. |
| 07 | Creating | `/create/[draftId]/processing?job=` | ✅ | 22.1% | Steps driven by real job status only; no percentages. |
| 08 | Ready to watch | `/films/[filmId]` | ✅ | 22.1% | Press/keyboard compare restores exact time; no audible autoplay. |
| 09 | My films | `/films` | ✅ | 38.8% | Filters, cursor paging, scroll restore. |
| 10 | Buy credits | `/credits?tab=packs` | ✅ | 13.7% | |
| 11 | Monthly plans | `/credits?tab=monthly` | ✅ | 21.0% | Active member routed to plan management. |
| 12 | Checkout | `/checkout/[id]` | ✅ | 28.6% | Stripe Elements in live mode; labeled demo form in mock; Apple Pay only when eligible. |
| 13 | Purchase complete | `/checkout/success?session_id=` | ✅ | 25.4% | Polls fulfillment; refresh never double-grants. |
| 14 | Account | `/account` | ✅ | 19.3% | Initials avatar; all rows lead somewhere. |
| 15 | Manage membership | `/account/billing` | ✅ | 14.1% | Live dates; single cancel confirmation; no-plan state. |
| 16 | Empty gallery | `/films` (empty) | ✅ | 20.8% | |
| 17 | Photo needs attention | `/create?error=` | ✅ | 19.0% | Copy per error code (type/size/unreadable/small/animated/HEIC). |
| 18 | Generation failed | processing route, failed | ✅ | 33.3% | "Credit returned" only after settlement; retry uses a new key/job. |
| 19 | Film actions | `/films?actions=` | ✅ | 41.1% | Focus trap, Escape, focus restore. |
| 20 | Share film | `/films/[filmId]/share` | ✅ | 22.8% | `navigator.share` with a File; cancel is not an error; download fallback. |
| 21 | Delete confirmation | `/films?delete=` | ✅ | 49.4% | Keep primary; delete tombstones then purges; no refund. |

Supporting states (docs/12): OAuth callback, OTP errors, `/account/profile`, `/account/credits`, `/account/privacy` (deletion with DELETE confirmation + recent auth), `/help` (FAQ + support form), `/terms`, `/privacy` (drafts), rename dialog, cancel/resume plan, `/account/billing/change`, portal redirects, payment pending/failed, gallery failed row, slow generation copy, upload interrupted, neutral 404, signed URL refresh, offline banner, sign-out cache clear, account deletion.

Viewports checked: 360×800 (no horizontal overflow test), 390 baseline, 393×852, 430×932, desktop (shell centered, gallery two columns).
