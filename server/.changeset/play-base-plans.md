---
"@eigeninteractive/server": minor
---

**Breaking:** a Google Play subscription is referenced by base plan,
`productId:basePlanId`, rather than by product id. Update each Play
subscription offer's `providerReferences.google_play`;
`googlePlaySubscriptionReference(productId, basePlanId)` builds one. One-time
products keep their product id.

Monthly and yearly are two base plans of one Play product, so the product id
could not sell them as two offers. The adapter reads the plan from the line item
serving now. A deferred plan change issues a new token that serves the old plan
until renewal and then swaps its line item; the transaction follows that swap
rather than refusing it. A purchase serving
several line items at once (add-on subscriptions) is refused rather than
granting only its first item. The adapter now tells a subscription from a
one-time product by the reference's shape, so the device no longer has to send
`kind: "subscription"` with its evidence, which `PlayPurchaseGateway` never
did.

A claim's `offerKey` now steers verification only: the offer recorded is the
one the provider verifies. Play's on-device purchase names a subscription's
product but never its base plan, so a device restoring a purchase cannot know
which offer to claim, and a strict match refused paying players.

**Fixed:** Play subscriptions are acknowledged at
`purchases/subscriptions/{productId}/tokens/{token}:acknowledge`. The adapter
posted to `subscriptionsv2`, which has no acknowledge method, so every Play
subscription failed acknowledgement and would have been refunded after three
days.

A subscription that changes plan in place, through a Play deferred replacement
or a Stripe Billing Portal switch, now moves its transaction to the new offer
and revokes whatever only the old offer granted. Both used to be refused as a
change of product identity, leaving the row stalled.

The access snapshot no longer lists an entitlement the catalog no longer
defines. It already granted nothing.
