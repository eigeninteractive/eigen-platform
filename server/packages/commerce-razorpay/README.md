# @eigeninteractive/commerce-razorpay

Razorpay for the [EigenInteractive](https://eigeninteractive.com) commerce
runtime. Optional: a game that sells nothing never installs it.

```ts
import { razorpayCommerceProvider } from "@eigeninteractive/commerce-razorpay";

providers: [
  razorpayCommerceProvider({
    keyId: (env) => env.RAZORPAY_KEY_ID,
    keySecret: (env) => env.RAZORPAY_KEY_SECRET,
    webhookSecret: (env) => env.RAZORPAY_WEBHOOK_SECRET,
    // Razorpay has no priced product to read, so one-time offers are priced here.
    amounts: { supporter_once: { amount: 49900, currency: "INR" } },
  }),
];
```

Razorpay exists in this set because India runs on UPI, netbanking and mandates
rather than cards, and neither Play nor Stripe covers that the same way.

## How it differs from Stripe

- **There is no Price object.** A subscription's `providerReferences.razorpay`
  is a Plan id (`plan_...`). A one-time sale has no priced product at all, so
  its reference is the engine's own key and `amounts` supplies the amount in the
  minor unit.
- **Hosted checkout is a Payment Link**, created server-side with the engine's
  operation identity as its `reference_id`, which Razorpay refuses to duplicate.
- **There is no customer portal.** `management` is absent, and the engine
  answers plainly that this provider does not open one.
- **Webhook signatures cover the raw body with no timestamp**, so replay
  protection is the engine's event-identity deduplication rather than a
  freshness window.

Razorpay's `pending` means an auto-charge failed and is being retried, which is
the engine's **`grace`**, not its `pending`. Reading it the other way would cut
off a paying player mid-retry.
