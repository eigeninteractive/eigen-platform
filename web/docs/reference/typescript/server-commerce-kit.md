# @eigeninteractive/server/commerce-kit

`@eigeninteractive/server/commerce-kit`: the small, sharp things every
commerce adapter needs and none of them should reimplement.

Adapters run on Workers, so there is no Node `crypto` and no provider SDK
that assumes one. What they do all need is the same three primitives: an
HMAC, a comparison that does not leak where two secrets diverge, and a JSON
call whose failures say which provider failed without quoting the token that
failed with it.

## Classes

### ProviderRequestError

Defined in: [server/packages/server/src/commerce/provider-kit.ts:41](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/provider-kit.ts#L41)

A provider call that failed, named by provider and status, never by token.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new ProviderRequestError(
   provider,
   status,
   detail
): ProviderRequestError;
```

Defined in: [server/packages/server/src/commerce/provider-kit.ts:42](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/provider-kit.ts#L42)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `provider` | `string` |
| `status` | `number` |
| `detail` | `string` |

###### Returns

[`ProviderRequestError`](#providerrequesterror)

###### Overrides

```ts
Error.constructor
```

#### Properties

##### provider

```ts
readonly provider: string;
```

Defined in: [server/packages/server/src/commerce/provider-kit.ts:43](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/provider-kit.ts#L43)

##### status

```ts
readonly status: number;
```

Defined in: [server/packages/server/src/commerce/provider-kit.ts:44](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/provider-kit.ts#L44)

## Functions

### basicAuth()

```ts
function basicAuth(id, secret): string;
```

Defined in: [server/packages/server/src/commerce/provider-kit.ts:68](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/provider-kit.ts#L68)

Basic authorization header value for a key/secret pair.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `string` |
| `secret` | `string` |

#### Returns

`string`

***

### hmacSha256Hex()

```ts
function hmacSha256Hex(secret, message): Promise<string>;
```

Defined in: [server/packages/server/src/commerce/provider-kit.ts:21](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/provider-kit.ts#L21)

HMAC-SHA256 of `message` under `secret`, lowercase hex.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `secret` | `string` |
| `message` | `string` |

#### Returns

`Promise`\<`string`\>

***

### providerJson()

```ts
function providerJson<T>(provider, request): Promise<T>;
```

Defined in: [server/packages/server/src/commerce/provider-kit.ts:58](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/provider-kit.ts#L58)

A JSON call to a provider.

The body of a failed response is truncated into the error: providers put the
useful part first, and an untruncated one is how a token ends up in a log.

#### Type Parameters

| Type Parameter |
| ------ |
| `T` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `provider` | `string` |
| `request` | `Request` |

#### Returns

`Promise`\<`T`\>

***

### requireSecret()

```ts
function requireSecret(value, name): string;
```

Defined in: [server/packages/server/src/commerce/provider-kit.ts:73](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/provider-kit.ts#L73)

Require a configured secret, naming what is missing rather than failing later.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `value` | `string` \| `undefined` |
| `name` | `string` |

#### Returns

`string`

***

### timingSafeEqualHex()

```ts
function timingSafeEqualHex(a, b): boolean;
```

Defined in: [server/packages/server/src/commerce/provider-kit.ts:33](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/commerce/provider-kit.ts#L33)

Compare two hex digests without revealing how far they agreed.

Length is compared first and separately: two digests of different lengths
cannot match anyway, and hashing both sides to a fixed width first means the
loop below runs over equal-length inputs every time.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `a` | `string` |
| `b` | `string` |

#### Returns

`boolean`
