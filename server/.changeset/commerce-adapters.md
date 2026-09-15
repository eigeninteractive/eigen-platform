---
"@eigeninteractive/server": minor
---

Add the three commerce provider adapters: Google Play Billing for Android, and
Stripe and Razorpay for the web.

Each is its own entry point — `@eigeninteractive/server/commerce/stripe`,
`/razorpay`, `/google-play` — and none is re-exported from the barrel, so a
game that sells nothing carries no storefront code and a game that sells
through one carries only that one. They are entry points rather than separate
packages because they have no dependencies of their own: splitting them out
bought nothing at install time and cost a peer-dependency lockstep on every
change to `CommerceProvider`.

`@eigeninteractive/server` also gains a `./commerce-kit` entry point carrying
the primitives every adapter needs on Workers: an HMAC, a constant-time hex
comparison, and a JSON call whose failures name the provider without quoting
the credential that failed with it.
