# Package validation

Validated September 25, 2026.

- 17 offline Node tests passed; 0 failures.
- Package validator passed: 21 screen states, seven original board references, valid JSON, reference panel bounds and local viewer links.
- OpenAPI internal schema references resolve and operation IDs are unique.
- Original reference boards are preserved as PNGs; reference video and source photo are included for private quality evaluation.
- SHA256SUMS.txt records every deliverable file except itself. The ZIP was checked for CRC integrity after creation.

## What these checks do not establish

The Next.js application is to be built from this handoff. Browser visual comparisons, Postgres migrations/transaction concurrency, authentication, live OpenAI/Higgsfield requests, Stripe test-mode purchases/webhooks, production deployment and performance have not been executed. The implementation acceptance plan explicitly requires these checks. No credentials or paid provider calls were used by the package tests.

## Repeat the offline checks

From this folder:

```sh
node --test tests/*.test.mjs
python3 tools/validate_package.py
sha256sum -c SHA256SUMS.txt
```
