# Project contract — again.

## User intent
Build the approved mobile-first web product from the 7 supplied boards / 21 screens, preserving the exact electric cobalt, bold typography, viewfinder and shutter vocabulary. Working name: again. The user will supply API keys later. Deliver a runnable mock mode immediately and a real, documented production integration. Do not stop after static screens.

## Read order
1. START_HERE_CLAUDE.md
2. docs/01-product-and-flow.md
3. docs/02-design-system.md and ALL 7 PNG boards in design/references/
4. docs/03-screen-specification.md and design/screens.json
5. docs/04-architecture.md, docs/05-api-contract.md, contracts/openapi.json
6. docs/06-generation-pipeline.md, docs/07-billing-and-credits.md, docs/08-data-and-security.md
7. docs/09-acceptance.md and docs/10-deployment.md
8. docs/11-sources-and-decisions.md and docs/12-secondary-states.md

## Non-negotiables
- No rebranding, new landing-page layout, serif type, pastel palette, gradients, glass, sparkle icons or generic dashboard UI.
- Native semantic HTML controls; no full-screen screenshot used as a fake working UI.
- All 21 visual states must be addressable in deterministic review mode and backed by meaningful interactions in app mode.
- Never silently swap `gpt-6-astra` or the selected Kling endpoint to another model. Report unavailable access explicitly.
- Customer browsers never receive provider secret keys. Do not offer end-customer BYOK; owner supplies server keys.
- Never grant credits from client state, query strings, localStorage or an unverified webhook.
- Reserve a credit transactionally before a generation; settle exactly once. Never submit paid generation twice after ambiguous failure.
- Mock/demo responses must be visibly identified and disabled in production. Never show the bundled restaurant reference as if generated from a different photo.
- Every server endpoint enforces ownership even when a request used a service role database client.
- No placeholder buttons or dead-end account links at completion.
- Do not ask the owner for secrets in chat. Use .env.local or hosting secret manager.
- Do not claim live validation, exact model cost, performance or guaranteed face preservation unless measured.
- All UI polish happens in code against reference screenshots. Generative boards are the authority for visual direction, not literal fake balances or sample dates.

## Stack decision
Next.js App Router + React + TypeScript; CSS tokens/components without a stock visual theme; Supabase Auth/Postgres/private Storage; Stripe Checkout Sessions + Elements; a separate persistent Node worker using Postgres outbox leases and FFmpeg. Use currently supported pinned package versions at implementation time, verified against primary documentation; commit lockfile. Do not put minutes-long rendering in a web request or rely on browser polling to keep a job alive.

## Allowed autonomy
Complete local implementation, mock tests, screenshots and fixes without repeatedly requesting design approval. Any paid API test, deployment or live Stripe setup remains a separately identifiable action with the owner's task authorization and environment controls respected. Never conceal outstanding infrastructure configuration.
