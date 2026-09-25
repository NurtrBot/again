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

For a single continuous reading document, use `COMPLETE_BUILD_HANDBOOK.md`. `VALIDATION.md` records completed checks and remaining integration gates.

## Directory map
- `design/`: original boards, screen manifest, tokens.
- `docs/`: product, visual, routes, architecture, generation, billing, QA and deployment specifications.
- `contracts/`: OpenAPI, JSON schemas, example payloads and Postgres DDL.
- `reference-code/`: no-dependency Node reference adapters and behavior helpers; application integration still required.
- `prompts/`: Astra direction and evaluation instructions; original successful prompt.
- `fixtures/`: private quality reference and mock response fixtures.
- `tests/`: offline contract and failure-handling tests.
- `DESIGN_REVIEW.html`: local board and route navigator, not the app prototype.
