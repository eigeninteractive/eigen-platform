# @eigeninteractive/server/testing

`@eigeninteractive/server/testing`: the test-auth recipe, for the engine's own
suite and for implementor test workers alike:

```ts
// test/worker.ts, your production entry with explicit Firebase fakes:
export default createEngine({
  ...sameConfig,
  testing: {
    auth: testVerifier(),
    firebaseAdmin: () => testFirebaseAdmin,
  },
});
// a spec:
import { exports } from "cloudflare:workers";
await exports.default.fetch(url, { headers: await testBearer({ uid: "alice" }) });
```

(`exports.default` is the loopback binding to the test worker's default
export, the supported replacement for the deprecated `SELF` fetcher. It
needs `Cloudflare.GlobalProps` to declare `mainModule`; see the engine's
own `test/env.d.ts` for the hand-rolled version, or use `wrangler types`.)

Tokens are verified through the SAME jose code path production uses; only
the JWKS is local. The RS256 keypair below is a public fixture (checked in,
shipped in the package); it protects nothing and must never reach a
production config: pass `testing` ONLY in test workers.

## Interfaces

### FakeCommerceEvidence

Defined in: [server/packages/server/src/testing.ts:114](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L114)

#### Properties

##### accountId

```ts
accountId: string;
```

Defined in: [server/packages/server/src/testing.ts:117](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L117)

##### kind?

```ts
optional kind?: "oneTime" | "subscription";
```

Defined in: [server/packages/server/src/testing.ts:122](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L122)

##### providerReference

```ts
providerReference: string;
```

Defined in: [server/packages/server/src/testing.ts:116](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L116)

##### purchasedAt?

```ts
optional purchasedAt?: number;
```

Defined in: [server/packages/server/src/testing.ts:119](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L119)

##### requiresAcknowledgement?

```ts
optional requiresAcknowledgement?: boolean;
```

Defined in: [server/packages/server/src/testing.ts:123](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L123)

##### sealedProviderState?

```ts
optional sealedProviderState?: string;
```

Defined in: [server/packages/server/src/testing.ts:124](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L124)

##### state?

```ts
optional state?: CommerceTransactionState;
```

Defined in: [server/packages/server/src/testing.ts:118](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L118)

##### transactionId

```ts
transactionId: string;
```

Defined in: [server/packages/server/src/testing.ts:115](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L115)

##### validFrom?

```ts
optional validFrom?: number;
```

Defined in: [server/packages/server/src/testing.ts:120](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L120)

##### validUntil?

```ts
optional validUntil?: number;
```

Defined in: [server/packages/server/src/testing.ts:121](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L121)

***

### FakeCommerceProvider

Defined in: [server/packages/server/src/testing.ts:134](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L134)

A fake provider with the controls a lifecycle test needs.

Reconciliation and acknowledgement are the two places where the engine
depends on a provider doing something later, so a fake that cannot fail,
stall, or refuse to answer cannot prove either of them works.

#### Extends

