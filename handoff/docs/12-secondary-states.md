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
