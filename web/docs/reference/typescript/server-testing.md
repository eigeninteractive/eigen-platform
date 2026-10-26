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

Defined in: [server/packages/server/src/testing.ts:117](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L117)

#### Properties

##### accountId

```ts
accountId: string;
```

Defined in: [server/packages/server/src/testing.ts:120](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L120)

##### kind?

```ts
kind?: "oneTime" | "subscription";
```

Defined in: [server/packages/server/src/testing.ts:125](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L125)

##### providerReference

```ts
providerReference: string;
```

Defined in: [server/packages/server/src/testing.ts:119](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L119)

##### purchasedAt?

```ts
purchasedAt?: number;
```

Defined in: [server/packages/server/src/testing.ts:122](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L122)

##### refusal?

```ts
refusal?: string;
```

Defined in: [server/packages/server/src/testing.ts:131](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L131)

Answer as a provider that read the purchase and will never accept it.

##### replaces?

```ts
replaces?: string;
```

Defined in: [server/packages/server/src/testing.ts:129](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L129)

The transaction this one replaced, as Play's `linkedPurchaseToken`.

##### requiresAcknowledgement?

```ts
requiresAcknowledgement?: boolean;
```

Defined in: [server/packages/server/src/testing.ts:126](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L126)

##### sealedProviderState?

```ts
sealedProviderState?: string;
```

Defined in: [server/packages/server/src/testing.ts:127](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L127)

##### state?

```ts
state?: CommerceTransactionState;
```

Defined in: [server/packages/server/src/testing.ts:121](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L121)

##### transactionId

```ts
transactionId: string;
```

Defined in: [server/packages/server/src/testing.ts:118](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L118)

##### validFrom?

```ts
validFrom?: number;
```

Defined in: [server/packages/server/src/testing.ts:123](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L123)

##### validUntil?

```ts
validUntil?: number;
```

Defined in: [server/packages/server/src/testing.ts:124](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L124)

***

### FakeCommerceProvider

Defined in: [server/packages/server/src/testing.ts:141](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L141)

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

Defined in: [server/packages/server/src/testing.ts:146](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L146)

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

Defined in: [server/packages/server/src/testing.ts:156](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L156)

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

Defined in: [server/packages/server/src/commerce/types.ts:172](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L172)

###### Inherited from

