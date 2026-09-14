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
function fakeCommerceProvider(products, now?): CommerceProvider<unknown>;
```

Defined in: [server/packages/server/src/testing.ts:126](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L126)

Deterministic provider for commerce lifecycle and implementor conformance tests.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `products` | readonly [`CommerceProduct`](server.md#commerceproduct) & \{ `kind?`: `"oneTime"` \| `"subscription"`; \}[] | `undefined` |
| `now` | () => `number` | `Date.now` |

#### Returns

[`CommerceProvider`](server.md#commerceprovider)\<`unknown`\>

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

Defined in: [server/packages/server/src/testing.ts:199](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/testing.ts#L199)

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
