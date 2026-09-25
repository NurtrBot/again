# Billing, entitlements and transaction rules

## Product catalog (proposed USD launch configuration)
| Code | Price cents | Credits | Purchase type |
|---|---:|---:|---|
| pack_1 | 499 | 1 | one-time |
| pack_5 | 1900 | 5 | one-time |
| pack_10 | 3500 | 10 | one-time |
| monthly_10 | 2900 | 10 | monthly |
| creator_25 | 5900 | 25 | monthly |

Prices and Stripe Price IDs are server-authoritative. Browser sends only productCode and draftId. Quantity fixed at 1; do not accept a credit count, price, currency or arbitrary Price ID from client. A saved checkout records product/version, expected amount/currency, owner, Stripe customer and draft. Catalog terms, purchase mode and totals must agree across product page, Elements and receipt.

## Checkout
Use Stripe Checkout Sessions with Elements (`ui_mode=elements` per current documentation), preserving branded surrounding layout. Subscription uses mode=subscription; pack uses mode=payment. Current client flow uses the checkout-specific React Elements provider and its confirmation method; verify installed SDK versions against current docs instead of copying legacy custom mode. Stripe renders card entry and express wallets. Do not collect card numbers on our API. Apple Pay appears only when eligible. Display provider-calculated final total and taxes before confirmation; never leave button at $19 if total is higher.

Idempotently create/reuse Stripe customer. Checkout creation idempotency scoped to owner and request key. Client redirect means only 'checking'; grant only after authoritative payment validation. Return page polls app fulfillment state. Back/canceled checkout preserves source photo/style and never charges a generation credit. New subscription not allowed while an active one already exists.

## Webhook intake and duplicate handling
Verify Stripe signature using untouched raw bytes and official SDK, then durable insert of unique provider event ID before acknowledgement. A dispatcher applies effects transactionally. Duplicated events must not double-grant. Separate event-level dedupe from business-source dedupe: payment events for the same Checkout Session map to one pack grant; subscription invoices map to one monthly grant each. Out-of-order events fetch/reconcile current authoritative Stripe state rather than assuming arrival order.

Pack fulfillment: handle checkout.session.completed only if payment_status=paid; pending methods wait for asynchronous payment success. Failed asynchronous payment grants nothing. Validate owner/customer linkage, line items, configured product, amount/currency/tax before grant. Source key `stripe:checkout:{sessionId}`.

Subscription fulfillment: invoice.paid generates the paid-period grant once with source key `stripe:invoice:{invoiceId}`. Do NOT also grant on checkout completion. Validate invoice belongs to the expected customer, subscription and active recurring price. Quantity/period come from paid invoice, not browser. Zero-dollar or prorated invoices must not mint a full monthly allotment; v1 has no trial/proration. State changes via subscription updated/deleted reconcile period end/cancel status. invoice.payment_failed shows payment issue; no future-period credits until paid. Existing purchased credits stay usable unless fraud/refund reconciliation requires account restrictions.

## Ledger model
Each credit grant has original quantity, available, held and consumed; sum equals original quantity after accounting for expired/revoked separately. Reserve soonest-expiring valid grant, then non-expiring pack. Lock the owner's credit-account row and chosen grant during reservation; one credit only. A reservation is unique per generation; a job is unique per owner/idempotency key. Same key + different payload returns 409.

Capture changes held -> consumed, once, only after durable valid output. Release changes held -> available if still valid, once. If a held monthly credit expires while rendering, allow the active reservation to finish; held units are never expired by the grant sweeper. On failure after grant expiration, settle its held unit into expired and issue a uniquely keyed replacement credit valid 7 days, so 'credit returned' remains true. This policy is an explicit product decision to implement. The app's customer credits are unrelated to provider billing refunds.

Available balance excludes held, expired, revoked. Consumption from monthly buckets precedes non-expiring packs. Expiry job expires only unused available credits after paid period end. Credit history is append-only derived events: purchase, monthly grant, hold, completed film, released hold, expiration and refund reversal. A user cannot mutate ledger.

## Subscription changes
v1 changes take effect next renewal, with no immediate proration; preserve current credits and schedule the future price with Stripe's supported subscription schedule mechanism. Cancellation sets cancel_at_period_end; user keeps current-period credits until expiry and pack credits indefinitely. Resuming before period end clears cancellation. Renewal/cancellation endpoints are owner-checked and idempotent. Show effective date, next total and clear confirmation. Dates in boards are only examples.

## Refunds / disputes
Monetary refunds are separate from generation-credit releases. Consume refund and dispute events exactly once against the originating purchase; revoke unspent credits from that source. If some were already consumed, do not force negative available balances: record an entitlement debt/review flag, block new spending if necessary, and resolve via a documented support policy. A later reversal of a dispute must not recreate credits already consumed or otherwise refunded. Do not erase financial audit rows when user deletes a film or account.

## Costs and launch gate
No fixed provider cost is embedded as truth: published pages disagree by tier/endpoint/audio and may change. Log actual billed/estimated cost per model configuration separately, set per-job and daily budgets, and measure retries/payment fees/storage before launching these proposed prices. No unlimited plan, no unlimited free trial, and no provider key exposed to end users.