- [`CommerceProvider`](server.md#commerceprovider)\<`unknown`\>

#### Properties

##### acknowledged

```ts
readonly acknowledged: string[];
```

Defined in: [server/packages/server/src/testing.ts:139](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L139)

Every transaction this provider was asked to acknowledge, in order.

##### checkouts

```ts
readonly checkouts: {
  accountId: string;
  operationId: string;
  providerReference: string;
  url: string;
}[];
```

Defined in: [server/packages/server/src/testing.ts:149](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L149)

One entry per checkout session the provider actually opened. A replayed
operation identity must not add one.

###### accountId

```ts
accountId: string;
```

###### operationId

```ts
operationId: string;
```

###### providerReference

```ts
providerReference: string;
```

###### url

```ts
url: string;
```

##### key

```ts
readonly key: string;
```

Defined in: [server/packages/server/src/commerce/types.ts:148](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L148)

###### Inherited from

[`CommerceProvider`](server.md#commerceprovider).[`key`](server.md#key-1)

##### sweeps

```ts
readonly sweeps: string[][];
```

Defined in: [server/packages/server/src/testing.ts:141](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L141)

Each sweep's requested ids, in order. Proves queue rotation.

##### transactions

```ts
readonly transactions: Map<string, Partial<VerifiedCommerceTransaction>>;
```

Defined in: [server/packages/server/src/testing.ts:137](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L137)

Current provider truth per transaction, returned by the next sweep.
A transaction absent from here is one the provider will not answer for.

#### Methods

##### acknowledge()?

```ts
optional acknowledge(env, transaction): Promise<void>;
```

Defined in: [server/packages/server/src/commerce/types.ts:156](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L156)

Runs only after the normalized transaction and grants commit.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `unknown` |
| `transaction` | [`CommerceTransactionReference`](server.md#commercetransactionreference) |

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`CommerceProvider`](server.md#commerceprovider).[`acknowledge`](server.md#acknowledge)

##### clearFailures()

```ts
clearFailures(): void;
```

Defined in: [server/packages/server/src/testing.ts:146](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L146)

###### Returns

`void`

##### createCheckout()?

```ts
optional createCheckout(env, input): Promise<CommerceCheckout>;
```

Defined in: [server/packages/server/src/commerce/types.ts:157](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L157)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `unknown` |
| `input` | `CreateCheckoutInput` |

###### Returns

`Promise`\<[`CommerceCheckout`](server.md#commercecheckout)\>

###### Inherited from

[`CommerceProvider`](server.md#commerceprovider).[`createCheckout`](server.md#createcheckout)

##### failAcknowledgement()

```ts
failAcknowledgement(message?): void;
```

Defined in: [server/packages/server/src/testing.ts:145](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L145)

Make every `acknowledge` throw until cleared.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `message?` | `string` |

###### Returns

`void`

##### failNextSweep()

```ts
failNextSweep(message?): void;
```

Defined in: [server/packages/server/src/testing.ts:143](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L143)

Make the whole next `reconcile` call throw, as a provider outage does.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `message?` | `string` |

###### Returns

`void`

##### management()?

```ts
optional management(
   env,
   accountId,
   providerAccountId,
   returnUrl
): Promise<CommerceManagement>;
```

Defined in: [server/packages/server/src/commerce/types.ts:158](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L158)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `unknown` |
| `accountId` | `string` |
| `providerAccountId` | `string` |
| `returnUrl` | `string` |

###### Returns

`Promise`\<[`CommerceManagement`](server.md#commercemanagement)\>

###### Inherited from

[`CommerceProvider`](server.md#commerceprovider).[`management`](server.md#management)

##### products()?

```ts
optional products(env, providerReferences): Promise<readonly CommerceProduct[]>;
```

Defined in: [server/packages/server/src/commerce/types.ts:149](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L149)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `unknown` |
| `providerReferences` | readonly `string`[] |

###### Returns

`Promise`\<readonly [`CommerceProduct`](server.md#commerceproduct)[]\>

###### Inherited from

[`CommerceProvider`](server.md#commerceprovider).[`products`](server.md#products)

##### reconcile()?

```ts
optional reconcile(env, transactions): Promise<readonly VerifiedCommerceTransaction[]>;
```

Defined in: [server/packages/server/src/commerce/types.ts:154](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L154)

Fetches current state for locally active or pending transaction refs.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `unknown` |
| `transactions` | readonly [`CommerceTransactionReference`](server.md#commercetransactionreference)[] |

###### Returns

`Promise`\<readonly [`VerifiedCommerceTransaction`](server.md#verifiedcommercetransaction)[]\>

###### Inherited from

[`CommerceProvider`](server.md#commerceprovider).[`reconcile`](server.md#reconcile-1)

##### reportProviderAccount()

```ts
reportProviderAccount(providerAccountId): void;
```

Defined in: [server/packages/server/src/testing.ts:152](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L152)

Report this provider customer on the next checkout instead of the
account's usual one, as a provider confusing two customers would.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `providerAccountId` | `string` |

###### Returns

`void`

##### verifyClaim()

```ts
verifyClaim(env, input): Promise<VerifiedCommerceTransaction>;
```

Defined in: [server/packages/server/src/commerce/types.ts:150](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L150)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `unknown` |
| `input` | `VerifyClaimInput` |

###### Returns

`Promise`\<[`VerifiedCommerceTransaction`](server.md#verifiedcommercetransaction)\>

###### Inherited from

[`CommerceProvider`](server.md#commerceprovider).[`verifyClaim`](server.md#verifyclaim)

##### verifyWebhook()?

```ts
optional verifyWebhook(env, request): Promise<VerifiedCommerceEvent>;
```

Defined in: [server/packages/server/src/commerce/types.ts:152](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L152)

Verifies the raw request and fetches current provider state when needed.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `unknown` |
| `request` | `Request` |

###### Returns

`Promise`\<[`VerifiedCommerceEvent`](server.md#verifiedcommerceevent)\>

###### Inherited from

[`CommerceProvider`](server.md#commerceprovider).[`verifyWebhook`](server.md#verifywebhook)

***

### TestTokenOptions

Defined in: [server/packages/server/src/testing.ts:71](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L71)

#### Properties

##### anonymous?

```ts
optional anonymous?: boolean;
```

Defined in: [server/packages/server/src/testing.ts:73](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L73)

##### claims?

```ts
optional claims?: Record<string, unknown>;
```

Defined in: [server/packages/server/src/testing.ts:78](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L78)

Override any registered claim (e.g. an expired `exp`, a wrong `aud`).

##### email?

```ts
optional email?: string;
```

Defined in: [server/packages/server/src/testing.ts:74](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L74)

##### name?

```ts
optional name?: string;
```

Defined in: [server/packages/server/src/testing.ts:75](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L75)

##### picture?

```ts
optional picture?: string;
```

Defined in: [server/packages/server/src/testing.ts:76](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L76)

##### uid

```ts
uid: string;
```

Defined in: [server/packages/server/src/testing.ts:72](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L72)

## Variables

### TEST\_PROJECT\_ID

```ts
const TEST_PROJECT_ID: "eigen-test" = "eigen-test";
```

Defined in: [server/packages/server/src/testing.ts:37](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L37)

***

### testFirebaseAdmin

```ts
const testFirebaseAdmin: FirebaseAdminEffects;
```

Defined in: [server/packages/server/src/testing.ts:61](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L61)

No-op Firebase Admin effects for test workers and test Durable Objects.

## Functions

### fakeCommerceProvider()

```ts
function fakeCommerceProvider(
   products,
   now?,
   key?
): FakeCommerceProvider;
```

Defined in: [server/packages/server/src/testing.ts:156](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L156)

Deterministic provider for commerce lifecycle and implementor conformance tests.

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `products` | readonly [`CommerceProduct`](server.md#commerceproduct) & \{ `kind?`: `"oneTime"` \| `"subscription"`; \}[] | `undefined` | - |
| `now` | () => `number` | `Date.now` | - |
| `key` | `string` | `"fake"` | The provider key. Give a sweep test its own, so the reconciliation queue it reasons about holds only the rows that test seeded. |

#### Returns

[`FakeCommerceProvider`](#fakecommerceprovider)

***

### mintTestToken()

```ts
function mintTestToken(opts): Promise<string>;
```

Defined in: [server/packages/server/src/testing.ts:81](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L81)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `opts` | [`TestTokenOptions`](#testtokenoptions) |

#### Returns

`Promise`\<`string`\>

***

### testBearer()

```ts
function testBearer(opts): Promise<Record<string, string>>;
```

Defined in: [server/packages/server/src/testing.ts:100](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L100)

Authorization header for a minted token.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `opts` | [`TestTokenOptions`](#testtokenoptions) |

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

***

### testMutationHeaders()

```ts
function testMutationHeaders(opts): Promise<Record<string, string>>;
```

Defined in: [server/packages/server/src/testing.ts:107](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L107)

Headers for an authenticated JSON mutation.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `opts` | [`TestTokenOptions`](#testtokenoptions) |

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

***

### testVerifier()

```ts
function testVerifier(): TokenVerifier;
```

Defined in: [server/packages/server/src/testing.ts:67](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L67)

The verifier a test worker passes under `createEngine({ testing })`.

#### Returns

[`TokenVerifier`](server.md#tokenverifier)

***

### withCreationId()

```ts
function withCreationId(
   method,
   path,
   body
): unknown;
```

Defined in: [server/packages/server/src/testing.ts:296](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L296)

Adds a fresh `creationId` to a game-creation body that does not already
carry one.

Game creation is operation-specifically idempotent: `POST /games` and
`POST /games/solo` bind the caller, this identity, and a fingerprint of the
creation inputs, so a retry returns the original game instead of creating --
or commercially counting -- a second one. A test that is not about that
binding still has to send an identity, and wants a different one each time.

`POST /games/local` is deliberately absent: an imported game carries the
device's own `gameId` as its whole identity and takes no `creationId`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `method` | `string` |
| `path` | `string` |
| `body` | `unknown` |

#### Returns

`unknown`
