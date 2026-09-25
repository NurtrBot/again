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
