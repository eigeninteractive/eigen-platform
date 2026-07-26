# @eigeninteractive/server/testing

`@eigeninteractive/server/testing` — the test-auth recipe, for the engine's own
suite and for implementor test workers alike:

```ts
// test/worker.ts — your production entry, with the test verifier:
export default createEngine({ ...same config, auth: testVerifier() });
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
production config: pass `auth` ONLY in test workers.

## Interfaces

### TestTokenOptions

Defined in: [eigen-server/packages/server/src/testing.ts:57](https://github.com/eigeninteractive/eigen-server/blob/43a59eff5a9b4627d6d0d9ded56cc916e6998dee/packages/server/src/testing.ts#L57)

#### Properties

##### anonymous?

```ts
optional anonymous?: boolean;
```

Defined in: [eigen-server/packages/server/src/testing.ts:59](https://github.com/eigeninteractive/eigen-server/blob/43a59eff5a9b4627d6d0d9ded56cc916e6998dee/packages/server/src/testing.ts#L59)

##### claims?

```ts
optional claims?: Record<string, unknown>;
```

Defined in: [eigen-server/packages/server/src/testing.ts:64](https://github.com/eigeninteractive/eigen-server/blob/43a59eff5a9b4627d6d0d9ded56cc916e6998dee/packages/server/src/testing.ts#L64)

Override any registered claim (e.g. an expired `exp`, a wrong `aud`).

##### email?

```ts
optional email?: string;
```

Defined in: [eigen-server/packages/server/src/testing.ts:60](https://github.com/eigeninteractive/eigen-server/blob/43a59eff5a9b4627d6d0d9ded56cc916e6998dee/packages/server/src/testing.ts#L60)

##### name?

```ts
optional name?: string;
```

Defined in: [eigen-server/packages/server/src/testing.ts:61](https://github.com/eigeninteractive/eigen-server/blob/43a59eff5a9b4627d6d0d9ded56cc916e6998dee/packages/server/src/testing.ts#L61)

##### picture?

```ts
optional picture?: string;
```

Defined in: [eigen-server/packages/server/src/testing.ts:62](https://github.com/eigeninteractive/eigen-server/blob/43a59eff5a9b4627d6d0d9ded56cc916e6998dee/packages/server/src/testing.ts#L62)

##### uid

```ts
uid: string;
```

Defined in: [eigen-server/packages/server/src/testing.ts:58](https://github.com/eigeninteractive/eigen-server/blob/43a59eff5a9b4627d6d0d9ded56cc916e6998dee/packages/server/src/testing.ts#L58)

## Variables

### TEST\_PROJECT\_ID

```ts
const TEST_PROJECT_ID: "eigen-test" = "eigen-test";
```

Defined in: [eigen-server/packages/server/src/testing.ts:29](https://github.com/eigeninteractive/eigen-server/blob/43a59eff5a9b4627d6d0d9ded56cc916e6998dee/packages/server/src/testing.ts#L29)

## Functions

### mintTestToken()

```ts
function mintTestToken(opts): Promise<string>;
```

Defined in: [eigen-server/packages/server/src/testing.ts:67](https://github.com/eigeninteractive/eigen-server/blob/43a59eff5a9b4627d6d0d9ded56cc916e6998dee/packages/server/src/testing.ts#L67)

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

Defined in: [eigen-server/packages/server/src/testing.ts:86](https://github.com/eigeninteractive/eigen-server/blob/43a59eff5a9b4627d6d0d9ded56cc916e6998dee/packages/server/src/testing.ts#L86)

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

Defined in: [eigen-server/packages/server/src/testing.ts:53](https://github.com/eigeninteractive/eigen-server/blob/43a59eff5a9b4627d6d0d9ded56cc916e6998dee/packages/server/src/testing.ts#L53)

The verifier a test worker passes as `createEngine({ auth })`.

#### Returns

[`TokenVerifier`](server.md#tokenverifier)
