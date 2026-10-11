# @eigeninteractive/server/commerce/google-play

Google Play Billing for the EigenInteractive commerce runtime.

Play is the adapter the engine's acknowledgement machinery exists for. Play
requires a purchase to be acknowledged within three days or it is
automatically refunded, and the acknowledgement must happen only after the
entitlement is durable -- which is exactly the order
`acknowledgeIfNeeded` enforces: ledger first, provider second, and the
reconciliation sweep repairs an acknowledgement lost in between.

Play-specific facts shape the rest:

- **The purchase token is the identity and the handle.** Every later call
  about a purchase needs it again, so it is returned as the transaction's
  `sealedProviderState` and the engine stores it for the sweep. It is a
  credential: it never appears in a log, an error, or a client response.
- **A product id is not enough.** A one-time product's reference is its
  product id, read back from `productsv2` by token alone, so Play -- not the
  claim -- says which product was bought. A subscription product sells
  through base plans --
  monthly and yearly are two base plans of one product -- so its reference is
  `{productId}:{basePlanId}` (see [googlePlaySubscriptionReference](#googleplaysubscriptionreference)).
  An offer (a free trial, an introductory price) is a price on a base plan,
  not a different thing bought, so it is deliberately not part of the
  reference; its offer token is the device's business when it launches the
  Billing flow.
- **The token is the transaction.** It is stable from a pending purchase to
  a paid one, where the order id does not exist yet, so it is the identity
  for both kinds.
- **The device cannot say which base plan it bought.** Play's on-device
  purchase names the product, not the plan, so a claim may name any plan of
  that product; the plan Play reports here is the one recorded.
- **A plan change is a new purchase.** Play issues a new purchase token for
  every plan change, to be claimed and acknowledged like any purchase, names
  the old one as `linkedPurchaseToken`, and reports it expired. The ledger
  ends the old transaction, as Google asks. A deferred change issues it at once but
  keeps serving the old plan from it until renewal, so the new token holds
  two line items and swaps which one serves. The reference is read from
  whichever is serving now, and the ledger moves the transaction to the new
  offer when that changes.
- **Acknowledgement is not on the v2 resources.** Purchases are read from
  `productsv2` and `subscriptionsv2` but acknowledged at the v1
  `products/{productId}/tokens` and `subscriptions/{productId}/tokens`,
  which have no v2 counterpart.
- **A refund is a notification, not a state.** A voided one-time purchase
  may still read as purchased, so the voided notification itself revokes it,
  as Google's notification reference allows.

There is no `createCheckout`: Play checkout is launched by the Billing
library on the device, and the engine answers that plainly for this provider.

## Interfaces

### GooglePlayCommerceConfig

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:63](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L63)

#### Type Parameters

| Type Parameter |
| ------ |
| `TEnv` |

#### Properties

##### now?

```ts
optional now?: () => number;
```

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:70](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L70)

###### Returns

`number`

#### Methods

##### packageName()

```ts
packageName(env): string | undefined;
```

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:65](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L65)

The app's package name, e.g. `com.example.game`.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

`string` \| `undefined`

##### serviceAccountEmail()

```ts
serviceAccountEmail(env): string | undefined;
```

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:67](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L67)

The service account's `client_email` from its JSON key.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

`string` \| `undefined`

##### serviceAccountPrivateKey()

```ts
serviceAccountPrivateKey(env): string | undefined;
```

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:69](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L69)

The service account's PKCS#8 `private_key`, PEM, newlines intact.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

`string` \| `undefined`

## Functions

### googlePlayCommerceProvider()

```ts
function googlePlayCommerceProvider<TEnv>(config): CommerceProvider<TEnv>;
```

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:208](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L208)

#### Type Parameters

| Type Parameter |
| ------ |
| `TEnv` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`GooglePlayCommerceConfig`](#googleplaycommerceconfig)\<`TEnv`\> |

#### Returns

[`CommerceProvider`](server.md#commerceprovider)\<`TEnv`\>

***

### googlePlaySubscriptionReference()

```ts
function googlePlaySubscriptionReference(productId, basePlanId): string;
```

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:119](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L119)

The `providerReference` a catalog names for a Play subscription base plan.

Play product ids are lowercase letters, digits, underscores and periods, and
base plan ids are lowercase letters, digits and hyphens, so the colon cannot
occur in either half.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `productId` | `string` |
| `basePlanId` | `string` |

#### Returns

`string`
