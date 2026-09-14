# @eigeninteractive/commerce-google-play

Google Play Billing for the [EigenInteractive](https://eigeninteractive.com)
commerce runtime. Optional: a game that sells nothing never installs it.

```ts
import { createEngine } from "@eigeninteractive/server";
import { googlePlayCommerceProvider } from "@eigeninteractive/commerce-google-play";

export default createEngine({
  // ...
  commerce: {
    catalog,
    providers: [
      googlePlayCommerceProvider({
        packageName: (env) => env.PLAY_PACKAGE_NAME,
        serviceAccountEmail: (env) => env.PLAY_SERVICE_ACCOUNT_EMAIL,
        serviceAccountPrivateKey: (env) => env.PLAY_SERVICE_ACCOUNT_KEY,
      }),
    ],
  },
});
```

`PLAY_SERVICE_ACCOUNT_KEY` is the PKCS#8 `private_key` from the service
account's JSON, newlines intact, and belongs in a Worker secret. The service
account needs the `androidpublisher` scope and access to the app in Play
Console.

An offer's `providerReferences.google_play` is the **product id**. The client
sends `{ purchaseToken }` as its claim evidence, plus `kind: "subscription"`
for a subscription.

## What this adapter owns

- Verification of a purchase token against the Play Developer API, including
  the check that Play's obfuscated account id matches the claiming account.
- **Acknowledgement.** Play refunds a purchase that is not acknowledged within
  three days. The engine acknowledges only after the entitlement is durable,
  and its reconciliation sweep retries an acknowledgement lost in between, so a
  crash between the two cannot cost the player their purchase.
- Real-time Developer Notifications delivered by Pub/Sub push. Google does not
  sign the body, so **the push endpoint itself must be authenticated by the
  deployment** — a Pub/Sub OIDC token, or an unguessable path. The notification
  is treated as a change signal: the purchase is always read back from the API.

There is no `createCheckout`: Play's purchase flow is launched by the Billing
library on the device.

The purchase token is a credential. It is carried as the transaction's sealed
provider state so the sweep can use it again, and it is never logged, returned
to a client, or included in an error.
