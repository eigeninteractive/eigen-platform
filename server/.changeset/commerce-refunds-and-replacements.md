---
"@eigeninteractive/server": minor
---

**Breaking:** the D1 migration is rewritten in place to add
`commerce_transactions.observed_at` and `revision`. Recreate the database; do
not migrate an existing one onto the new tag.

**Breaking:** a Play one-time purchase's transaction identity is now its
purchase token rather than its order id, and it is read from `productsv2` by
token alone, so Play rather than the claim says which product was bought. A
pending purchase has no order id yet, so the old identity recorded it twice.

**Breaking:** `CommerceProvider.verifyWebhook` may resolve `null` for an
authentic notification about no purchase, and `VerifiedCommerceEvent.accountId`
is optional. The ledger attributes an event that names no account through the
transaction it already holds, or the one the purchase replaced, and otherwise
accepts it without recording anything, leaving the player's own claim to
attribute it.

**Fixed:** a refunded Play one-time purchase is revoked. Its voided
notification was read as a subscription, so a refunded player kept what they
bought. A full refund now revokes it even while Play still reads it as
purchased, and a partial refund once nothing is left to refund. Play Console
test notifications are accepted instead of failing with 502.

**Fixed:** a purchase that replaced another — Play's `linkedPurchaseToken`, on
every plan change and resubscription — ends the replaced transaction and
revokes its grants, so a downgrade no longer keeps what only the old plan
granted until the sweep reads the old token. A purchase naming no account
cannot take over a subscription another account holds.
`VerifiedCommerceTransaction.replacesProviderTransactionId` carries it.

**Fixed:** two verifications of one purchase that race can no longer leave the
earlier provider answer recorded. A write lands only over an older observation,
the grants batched with it are guarded on the row's revision, and an
acknowledgement recorded meanwhile is never undone. `recordVerifiedTransaction`
and `recordVerifiedEvent` take an optional `observedAt`.

**Fixed:** Razorpay accepts a one-time payment only for exactly the configured
`amounts` entry of the offer its notes name, since a payer can write any notes
through Razorpay Checkout; and accepts a payment or subscription claim only for
the account its notes name, where a missing note used to let anyone claim it.

**Fixed:** every authentic provider notification is answered 2xx. One about
no purchase resolves to nothing to record instead of failing with 502: a
Razorpay payment that names no Eigen offer — each subscription renewal's
`payment.captured` is one, and failing it got the webhook disabled after a
day — a Razorpay event about neither a subscription nor a payment, a Stripe
event beyond the lifecycle ones, and a Play notification of a kind the adapter
does not read. Razorpay and Stripe events that name no account are left to the
ledger to attribute, as Play's already were.

**Fixed:** Razorpay events are deduplicated by Razorpay's
`x-razorpay-event-id`. The identity derived from the subscription and its state
made every renewal after the first look like a redelivery of it, so it was
dropped.

**Fixed:** a claim for a purchase made by another account, or a Razorpay
payment that names no offer, answers 409 rather than 502.

A refund or expiry for a product the catalog no longer sells is applied to the
transaction already recorded instead of being refused.

New: `CommerceProvider.validateReference` checks each catalog reference at
`createEngine`. The Play adapter requires `productId:basePlanId` for a
subscription and a bare product id for a one-time product, the Stripe adapter
refuses a Product id, and the Razorpay adapter requires a `plan_` id for a
subscription and an `amounts` entry for a one-time offer.

New: `ProviderRefusal`, from `@eigeninteractive/server/commerce-kit`, marks a
provider answer that will never be accepted, such as a Play purchase of several
products. A claim answers 409 rather than 502, and a notification is accepted
and logged rather than resent for days. The fake provider in
`@eigeninteractive/server/testing` takes `refusal`, `replaces`, an optional
webhook `accountId`, and `ignore: true`.

**Breaking:** the Google Play adapter reads a Real-time Developer Notification
only when its Pub/Sub push token verifies: signed by Google, minted for the URL
the notification arrived at, and naming the adapter's `serviceAccountEmail`.
Anything else is refused before Play is called. Turn on authentication on the
push subscription and have it deliver as the same service account; an
unauthenticated subscription's notifications now fail.