[`CommerceProvider`](server.md#commerceprovider).[`key`](server.md#key-1)

##### sweeps

```ts
readonly sweeps: string[][];
```

Defined in: [server/packages/server/src/testing.ts:148](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L148)

Each sweep's requested ids, in order. Proves queue rotation.

##### transactions

```ts
readonly transactions: Map<string, Partial<VerifiedCommerceTransaction>>;
```

Defined in: [server/packages/server/src/testing.ts:144](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L144)

Current provider truth per transaction, returned by the next sweep.
A transaction absent from here is one the provider will not answer for.

#### Methods

##### acknowledge()?

```ts
acknowledge?(env, transaction): Promise<void>;
```

Defined in: [server/packages/server/src/commerce/types.ts:190](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L190)

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

Defined in: [server/packages/server/src/testing.ts:153](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L153)

###### Returns

`void`

##### createCheckout()?

```ts
createCheckout?(env, input): Promise<CommerceCheckout>;
```

Defined in: [server/packages/server/src/commerce/types.ts:191](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L191)

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

Defined in: [server/packages/server/src/testing.ts:152](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L152)

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

Defined in: [server/packages/server/src/testing.ts:150](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L150)

Make the whole next `reconcile` call throw, as a provider outage does.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `message?` | `string` |

###### Returns

`void`

##### management()?

```ts
management?(
   env,
   accountId,
   providerAccountId,
   returnUrl
): Promise<CommerceManagement>;
```

Defined in: [server/packages/server/src/commerce/types.ts:192](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L192)

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
products?(env, providerReferences): Promise<readonly CommerceProduct[]>;
```

Defined in: [server/packages/server/src/commerce/types.ts:179](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L179)

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
reconcile?(env, transactions): Promise<readonly VerifiedCommerceTransaction[]>;
```

Defined in: [server/packages/server/src/commerce/types.ts:188](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L188)

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

Defined in: [server/packages/server/src/testing.ts:159](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L159)

Report this provider customer on the next checkout instead of the
account's usual one, as a provider confusing two customers would.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `providerAccountId` | `string` |

###### Returns

`void`

##### validateReference()?

```ts
validateReference?(providerReference, kind): void;
```

Defined in: [server/packages/server/src/commerce/types.ts:178](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L178)

Throws when a catalog reference cannot name anything this provider sells as
an offer of `kind`. Called for every offer at `createEngine`, so a
misspelt reference is a deploy failure rather than a refused purchase.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `providerReference` | `string` |
| `kind` | `"oneTime"` \| `"subscription"` |

###### Returns

`void`

###### Inherited from

[`CommerceProvider`](server.md#commerceprovider).[`validateReference`](server.md#validatereference)

##### verifyClaim()

```ts
verifyClaim(env, input): Promise<VerifiedCommerceTransaction>;
```

Defined in: [server/packages/server/src/commerce/types.ts:180](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L180)

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
verifyWebhook?(env, request): Promise<
  | VerifiedCommerceEvent
| null>;
```

Defined in: [server/packages/server/src/commerce/types.ts:186](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/types.ts#L186)

Verifies the raw request and fetches current provider state when needed.
Resolves null for an authentic notification that concerns no purchase, such
as a console test message, so the provider is answered and stops resending.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `unknown` |
| `request` | `Request` |

###### Returns

`Promise`\<
  \| [`VerifiedCommerceEvent`](server.md#verifiedcommerceevent)
  \| `null`\>

###### Inherited from

[`CommerceProvider`](server.md#commerceprovider).[`verifyWebhook`](server.md#verifywebhook)

***

### TestTokenOptions

Defined in: [server/packages/server/src/testing.ts:74](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L74)

#### Properties

##### anonymous?

```ts
anonymous?: boolean;
```

Defined in: [server/packages/server/src/testing.ts:76](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L76)

##### claims?

```ts
claims?: Record<string, unknown>;
```

Defined in: [server/packages/server/src/testing.ts:81](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L81)

Override any registered claim (e.g. an expired `exp`, a wrong `aud`).

##### email?

```ts
email?: string;
```

Defined in: [server/packages/server/src/testing.ts:77](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L77)

##### name?

```ts
name?: string;
```

Defined in: [server/packages/server/src/testing.ts:78](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L78)

##### picture?

```ts
picture?: string;
```

Defined in: [server/packages/server/src/testing.ts:79](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L79)

##### uid

```ts
uid: string;
```

Defined in: [server/packages/server/src/testing.ts:75](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L75)

## Variables

### TEST\_PROJECT\_ID

```ts
const TEST_PROJECT_ID: "eigen-test" = "eigen-test";
```

Defined in: [server/packages/server/src/testing.ts:40](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L40)

***

### testFirebaseAdmin

```ts
const testFirebaseAdmin: FirebaseAdminEffects;
```

Defined in: [server/packages/server/src/testing.ts:64](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L64)

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

Defined in: [server/packages/server/src/testing.ts:163](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L163)

Deterministic provider for commerce lifecycle and implementor conformance tests.

#### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `products` | readonly ([`CommerceProduct`](server.md#commerceproduct) & \{ `kind?`: `"oneTime"` \| `"subscription"`; \})[] | `undefined` | - |
| `now?` | () => `number` | `Date.now` | - |
| `key?` | `string` | `"fake"` | The provider key. Give a sweep test its own, so the reconciliation queue it reasons about holds only the rows that test seeded. |

#### Returns

[`FakeCommerceProvider`](#fakecommerceprovider)

***

### mintTestToken()

```ts
function mintTestToken(opts): Promise<string>;
```

Defined in: [server/packages/server/src/testing.ts:84](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L84)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `opts` | [`TestTokenOptions`](#testtokenoptions) |

#### Returns

`Promise`\<`string`\>

***

### testAccount()

```ts
function testAccount(
   d1,
   userId,
   now?
): Promise<string>;
```

Defined in: [server/packages/server/src/testing.ts:304](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L304)

Provision the account a commerce test is about.

The ledger refuses to write for an account that does not exist, because a
provider notification names an account from its own metadata and that
metadata outlives an erasure. Anything reaching the ledger through the API
has already been provisioned by the auth middleware; a test calling the
ledger directly has to say so itself.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `d1` | `D1Database` |
| `userId` | `string` |
| `now?` | `number` |

#### Returns

`Promise`\<`string`\>

***

### testBearer()

```ts
function testBearer(opts): Promise<Record<string, string>>;
```

Defined in: [server/packages/server/src/testing.ts:103](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L103)

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

Defined in: [server/packages/server/src/testing.ts:110](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L110)

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

Defined in: [server/packages/server/src/testing.ts:70](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L70)

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

Defined in: [server/packages/server/src/testing.ts:321](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L321)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `method` | `string` |
| `path` | `string` |
| `body` | `unknown` |

#### Returns

`unknown`
