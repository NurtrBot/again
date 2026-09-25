# Visual fidelity and interaction system

## Authority and hierarchy
1. All seven approved PNG boards are authoritative for the look, content hierarchy and screen composition.
2. Original `00-approved-direction.png` controls brand color and type personality when later generated boards differ slightly.
3. tokens.css and screen specs normalize implementation details that the generated artwork never defined.
4. Accessibility, honest transaction state and provider/native UI requirements override nonfunctional details in mockups.

The PNGs are handoff reference images, not production UI backgrounds. Never flatten the screens into screenshots with invisible hotspots. Do not regenerate the entire design or replace it with a UI-library theme.

## Color and type
Modal cobalt pixels sampled from the approved original are RGB(2,59,243), hence `#023BF3`. Generation prompts mentioned `#173CEE`, but the visible approved image is the authority. Use one flat cobalt token; do not reproduce accidental raster noise or gradients. Ink `#0C0E11`, white `#FFFFFF`, canvas `#EFF2F7`, gray `#676D76`, line `#D7DAE1`, destructive `#C4223B`. Verify actual contrast on final rendering.

The mockups do not identify a font. Start with locally hosted Inter Tight 800 for headlines and Inter 400/500/600/700 for controls and body; IBM Plex Mono 400 for timecodes only. These are implementation selections, not claimed recovered source fonts. Adjust optical tracking/line-height to the PNG, then freeze tokens. No serif or system default headline fallback in screenshot tests. Wordmark is a small custom lowercase `again.` text treatment, weight 800, tightly tracked; do not use an image screenshot of a wordmark. Create a vector wordmark only after matching the approved typography; use CSS type initially.

## Dimensions
390px baseline width. Horizontal gutter 20px (16px at <=360px), 24px between major blocks, 12px inside rows, 32px around headline/media transitions. Header approx 56px plus safe-area top. Buttons min 56px high, 6px radius; sheet top corners 16px. Controls min 48x48px. Body 16px/1.45, helper >=12px/1.4, nav 12–14px, section title 28–32px, hero 40–50px with -0.045em tracking and 1.02 line height. Capture every screen and adjust per-state typographic wraps to supplied screenshot; do not make global font changes to fix a single page.

Credit packs, plans and tables may scroll. Bottom primary action is sticky only when it does not cover content, errors or keyboard. Reserve actual footer height in body padding. Use 100svh/100dvh deliberately and safe-area inset padding. Test iOS browser toolbar expansion, home indicator, keyboard, and rotation. Landscape views may be normal scroll layouts. Desktop extends the same app: centered creation workspace up to 1100px, gallery 2–3 columns, forms <=480px; do not invent a separate SaaS dashboard.

## Shared components
BrandMark; AppHeader; CreditBalanceLink; BottomNav; ShutterUploadButton; ViewfinderFrame; PhotoPreview; FeelingSelector; PrimaryButton; SecondaryButton; OTPInput; DraftResume; ProgressSteps; FilmPlayer; CompareControl; FilmRow; StatusBadge; ActionSheet; ConfirmDialog; CreditPackRow; PlanOption; OrderSummary; PaymentFormBoundary; InlineError; EmptyGallery; ToastRegion.

Use one outline icon family, 1.75–2px stroke, 20–24px icons, and custom simple play/shutter/viewfinder geometry. Avoid emoji and decorative icons. Movie duration is derived from media, not hard-coded to 00:10 in a real video if actual length differs by a frame.

## Motion choreography (intended behavior, not shown by PNGs)
- Shutter: pressed scale .96 for 120ms; no long ornamental ripple.
- Photo selected: 220ms translateY 8px -> 0 and fade-in; stable aspect-ratio container prevents layout shift.
- Upload -> Direction: shared photo rectangle transition <=320ms when feasible; simple crossfade fallback.
- Progress: restrained indeterminate dot pulse 1.2s; stage labels change only on real backend events.
- Ready: background transitions cobalt -> ink for 280ms then video fades in 240ms. Never autoplay audible sound without user activation.
- Sheet: 240ms translateY, scrim alpha .48. Focus moves into sheet, Escape/back closes, focus restored.
- Comparison: holding overlays original with same object-fit/position; release restores prior video state. Provide persistent keyboard toggle and accessible name.
- Reduced motion: instantaneous or short opacity transitions; all interactions remain available.

## Media fidelity
The dog, restaurant and family thumbnails in boards are not supplied as isolated production assets. Do not use an entire screenshot as an image asset in the live app or hallucinate that a stock dog is the exact original. For exact visual review, a developer may extract ONLY photographic rectangles from the supplied boards into documented local fixture assets, retaining provenance; use permitted project image tools. For launch, replace fixtures with separately licensed/owned examples and explicitly acknowledge that sample-photo pixels then differ. User-uploaded originals and generated films always come from private storage. Include sample restaurant video solely for private quality evaluation until the owner supplies marketing rights.

## Screenshot comparison
`design/screens.json` gives manually estimated panel bounds in the 1474px-wide boards. Refine bounds to the panel edge, exclude gray gutters/captions, then scale proportionally to 390px. Do not stretch to a common height: boards use different aspect ratios. Capture `/review/01` ... `/review/21` at corresponding height; compare screenshot overlay at 50% and pixel diff. Aim for major control/media bounds within 3 CSS px at baseline, correct text wrapping and no unexplained layout drift. Antialiasing, source photo differences and native payment controls are evaluated separately. Once human-reviewed implementation is accepted, save its screenshots as deterministic Playwright baselines. Do not baseline an obviously divergent screen merely to pass tests.

## Intentional corrections to artwork
- OTP Continue disabled until valid-length code; expired/invalid states added.
- All balances say credits; a film is an output item.
- Signup buttons appear only for configured OAuth providers; unavailable buttons must not be dead links.
- Stripe Elements own card entry; never replicate raw card inputs that post to our server. Apple Pay depends on actual eligibility. Final total includes confirmed tax; never charge more than displayed total.
- Step 03 onboarding text should describe saving, not generating again.
- Example numbers and dates are fixture data only. Public sample thumbnails clearly labeled.
- Main gallery floating plus respects bottom safe area and never blocks a film menu.
