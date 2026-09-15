# eigen_commerce_play

Google Play Billing as an [EigenInteractive](https://eigeninteractive.com)
storefront. Optional: a game that sells nothing, or sells only through hosted
checkout, never depends on this package and its Android build never links Play
Billing.

```dart
CommerceService(
  repository,
  [PlayPurchaseGateway(accountId: () => auth.currentUser!.uid)],
  deliveries,
);
```

Or, through the shell's composition root:

```dart
storefrontsProvider.overrideWith(
  (ref) => [PlayPurchaseGateway(accountId: () => ref.read(accountIdProvider))],
),
```

An offer's `providerReferences.google_play` is the **product id** from the Play
Console. The Worker must register the matching
`@eigeninteractive/server/commerce/google-play` adapter, because that is what a
claim is routed by.

## What this gateway owns

- Localized product details from Play, for the offers your catalog lists.
- The purchase flow, as a **consumable** for a `repeatable` offer and a
  non-consumable otherwise. Play will not sell the same non-consumable twice,
  so a tip bought as one can never be tipped again.
- The account binding. `accountId` travels as Play's `obfuscatedAccountId` and
  the Worker's adapter reads it back as `obfuscatedExternalAccountId`, which is
  how a developer notification — which names no Eigen account — is attributed
  to one. It is read at purchase time, not captured, because the signed-in
  account outlives no session in particular.
- Acknowledgement, and only after the Worker has committed the entitlement.

## What it deliberately does not own

Verification. A `purchased` update is a claim that Play says something was
bought; `CommerceService` sends its evidence to the Worker, which re-reads the
purchase from the Android Publisher API before any of it becomes access.

## The three-day refund

Play refunds an unacknowledged purchase after three days, whether or not the
player got what they paid for. `complete` therefore settles from the durable
evidence in the delivery outbox as readily as from a live SDK object: an
acknowledgement interrupted by a crash must still happen on the next start, and
waiting for Play to re-deliver is not a settlement strategy.

## Android only

Play Billing exists on Android. On any other platform this gateway finds no
billing service and offers no products, which is the correct behaviour for a
build that also carries a hosted storefront.
