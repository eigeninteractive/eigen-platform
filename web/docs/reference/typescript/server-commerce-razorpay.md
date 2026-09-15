# @eigeninteractive/server/commerce/razorpay

Razorpay for the EigenInteractive commerce runtime.

Razorpay is the third storefront because India is a card-hostile market that
runs on UPI, netbanking and mandates, and neither Play nor Stripe covers it
the same way. The integration differs from Stripe in three ways worth
knowing before reading further:

- **There is no Price object.** A one-time sale is an Order carrying an
  amount, and a recurring one is a Plan. The engine's `providerReference` is
  therefore a `plan_...` for a subscription and the engine's own offer key
  for a one-time sale, whose amount comes from the catalog rather than the
  provider. `amounts` carries those, in the minor unit, because Razorpay has
  nothing to read them from.
- **Hosted checkout is a Payment Link.** There is no Checkout Session; a link
  is created server-side and the player is sent to its `short_url`.
- **There is no customer portal.** Razorpay has no Stripe-style billing
  portal, so `management` is deliberately absent and the engine's management
  route answers that this provider is managed elsewhere.

## Interfaces

### RazorpayCommerceConfig

Defined in: [server/packages/server/src/commerce/providers/razorpay.ts:30](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/razorpay.ts#L30)

#### Type Parameters

| Type Parameter |
| ------ |
| `TEnv` |

#### Properties

##### amounts?

```ts
optional amounts?: Readonly<Record<string, {
  amount: number;
  currency: string;
}>>;
```

Defined in: [server/packages/server/src/commerce/providers/razorpay.ts:39](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/razorpay.ts#L39)

Amount in the minor unit and currency per one-time `providerReference`.
Razorpay has no priced product to read, so a payment link must be told.

##### now?

```ts
optional now?: () => number;
```

Defined in: [server/packages/server/src/commerce/providers/razorpay.ts:40](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/razorpay.ts#L40)

###### Returns

`number`

#### Methods

##### keyId()

```ts
keyId(env): string | undefined;
```

Defined in: [server/packages/server/src/commerce/providers/razorpay.ts:31](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/razorpay.ts#L31)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

`string` \| `undefined`

##### keySecret()

```ts
keySecret(env): string | undefined;
```

Defined in: [server/packages/server/src/commerce/providers/razorpay.ts:32](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/razorpay.ts#L32)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

`string` \| `undefined`

##### webhookSecret()

```ts
webhookSecret(env): string | undefined;
```

Defined in: [server/packages/server/src/commerce/providers/razorpay.ts:34](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/razorpay.ts#L34)

The secret configured on the webhook, not the API key secret.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

`string` \| `undefined`

## Functions

### razorpayCommerceProvider()

```ts
function razorpayCommerceProvider<TEnv>(config): CommerceProvider<TEnv>;
```

Defined in: [server/packages/server/src/commerce/providers/razorpay.ts:93](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/razorpay.ts#L93)

#### Type Parameters

| Type Parameter |
| ------ |
| `TEnv` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`RazorpayCommerceConfig`](#razorpaycommerceconfig)\<`TEnv`\> |

#### Returns

[`CommerceProvider`](server.md#commerceprovider)\<`TEnv`\>
