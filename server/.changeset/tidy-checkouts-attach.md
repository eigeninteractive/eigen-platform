---
"@eigeninteractive/server": minor
---

Fix first-time Stripe subscription checkout, bind purchase claims to the owning account, and close expired one-time checkouts. Scope Stripe retry keys to the player and preserve fragments in return URLs.

Keep refunded one-time purchases revoked across subsequent claims and repairs. Retry Google Play acknowledgment when the API returns an empty error response.

Keep canceled Play subscriptions active through their paid period. Require a verified Eigen account or an owned linked transaction for Play claims, and reject Stripe subscriptions with multiple items or units.

Refuse a new hosted checkout for a non-repeatable offer already bought on any storefront.

Identify Google Play transactions by digest and encrypt the credentials needed for reconciliation. The Play adapter now takes a separate `purchaseTokenKey` Worker secret.

Read Stripe subscriptions through one pinned API version. Both Stripe and Play require a verified period end before granting subscription access.

Back off repeated reconciliation failures to daily retries, with diagnostics available to operators.

Reserve hosted checkout atomically before contacting a provider. Hosted adapters now receive an authorization deadline and may opt into replay when the provider guarantees idempotency.
