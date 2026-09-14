# @eigeninteractive/commerce-stripe

Stripe for the EigenInteractive commerce runtime.

Stripe is the web half of the intended pair: the player is redirected to a
Stripe-hosted Checkout Session and comes back, so this adapter owns a
checkout and a management portal that the store-SDK adapters do not have.

Three things about the shape are deliberate:

- **A Price, not a product.** Stripe sells a configured `price_...`, and a
  Product may carry several. The engine's `providerReference` is therefore
  the price id, which is also the only identifier that can be checked against
  what was actually paid for.
- **The Customer is ours to bind, once.** Checkout is created against the
  customer already bound to the account, and the customer Stripe reports back
  is returned to the ledger, which refuses to rebind an account to a second
  one. A portal session cannot be opened without that binding.
- **Nothing trusts the webhook body.** A notification is a signed hint; the
  adapter re-reads the Session, Subscription or PaymentIntent from the API
  before anything becomes an entitlement.

## Interfaces

### StripeCommerceConfig

Defined in: [server/packages/commerce-stripe/src/index.ts:32](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/commerce-stripe/src/index.ts#L32)

Everything this adapter needs from the Worker's environment.

#### Type Parameters

| Type Parameter |
| ------ |
| `TEnv` |

#### Properties

##### now?

```ts
optional now?: () => number;
```

Defined in: [server/packages/commerce-stripe/src/index.ts:39](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/commerce-stripe/src/index.ts#L39)

###### Returns

`number`

##### toleranceSeconds?

```ts
optional toleranceSeconds?: number;
```

Defined in: [server/packages/commerce-stripe/src/index.ts:38](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/commerce-stripe/src/index.ts#L38)

Seconds a signed payload stays acceptable. Stripe's own default is 300.

#### Methods

##### secretKey()

```ts
secretKey(env): string | undefined;
```

Defined in: [server/packages/commerce-stripe/src/index.ts:34](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/commerce-stripe/src/index.ts#L34)

The restricted or secret API key. Never a publishable key.

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

Defined in: [server/packages/commerce-stripe/src/index.ts:36](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/commerce-stripe/src/index.ts#L36)

The `whsec_...` signing secret for the endpoint Stripe posts to.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

`string` \| `undefined`

## Functions

### stripeCommerceProvider()

```ts
function stripeCommerceProvider<TEnv>(config): CommerceProvider<TEnv>;
```

Defined in: [server/packages/commerce-stripe/src/index.ts:91](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/commerce-stripe/src/index.ts#L91)

#### Type Parameters

| Type Parameter |
| ------ |
| `TEnv` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`StripeCommerceConfig`](#stripecommerceconfig)\<`TEnv`\> |

#### Returns

`CommerceProvider`\<`TEnv`\>
