# @eigeninteractive/server/commerce/stripe

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
- **A refund changes the charge, not the session.** A one-time purchase is
  read with its payment's charge, so a full refund or a lost dispute revokes
  it, and the charge's own events find the session it paid for.

## Interfaces

### StripeCommerceConfig

Defined in: [server/packages/server/src/commerce/providers/stripe.ts:46](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/stripe.ts#L46)

Everything this adapter needs from the Worker's environment.

#### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-tenv"></a> `TEnv` |

#### Properties

##### apiVersion?

```ts
apiVersion?: string;
```

Defined in: [server/packages/server/src/commerce/providers/stripe.ts:58](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/stripe.ts#L58)

Override the pinned API version. Set the webhook endpoint to the same
version, and expect to revisit the field mapping below if you move back
past Basil.

##### now?

```ts
now?: () => number;
```

Defined in: [server/packages/server/src/commerce/providers/stripe.ts:59](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/stripe.ts#L59)

###### Returns

`number`

##### toleranceSeconds?

```ts
toleranceSeconds?: number;
```

Defined in: [server/packages/server/src/commerce/providers/stripe.ts:52](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/stripe.ts#L52)

Seconds a signed payload stays acceptable. Stripe's own default is 300.

#### Methods

##### secretKey()

```ts
secretKey(env): string | undefined;
```

Defined in: [server/packages/server/src/commerce/providers/stripe.ts:48](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/stripe.ts#L48)

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

Defined in: [server/packages/server/src/commerce/providers/stripe.ts:50](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/stripe.ts#L50)

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

Defined in: [server/packages/server/src/commerce/providers/stripe.ts:144](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/providers/stripe.ts#L144)

#### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-tenv-1"></a> `TEnv` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`StripeCommerceConfig`](#stripecommerceconfig)\<`TEnv`\> |

#### Returns

[`CommerceProvider`](server.md#commerceprovider)\<`TEnv`\>
