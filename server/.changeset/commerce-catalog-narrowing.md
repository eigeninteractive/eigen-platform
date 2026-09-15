---
"@eigeninteractive/server": minor
---

`GET /commerce/catalog` takes an optional `provider` query naming the
storefronts the caller can actually buy through, comma-separated. Only those
adapters are asked for prices, and only their products are listed; an offer
sold through none of them is still listed, with nothing to buy it by. Omitting
it asks every registered storefront, as before.

Without this, a client's first store screen made the Worker call every
configured payment API — a round trip each to Stripe and Razorpay for an
Android build that can render neither.

Naming a storefront the deployment has not configured is ignored so a build
that knows about more than this deployment has still sells through the ones it
has; naming *only* unknown storefronts is a mismatch and answers 404 rather
than an empty store.

Stripe's hosted checkout now brings its session id back on the return URL
(`session_id={CHECKOUT_SESSION_ID}`). `verifyClaim` reads the session from that
evidence and a returning browser had no other way to know it, so a web purchase
could previously only be recognized when the webhook arrived.
