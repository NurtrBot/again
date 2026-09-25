# Astra + Higgsfield pipeline

## Verified division of responsibility
OpenAI `gpt-6-astra` receives text + normalized image and returns a constrained motion plan through the Responses API. Higgsfield `kling-video/v3.0/pro/image-to-video` receives that image URL plus compiled instructions and produces video. Astra does not directly render the MP4. The precise API endpoint spelling is in reference-code/higgsfield.mjs; it is not the MCP model alias `kling3_0`.

## Quality reference
The included private restaurant clip was actually generated in this conversation using Kling 3.0, mode pro, duration 10 and sound on. The initial Seedance 2.5 attempt failed; do not use that failed attempt as a quality baseline or make it the default fallback. prompts/restaurant-successful-prompt.txt preserves the successful creative instructions. That reference proves a successful sample, not a guarantee for every photo or a live test of the new developer-API integration.

## Input preparation
Accept actual decoded JPEG, PNG and HEIC/HEIF <=20 MiB; inspect magic bytes, byte size and pixel count <=40 MP, with minimum short edge 256px. Reject animated or unreadable input with specific actionable copy. Run image decoding/HEIC conversion in a resource-limited worker; verify libheif capability before advertising HEIC live. Normalize orientation once, convert sRGB, remove EXIF/location metadata, preserve original aspect ratio and the entire scene. A normalized JPEG max long edge 2560px is a starting policy; test any model-specific size restrictions before launch. Keep original and normalized variants privately. Do not colorize, beautify, remove watermarks, invent limbs or crop off faces automatically.

## Planning
`prompts/astra-director.txt` is a versioned instruction, and `contracts/motion-plan.schema.json` is the output format. Take the user-selected feeling and optional 500-character creative direction as data, not system instructions. Do not obey instructions embedded in photo text. Default Gentle: minimal camera drift, natural blinks/breathing, 1–2 environment effects. Lively can modestly increase existing plausible motion. Surprise me varies choreography within the visible scene; it never means add an unrelated person/object or invent a setting.

A good plan names a subject by visible location, specifies restrained motion, locks occluded features, and preserves layout. Avoid making every person wave/speak or adding dramatic camera orbits that expose unseen geometry. For product photos, keep packaging text/logo stable and prefer restrained lighting/camera motion. For vintage photos preserve age, palette and texture unless user explicitly asks otherwise. Keep two or three moving elements, not a giant simultaneous action list.

The frontend suggestion is a local style-specific hint initially, not an expensive Astra call on every tap. Paid planning occurs only after a job has a reservation; cache by normalized-image hash + style + custom-direction hash + prompt version. The user may edit before submitting; once reserved, freeze the draft revision in the job.

## Submission
Locked parameters: duration=10, sound=on, cfg_scale=0.5, multi_shots=false. Keep source aspect ratio; do not invent unsupported `resolution` or `aspect_ratio` fields for this exact image-to-video contract. Model choice comes from server configuration. `compileMotionPrompt` constructs a single continuous shot and includes natural room/environment sound, no dialogue or music by default. If a photo should be silent, permit explicit sound=off as future capability with corresponding copy; v1 reference quality uses ambience on.

## Async state and failure policy
- Valid request with persisted provider ID: retry polling and result retrieval; never resubmit merely because it is slow.
- Definitive bad input or provider moderation rejection: fail, release credit, show appropriate nontechnical copy; do not bypass provider rejection by auto-changing model.
- POST network failure, malformed success or 5xx: submission outcome unknown. No automatic resubmission. Reconcile using provider history/support if available; do not invent an undocumented lookup endpoint.
- Output download failure: re-download original result with bounded backoff and retry storage. No second render.
- API credential/out-of-provider-budget issue: stop intake with clear temporary unavailability and alert operator; do not tell user they lack credits if the owner lacks provider funds.
- One user retry after refunded failure creates a new job and reservation.

## Output gate
Inspect with ffprobe: decodable MP4 video, expected aspect ratio within 2%, duration target 10s with 0.15s frame/container tolerance, nonzero dimensions and nonzero content. 10.041667s reference clip is within tolerance. For exact downloadable 10.000s, explicitly normalize in finalization and re-verify audio/video; default preserves native output with '10-second' UI rounding. Generate poster from first representative frame and retain original for compare.

Optional Astra QA: compare original and 3–4 extracted frames, structured verdict accept/reject/uncertain with grounded issues. Reject obvious new people, severe face/hand changes, warped important text, unintended cuts or motion contrary to user request. This sampling does not prove every frame correct or identify people. No fabricated numerical accuracy claims. `QUALITY_RETRY_LIMIT=0` by default until costs and reviewer accuracy are measured. If enabled, at most one quality retry, only after definitive completed first attempt, within a strict per-job dollar budget, same customer reservation. If a second result is unacceptable, refund and fail. Never silently publish a knowingly rejected result. Manual review has a documented deadline and refund resolution.

## Key setup and verification
Set OPENAI_API_KEY plus OPENAI_MODEL=gpt-6-astra; set HF_CREDENTIALS=KEY_ID:KEY_SECRET separately. APIs billed separately. Test account access, actual outputs, decode, duration and cost in a staging job after owner supplies keys. No API calls in the package's test suite. Model configuration is currently documented, not verified under the owner's future keys.
