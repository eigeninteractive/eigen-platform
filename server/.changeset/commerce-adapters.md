---
"@eigeninteractive/commerce-google-play": minor
"@eigeninteractive/commerce-stripe": minor
"@eigeninteractive/commerce-razorpay": minor
"@eigeninteractive/server": minor
---

Add the three optional commerce provider adapters: Google Play Billing for
Android, and Stripe and Razorpay for the web.

They are separate packages so a game that sells nothing inherits neither their
code nor their configuration, which is what ADR 0011 asks of a provider.

`@eigeninteractive/server` gains a `./commerce-kit` entry point carrying the
primitives every adapter needs on Workers: an HMAC, a constant-time hex
comparison, and a JSON call whose failures name the provider without quoting
the credential that failed with it.
