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
