# eigen_commerce_hosted

Provider-hosted checkout as [EigenInteractive](https://eigeninteractive.com)
storefronts — Stripe and Razorpay. Optional: a game that sells only through a
store SDK never depends on this package.

```dart
storefrontsProvider.overrideWith(
  (ref) => [
    StripeHostedStorefront(returnUrl: Uri.parse('https://game.example/store/return')),
  ],
),
```

The Worker creates the checkout URL — it holds the secret key, and the session
is bound to the account there — so this package only opens it and reads the
return. **No payment SDK runs on the device and no card data passes through the
app**, which is the point of hosted checkout rather than an embedded form.

## The return URL

It must use the Worker's origin or a configured trusted client origin, and it
must be `http`/`https`: a custom URI scheme will not do. On Android and iOS that
means an App Link or Universal Link the system routes back into the app.

`CommerceService` appends the logical offer key to it before asking for a
checkout, because a provider's return names a session or a payment and never
the offer the player thought they were buying — which is what a claim is made
against.

Give each storefront its own return path when a build carries more than one.
They are asked in turn to recognize a URL, and a Stripe return and a Razorpay
return are told apart by their query parameters alone.

## Leaving and coming back are separate events

On the web, opening checkout replaces the page: the app is unloaded, and the
return is an ordinary cold start that happens to carry a purchase. That is why
recognizing a return is `resume`'s job rather than something `present` could
await. Call it with the URL the app was opened at, and again whenever a deep
link arrives:

```dart
await commerceService.resumeFrom(Uri.base);
```

A return that carries no purchase identifier is reported as a cancellation, and
a URL no storefront recognizes changes nothing.

## The webhook is still authoritative

A browser closed on a slow network returns nothing at all, and `present` reports
that honestly as `pending` rather than inventing an outcome. The provider's
webhook reaches the Worker regardless, so an entitlement appears whether or not
the player ever came back.
