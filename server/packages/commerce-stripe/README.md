# @eigeninteractive/commerce-stripe

Stripe for the [EigenInteractive](https://eigeninteractive.com) commerce
runtime. Optional: a game that sells nothing never installs it.

```ts
import { stripeCommerceProvider } from "@eigeninteractive/commerce-stripe";

providers: [
  stripeCommerceProvider({
    secretKey: (env) => env.STRIPE_SECRET_KEY,
    webhookSecret: (env) => env.STRIPE_WEBHOOK_SECRET,
  }),
];
```

An offer's `providerReferences.stripe` is a **Price id** (`price_...`), not a
Product id: a Product may carry several prices, and the price is what was
actually paid. The client returns from Checkout with `{ sessionId }` as its
claim evidence.

## What this adapter owns

- Hosted **Checkout Sessions**, created with the engine's operation identity as
  Stripe's `Idempotency-Key`, so a retried checkout resolves to the session
  Stripe already opened rather than a second one.
- The **customer binding**. Checkout is created against the customer already
  bound to the account, and the customer Stripe reports back is handed to the
  ledger, which refuses to bind an account to a second one.
- The **billing portal**, for managing or cancelling a subscription.
- **Signed webhooks**: `v1` schemes only, a five-minute freshness window, and a
  constant-time comparison. A notification is a hint; the Session or
  Subscription is always re-read from the API before it becomes an entitlement.

`past_due` maps to the engine's `grace`, because Stripe keeps serving through a
failed renewal's retry window.
