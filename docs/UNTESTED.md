# Live integrations not yet verified

Honest status as of September 25, 2026. Everything below is implemented and unit/mock tested, but has **not** been exercised against the real service. Do not describe these as production-ready until the checks pass.

| Integration | Needs | How to verify |
|---|---|---|
| **Higgsfield Kling 3.0** (`VIDEO_PROVIDER=higgsfield`) | `HF_CREDENTIALS=KEY_ID:KEY_SECRET`, funded API balance, and a public HTTPS image URL (`PUBLIC_MEDIA_BASE_URL` via a tunnel, or `STORAGE_DRIVER=supabase`), `PROVIDER_MEDIA_ALLOWED_HOSTS` set to the vendor CDN host(s) seen in staging | Run one job in staging; confirm the request/response shape matches `handoff/reference-code/higgsfield.mjs` (`request_id`, `status`, `video.url`), output decodes, duration ≈10 s, aspect preserved, actual cost. Photo classes: portrait, group, animal, landscape, product, vintage, low-light, occluded face. |
| **Stripe** (`PAYMENTS_PROVIDER=stripe`) | Test keys, 5 Price IDs, webhook signing secret, portal configuration, tax settings, registered wallet domain | Test-mode purchase of each pack; subscription checkout; `stripe trigger` for `checkout.session.completed`, `invoice.paid` (duplicate + out-of-order), `customer.subscription.updated/deleted`, `charge.refunded`; confirm one grant per source and portal/scheduled plan change. API version in use: SDK default (`2026-08-26.dahlia`). |
| **Supabase Auth** (`AUTH_DRIVER=supabase`) | Project URL, anon key, service role key, OTP email template with the 6-digit token, SMTP, Apple/Google OAuth apps and redirect URLs | Email code sign-in, OAuth round trip with a retained local draft, session refresh, sign-out. `OAUTH_PROVIDERS=google,apple` only after both are configured. |
| **Supabase Storage** (`STORAGE_DRIVER=supabase`) | Private buckets `sources`, `normalized`, `films`, `thumbnails` | Signed upload + read, provider read URL TTL ≥ queue delay, download attachment. |
| **HEIC decoding** | libvips with libheif/HEVC on the worker host | Upload an iPhone HEIC; if decode fails the app reports `heic_unsupported` honestly. Set `HEIC_SUPPORTED=false` to stop advertising it. |
| **OpenAI Sora** (`VIDEO_PROVIDER=sora`) | — | Not available: `sora-2` and `sora-2-pro` carry `shutdown_date 2026-09-24` and `POST /v1/videos` returns 404 with this key. Adapter kept for a successor model; re-verify fields (`seconds`, `size`, `input_reference`) before use. |
| **Optional quality review** (`QUALITY_REVIEW_ENABLED=true`) | OpenAI key | Compare original vs. 4 sampled frames; measure reviewer accuracy and cost before enabling retries (`QUALITY_RETRY_LIMIT` stays 0). |
| **Production hosting** | Separate web and worker services, Postgres, secrets manager | See RUNBOOK.md. |

## Verified live

- `gpt-6-astra` via the Responses API with strict JSON schema, image input, `store:false`: one call on the restaurant fixture returned a valid plan in ~15 s (`scripts/test-astra.ts`). Cost per plan ≈ 3.7k input + 0.4k output tokens.
- Local Postgres 17: migrations, ledger concurrency, idempotency, settlement, billing fulfillment tests.
- Full mock journeys in a real browser (Playwright) and through the API (`scripts/smoke-journey.mjs`).

## Not claimed

Face-identity preservation, exact provider unit cost, production latency/throughput, and pixel identity across devices are not measured claims.
