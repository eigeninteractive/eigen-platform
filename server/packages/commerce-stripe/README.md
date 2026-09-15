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

## API version

Every request pins `Stripe-Version`. Unpinned, Stripe answers in whatever
version the merchant's dashboard is set to, which they can change without
telling anyone who wrote code against it — and Basil (2025-03-31) moved a
subscription's billing period onto its line items, so an adapter reading the
old field would quietly stop knowing when a subscription ends.

**Set your webhook endpoint to the same version.** Events use the version
configured on the endpoint, not the one a request pins. The adapter re-reads
every object from the API before acting on it, so a mismatch is survivable, but
matching them keeps the shapes you see in logs consistent.

Bumping `API_VERSION` is a deliberate change, not housekeeping. This adapter
types Stripe's responses by hand rather than pulling in `stripe-node`, so a
field this file reads can move without anything failing to compile — which is
how the Basil change above would have been missed. Read the
[API changelog](https://docs.stripe.com/changelog) between the two versions for
moved or removed fields on Subscription, Checkout Session and Price before
raising it, and check the interfaces at the top of `src/index.ts` against what
you find.
