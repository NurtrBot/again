# Reference-core modules

These Node ESM files have no external dependencies and are exercised by offline tests. They are integration building blocks, not a complete application or database service.

- astra.mjs: request payload, strict local plan validation, refusal/incomplete handling, prompt compiler, server fetch.
- higgsfield.mjs: exact selected model input, single submission, explicit unknown-outcome error, resumable authenticated status GET. No speculative webhook signing implementation.
- domain.mjs: payload hashing, grant choice, settlement math and redirect filtering. The application must wrap ledger changes in Postgres transactions; pure helpers alone cannot prevent concurrent spending.

Production integration must add: runtime API validation, session/ownership checks, environment validation, rate/spend limits, durable SQL transactions, queue leases, media normalization and safe CDN fetching, signed storage URLs, Stripe webhooks, observability and integration tests. Copy or port helpers into TypeScript with pinned runtime schemas. No blind network retries of Higgsfield POST.
