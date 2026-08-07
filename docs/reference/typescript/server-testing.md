# @eigeninteractive/server/testing

`@eigeninteractive/server/testing` — the test-auth recipe, for the engine's own
suite and for implementor test workers alike:

```ts
// test/worker.ts — your production entry with explicit Firebase fakes:
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
export — the supported replacement for the deprecated `SELF` fetcher. It
needs `Cloudflare.GlobalProps` to declare `mainModule`; see the engine's
own `test/env.d.ts` for the hand-rolled version, or use `wrangler types`.)

Tokens are verified through the SAME jose code path production uses — only
the JWKS is local. The RS256 keypair below is a public fixture (checked in,
shipped in the package); it protects nothing and must never reach a
production config: pass `testing` ONLY in test workers.

## Interfaces

### TestTokenOptions

Defined in: [eigen-server/packages/server/src/testing.ts:70](https://github.com/eigeninteractive/eigen-server/blob/2b9f229639dce5bf02767453b8850e28bb8a3e8c/packages/server/src/testing.ts#L70)

#### Properties

##### anonymous?

```ts
optional anonymous?: boolean;
```

Defined in: [eigen-server/packages/server/src/testing.ts:72](https://github.com/eigeninteractive/eigen-server/blob/2b9f229639dce5bf02767453b8850e28bb8a3e8c/packages/server/src/testing.ts#L72)

##### claims?

```ts
optional claims?: Record<string, unknown>;
```

Defined in: [eigen-server/packages/server/src/testing.ts:77](https://github.com/eigeninteractive/eigen-server/blob/2b9f229639dce5bf02767453b8850e28bb8a3e8c/packages/server/src/testing.ts#L77)

Override any registered claim (e.g. an expired `exp`, a wrong `aud`).

##### email?

```ts
optional email?: string;
```

Defined in: [eigen-server/packages/server/src/testing.ts:73](https://github.com/eigeninteractive/eigen-server/blob/2b9f229639dce5bf02767453b8850e28bb8a3e8c/packages/server/src/testing.ts#L73)

##### name?

```ts
optional name?: string;
```

Defined in: [eigen-server/packages/server/src/testing.ts:74](https://github.com/eigeninteractive/eigen-server/blob/2b9f229639dce5bf02767453b8850e28bb8a3e8c/packages/server/src/testing.ts#L74)

##### picture?

```ts
optional picture?: string;
```

Defined in: [eigen-server/packages/server/src/testing.ts:75](https://github.com/eigeninteractive/eigen-server/blob/2b9f229639dce5bf02767453b8850e28bb8a3e8c/packages/server/src/testing.ts#L75)

##### uid

```ts
uid: string;
```

Defined in: [eigen-server/packages/server/src/testing.ts:71](https://github.com/eigeninteractive/eigen-server/blob/2b9f229639dce5bf02767453b8850e28bb8a3e8c/packages/server/src/testing.ts#L71)

## Variables

### TEST\_PROJECT\_ID

```ts
const TEST_PROJECT_ID: "eigen-test" = "eigen-test";
```

Defined in: [eigen-server/packages/server/src/testing.ts:36](https://github.com/eigeninteractive/eigen-server/blob/2b9f229639dce5bf02767453b8850e28bb8a3e8c/packages/server/src/testing.ts#L36)

***

### testFirebaseAdmin

```ts
const testFirebaseAdmin: FirebaseAdminEffects;
```

Defined in: [eigen-server/packages/server/src/testing.ts:60](https://github.com/eigeninteractive/eigen-server/blob/2b9f229639dce5bf02767453b8850e28bb8a3e8c/packages/server/src/testing.ts#L60)

No-op Firebase Admin effects for test workers and test Durable Objects.

## Functions

### mintTestToken()

```ts
function mintTestToken(opts): Promise<string>;
```

Defined in: [eigen-server/packages/server/src/testing.ts:80](https://github.com/eigeninteractive/eigen-server/blob/2b9f229639dce5bf02767453b8850e28bb8a3e8c/packages/server/src/testing.ts#L80)

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

Defined in: [eigen-server/packages/server/src/testing.ts:99](https://github.com/eigeninteractive/eigen-server/blob/2b9f229639dce5bf02767453b8850e28bb8a3e8c/packages/server/src/testing.ts#L99)

Authorization header for a minted token.

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

Defined in: [eigen-server/packages/server/src/testing.ts:66](https://github.com/eigeninteractive/eigen-server/blob/2b9f229639dce5bf02767453b8850e28bb8a3e8c/packages/server/src/testing.ts#L66)

The verifier a test worker passes under `createEngine({ testing })`.

#### Returns

[`TokenVerifier`](server.md#tokenverifier)
