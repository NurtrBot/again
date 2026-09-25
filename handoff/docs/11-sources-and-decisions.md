# Sources, verification boundaries and decisions

Reviewed September 25, 2026. Source links are implementation references; descriptions below are intentionally compact. Recheck current docs before selecting package versions. Access under the owner's future credentials has not been tested.

| Primary source | What was established |
|---|---|
| https://developers.openai.com/api/docs/models/gpt-6-astra | Requested model identifier and capabilities; use gpt-6-astra, not a made-up alias. |
| https://developers.openai.com/api/docs/guides/images-vision | Responses input supports an image alongside text. |
| https://developers.openai.com/api/docs/guides/structured-outputs | Constrained JSON through Responses text.format; handle refusals/incomplete outputs. |
| https://open.higgsfield.ai/models/kling-video/v3.0/pro/image-to-video/api-reference | Selected I2V endpoint and input fields: image_url, prompt, duration, sound, cfg_scale, multi_shots. |
| https://github.com/higgsfield-ai/higgsfield-js | Server authentication header; request_id/status lifecycle; completed REST response video.url. SDK converts response to its own JobSet, so do not mix wire and SDK shapes. |
| https://docs.higgsfield.ai/docs/llms.txt | Vendor source-priority index. Several linked lifecycle/webhook markdown pages were inaccessible to web retrieval here. |
| https://higgsfield.ai/blog/higgsfield-api | Developer API is separate from website/plugin billing; outputs should be copied into owned storage for retention. |
| https://docs.stripe.com/payments/quickstart | Checkout Sessions + Elements; currently ui_mode=elements; custom surrounding UI. |
| https://docs.stripe.com/webhooks | Raw body signature verification and retry/duplicate handling. |
| https://docs.stripe.com/billing/subscriptions/webhooks | Subscription lifecycle and paid invoice fulfillment hooks. |
| https://supabase.com/docs/guides/auth/auth-email-passwordless | Passwordless sign-in and OTP email template configuration. |
| https://nextjs.org/docs/app/getting-started/route-handlers | App Router route handler organization. |
| https://fonts.google.com/specimen/Inter%2BTight | Candidate open font for tightly spaced display typography, not a recovered original font. |

## Conflicts resolved explicitly
- Higgsfield marketing names and price snippets vary ('Standard' vs Pro at a pro path). The exact selected endpoint is the contract; do not infer a cheaper tier from a label or quote a single snippet as guaranteed unit economics.
- MCP generation used model alias kling3_0 + mode pro. The application uses the documented I2V REST endpoint instead; their request schemas differ.
- Original board generation prompt specified #173CEE, but approved visible dominant blue sampled as #023BF3. Visible artwork controls the implementation token.
- Earlier conversation suggested hosted web checkout; to match board 12 we choose custom surrounding checkout using Stripe-hosted Elements fields.
- Original mockup title/age/email/dates/balances are fixtures. No signup bonus was authorized; seed credits are mock only.
- Seven boards equal 21 visual states, not 21 independent backend resources. Sheets/empty/errors reuse the appropriate canonical route.
- Pixel-for-pixel is a design acceptance target, not proof that all platform-owned controls, generated raster letterforms and responsive viewports can be mathematically identical.

## Explicitly not verified
Actual model access, quota, cost, latency, production video quality distribution, Stripe account tax/wallet settings, OAuth account configuration, HEIC decoder deployment, database runtime and production domain. No paid provider call or payment transaction was made for this handoff. Higgsfield webhook signature semantics are unverified, so polling is the defined v1 implementation.
