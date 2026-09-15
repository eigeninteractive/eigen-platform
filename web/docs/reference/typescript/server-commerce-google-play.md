# @eigeninteractive/server/commerce/google-play

Google Play Billing for the EigenInteractive commerce runtime.

Play is the adapter the engine's acknowledgement machinery exists for. Play
requires a purchase to be acknowledged within three days or it is
automatically refunded, and the acknowledgement must happen only after the
entitlement is durable -- which is exactly the order
`acknowledgeIfNeeded` enforces: ledger first, provider second, and the
reconciliation sweep repairs an acknowledgement lost in between.

Two Play-specific facts shape the rest:

- **The purchase token is the identity and the handle.** Every later call
  about a purchase needs it again, so it is returned as the transaction's
  `sealedProviderState` and the engine stores it for the sweep. It is a
  credential: it never appears in a log, an error, or a client response.
- **A product id is not enough.** A one-time purchase is read at
  `products/{productId}/tokens/{token}`, so the engine's `providerReference`
  is the product id; a subscription is read at `subscriptionsv2/tokens/{token}`
  with no product in the path, and the line item names the plan afterwards.

There is no `createCheckout`: Play checkout is launched by the Billing
library on the device, and the engine answers that plainly for this provider.

## Interfaces

### GooglePlayCommerceConfig

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:36](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L36)

#### Type Parameters

| Type Parameter |
| ------ |
| `TEnv` |

#### Properties

##### now?

```ts
optional now?: () => number;
```

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:43](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L43)

###### Returns

`number`

#### Methods

##### packageName()

```ts
packageName(env): string | undefined;
```

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:38](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L38)

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

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:40](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L40)

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

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:42](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L42)

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

Defined in: [server/packages/server/src/commerce/providers/google-play.ts:102](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/google-play.ts#L102)

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
