# @eigeninteractive/server

`@eigeninteractive/server`: everything that deploys, being the
`createEngine` API factory, the GameDO base class, the D1 applier, and
the protocol types.

The D1 and Durable Object table definitions are deliberately NOT exported.
They are engine-owned storage internals that migrate on their own schedule,
and `readGameRow` already returns the whole game row typed. Exporting the
drizzle tables would turn a private layout into a compatibility surface.

## Classes

### AuthError

Defined in: [eigen-server/packages/server/src/auth/firebase.ts:12](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/auth/firebase.ts#L12)

Verification failure, always the caller's fault; the app maps it to 401.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new AuthError(message?): AuthError;
```

Defined in: eigen-web/node\_modules/.pnpm/typescript@6.0.3/node\_modules/typescript/lib/lib.es5.d.ts:1080

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `message?` | `string` |

###### Returns

[`AuthError`](#autherror)

###### Inherited from

```ts
Error.constructor
```

##### Constructor

```ts
new AuthError(message?, options?): AuthError;
```

Defined in: eigen-web/node\_modules/.pnpm/typescript@6.0.3/node\_modules/typescript/lib/lib.es5.d.ts:1080

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `message?` | `string` |
| `options?` | `ErrorOptions` |

###### Returns

[`AuthError`](#autherror)

###### Inherited from

```ts
Error.constructor
```

***

### `abstract` BaseGameDO

Defined in: [eigen-server/packages/server/src/do/game-do.ts:104](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L104)

Durable Object base class that owns one authoritative game session.

A game Worker subclasses this once to supply its [gameModule](#gamemodule) and D1
binding. Do not override command, socket, alarm, or persistence behavior:
the base class owns the serialized game loop and applies engine migrations
on activation.

#### Example

```ts
export class GameDO extends BaseGameDO<Env> {
  protected readonly gameModule = gameModule;
  protected d1(env: Env) {
    return env.GAME_DB;
  }
}
```

#### Extends

- `unknown`\<`TEnv`\>

#### Type Parameters

| Type Parameter |
| ------ |
| `TEnv` |

#### Implements

- `GameStub`

#### Constructors

##### Constructor

```ts
new BaseGameDO<TEnv>(ctx, env): BaseGameDO<TEnv>;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:118](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L118)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `ctx` | `DurableObjectState` |
| `env` | `TEnv` |

###### Returns

[`BaseGameDO`](#abstract-basegamedo)\<`TEnv`\>

###### Overrides

```ts
DurableObject<TEnv>.constructor
```

#### Properties

##### gameModule

```ts
abstract protected readonly gameModule: GameModule;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:106](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L106)

The implementor's game: the `versions` map the engine dispatches on.

#### Methods

##### abort()

```ts
abort(gameId): Promise<void>;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:262](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L262)

Unconditional teardown (cron reap): mark the game aborted in D1 and
drop the DO's storage: no creator gate, no init requirement. A
never-touched lobby's DO has no `meta` row, so the caller passes the
gameId. Idempotent: a re-run re-aborts a game whose storage is already
gone. Used by the cron; `cancel` shares the teardown for its live path.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `gameId` | `string` |

###### Returns

`Promise`\<`void`\>

###### Implementation of

```ts
GameStub.abort
```

##### alarm()

```ts
alarm(): Promise<void>;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:708](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L708)

###### Returns

`Promise`\<`void`\>

##### d1()

```ts
abstract protected d1(env): D1Database;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:109](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L109)

The EngineConfig seam: the engine never assumes binding names, so the
subclass picks the D1 database off its own Env.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

`D1Database`

##### fetch()

```ts
fetch(request): Promise<Response>;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:732](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L732)

The worker routes the upgrade here after authenticating; the principal
header is worker-set (never client-supplied; the worker strips inbound
headers when forwarding). One socket serves the game's whole lifetime:
unversioned roster snapshots pre-game, versioned frames from v0.
A not-yet-seated user's socket simply receives no frames until the
roster contains them.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `request` | `Request` |

###### Returns

`Promise`\<`Response`\>

###### Implementation of

```ts
GameStub.fetch
```

##### firebaseAdmin()

```ts
protected firebaseAdmin(env): FirebaseAdminEffects;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:112](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L112)

Required Firebase Admin effects. Tests override this with the explicit
fake exported by `@eigeninteractive/server/testing`.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

[`FirebaseAdminEffects`](#firebaseadmineffects)

##### frames()

```ts
frames(args): Promise<FrameMessage[]>;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:832](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L832)

Project a version range for one seat (null = public viewer, replay
only). Live rows serve the stored frame; compacted/ratings rows
re-project. Raw state never leaves the DO.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | \{ `from`: `number`; `isReplay?`: `boolean`; `seat`: `number` \| `null`; `to`: `number`; \} |
| `args.from` | `number` |
| `args.isReplay?` | `boolean` |
| `args.seat` | `number` \| `null` |
| `args.to` | `number` |

###### Returns

`Promise`\<[`FrameMessage`](#framemessage)[]\>

###### Implementation of

```ts
GameStub.frames
```

##### handle()

```ts
handle(cmd): Promise<CommandResult>;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:131](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L131)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `cmd` | [`Command`](#command) |

###### Returns

`Promise`\<[`CommandResult`](#commandresult)\>

###### Implementation of

```ts
GameStub.handle
```

##### repokeFinish()

```ts
repokeFinish(): Promise<boolean>;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:696](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L696)

The gated admin re-poke (step 4): re-runs the D1 apply for a
finish whose effects never landed. Idempotent end to end: finish_id
dedupes the apply, and the outbox row exists iff the ratings transition
hasn't been committed. Returns false when there is nothing to do.

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

```ts
GameStub.repokeFinish
```

##### webSocketClose()

```ts
webSocketClose(): Promise<void>;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:766](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L766)

###### Returns

`Promise`\<`void`\>

##### webSocketError()

```ts
webSocketError(_ws, error): Promise<void>;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:772](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L772)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `_ws` | `WebSocket` |
| `error` | `unknown` |

###### Returns

`Promise`\<`void`\>

##### webSocketMessage()

```ts
webSocketMessage(): Promise<void>;
```

Defined in: [eigen-server/packages/server/src/do/game-do.ts:761](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/do/game-do.ts#L761)

###### Returns

`Promise`\<`void`\>

***

### HttpError

Defined in: [eigen-server/packages/server/src/http.ts:38](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/http.ts#L38)

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new HttpError(
   status,
   message,
   code?,
   retryAfterSeconds?): HttpError;
```

Defined in: [eigen-server/packages/server/src/http.ts:46](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/http.ts#L46)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `status` | `400` \| `401` \| `403` \| `404` \| `409` \| `413` \| `415` \| `422` \| `429` \| `500` \| `502` |
| `message` | `string` |
| `code?` | `ErrorCode` |
| `retryAfterSeconds?` | `number` |

###### Returns

[`HttpError`](#httperror)

###### Overrides

```ts
Error.constructor
```

#### Properties

##### code

```ts
readonly code: ErrorCode | undefined;
```

Defined in: [eigen-server/packages/server/src/http.ts:40](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/http.ts#L40)

##### retryAfterSeconds

```ts
readonly retryAfterSeconds: number | undefined;
```

Defined in: [eigen-server/packages/server/src/http.ts:44](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/http.ts#L44)

Seconds the caller should wait before retrying, rendered as the
`Retry-After` header. Set only on a 429 (see `ErrorCode.rateLimited`);
`undefined` everywhere else.

##### status

```ts
readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 502;
```

Defined in: [eigen-server/packages/server/src/http.ts:39](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/http.ts#L39)

## Interfaces

### AuthClaims

Defined in: [eigen-server/packages/server/src/auth/firebase.ts:18](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/auth/firebase.ts#L18)

What a verified ID token asserts. `isAnonymous` (the
`firebase.sign_in_provider === 'anonymous'` claim) drives every guest gate;
the profile claims seed user provisioning (Google supplies name/picture,
Apple usually only email, guests none).

#### Properties

##### email

```ts
email: string | null;
```

Defined in: [eigen-server/packages/server/src/auth/firebase.ts:21](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/auth/firebase.ts#L21)

##### isAnonymous

```ts
isAnonymous: boolean;
```

Defined in: [eigen-server/packages/server/src/auth/firebase.ts:20](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/auth/firebase.ts#L20)

##### name

```ts
name: string | null;
```

Defined in: [eigen-server/packages/server/src/auth/firebase.ts:22](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/auth/firebase.ts#L22)

##### picture

```ts
picture: string | null;
```

Defined in: [eigen-server/packages/server/src/auth/firebase.ts:23](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/auth/firebase.ts#L23)

##### uid

```ts
uid: string;
```

Defined in: [eigen-server/packages/server/src/auth/firebase.ts:19](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/auth/firebase.ts#L19)

***

### CreateGameInput

Defined in: [eigen-server/packages/server/src/d1/apply.ts:292](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L292)

The worker-direct create, engine-owned so implementors never touch
the D1 schema: seats already validated by worker policy.

#### Properties

##### access

```ts
access: GameAccess;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:296](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L296)

##### budgetSeconds

```ts
budgetSeconds: number | null;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:300](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L300)

##### config

```ts
config: JsonObject;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:298](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L298)

##### createdBy

```ts
createdBy: string | null;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:294](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L294)

##### gameId

```ts
gameId: string;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:293](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L293)

##### incrementSeconds

```ts
incrementSeconds: number | null;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:301](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L301)

##### maxPlayers

```ts
maxPlayers: number;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:305](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L305)

##### minPlayers

```ts
minPlayers: number;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:304](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L304)

##### now

```ts
now: number;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:308](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L308)

##### rated

```ts
rated: boolean;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:302](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L302)

##### ratingPool

```ts
ratingPool: string | null;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:303](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L303)

##### schemaVersion

```ts
schemaVersion: number;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:297](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L297)

##### seats

```ts
seats: Seat[];
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:307](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L307)

##### shortCode

```ts
shortCode: string;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:306](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L306)

##### status

```ts
status: "waiting" | "ready";
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:295](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L295)

##### turnSeconds

```ts
turnSeconds: number | null;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:299](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L299)

***

### EngineConfig

Defined in: [eigen-server/packages/server/src/engine.ts:99](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L99)

The EngineConfig seam: the engine never assumes binding names, so the
implementor picks bindings off their own Env. Annotate the accessors' `env`
parameter and both type arguments infer.

#### Type Parameters

| Type Parameter |
| ------ |
| `TEnv` |
| `TDO` *extends* [`BaseGameDO`](#abstract-basegamedo)\<`TEnv`\> |

#### Properties

##### appName

```ts
appName: string;
```

Defined in: [eigen-server/packages/server/src/engine.ts:106](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L106)

The whitelabel app's display name, the single source of truth for the
engine's own identity (share metadata and public-page titles today;
FCM titles and share copy later). Deliberately top-level, not nested under
`deepLink`, so there is one place to set it regardless of which optional
feature blocks are enabled.

##### avatars?

```ts
optional avatars?: AvatarsConfig<TEnv>;
```

Defined in: [eigen-server/packages/server/src/engine.ts:128](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L128)

Opt-in avatar uploads. Omit → not mounted.

##### clientOrigins?

```ts
optional clientOrigins?: readonly string[] | ((env) => readonly string[]);
```

Defined in: [eigen-server/packages/server/src/engine.ts:124](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L124)

Browser origins allowed to call the engine from a different origin.

Same-origin requests always work. When omitted, the engine trusts the
exact origin from the conventional `WEB_APP_ORIGIN` var when it is set.
Supply this option to replace that default for multiple or otherwise
non-standard browser origins. Paths and wildcards are intentionally
unsupported. The list also protects browser WebSocket upgrades, whose
`Origin` header is not governed by CORS.

Set an empty list to disable the `WEB_APP_ORIGIN` default.

##### deepLink?

```ts
optional deepLink?: DeepLinkConfig;
```

Defined in: [eigen-server/packages/server/src/engine.ts:126](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L126)

Native deep-link verification and store links. Omit for web-only.

##### gameModule

```ts
gameModule: GameModule;
```

Defined in: [eigen-server/packages/server/src/engine.ts:100](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L100)

##### lifecycle?

```ts
optional lifecycle?: LifecycleOptions;
```

Defined in: [eigen-server/packages/server/src/engine.ts:135](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L135)

Cron-backstop tuning: guest-purge/reap windows and batch caps.
Omit for the defaults (`LIFECYCLE_DEFAULTS`); set any subset to
override just those.

##### site?

```ts
optional site?: SiteConfig;
```

Defined in: [eigen-server/packages/server/src/engine.ts:131](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L131)

The public web surface: download page, legal documents, crawler files.
Omit → not mounted (the worker is API-only).

##### testing?

```ts
optional testing?: {
  auth: TokenVerifier;
  firebaseAdmin: FirebaseAdminEffects;
};
```

Defined in: [eigen-server/packages/server/src/engine.ts:140](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L140)

Explicit test-only replacements for Firebase verification and Admin
effects. Supplying them together prevents a fake verifier from
accidentally turning missing production credentials into a nullable
runtime path. Leave unset in production.

###### auth

```ts
auth: TokenVerifier;
```

###### firebaseAdmin()

```ts
firebaseAdmin(env): FirebaseAdminEffects;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

[`FirebaseAdminEffects`](#firebaseadmineffects)

#### Methods

##### d1()

```ts
d1(env): D1Database;
```

Defined in: [eigen-server/packages/server/src/engine.ts:108](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L108)

The engine's D1 database (engine-private).

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

`D1Database`

##### firebaseProjectId()?

```ts
optional firebaseProjectId(env): string;
```

Defined in: [eigen-server/packages/server/src/engine.ts:113](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L113)

Firebase project id for token verification; defaults to the
`FIREBASE_PROJECT_ID` var (the only secret verification needs).

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

`string`

##### gameDO()

```ts
gameDO(env): DurableObjectNamespace<TDO>;
```

Defined in: [eigen-server/packages/server/src/engine.ts:110](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L110)

The GameDO namespace binding.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

`DurableObjectNamespace`\<`TDO`\>

***

### FinishApplyInput

Defined in: [eigen-server/packages/server/src/d1/apply.ts:30](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L30)

#### Properties

##### finishId

```ts
finishId: string;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:34](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L34)

The DO-minted idempotency key. The apply is a no-op replay when
the games row already carries it.

##### gameId

```ts
gameId: string;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:31](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L31)

##### now

```ts
now: number;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:39](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L39)

##### outcomes

```ts
outcomes: OutcomeEntry[];
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:35](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L35)

##### rated

```ts
rated: boolean;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:37](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L37)

##### ratingPool

```ts
ratingPool: string | null;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:38](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L38)

##### roster

```ts
roster: Seat[];
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:36](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L36)

***

### FirebaseAdminEffects

Defined in: [eigen-server/packages/server/src/firebase/admin-effects.ts:15](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/firebase/admin-effects.ts#L15)

The Firebase Admin effects used by authenticated engine paths.

#### Methods

##### deleteAccount()

```ts
deleteAccount(userId): Promise<void>;
```

Defined in: [eigen-server/packages/server/src/firebase/admin-effects.ts:19](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/firebase/admin-effects.ts#L19)

Permanently delete one Firebase Authentication account.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `userId` | `string` |

###### Returns

`Promise`\<`void`\>

##### notifyUser()

```ts
notifyUser(
   d1,
   userId,
message): Promise<void>;
```

Defined in: [eigen-server/packages/server/src/firebase/admin-effects.ts:17](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/firebase/admin-effects.ts#L17)

Send one notification through the engine's registered-device store.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `d1` | `D1Database` |
| `userId` | `string` |
| `message` | `NotificationMessage` |

###### Returns

`Promise`\<`void`\>

***

### FrameMessage

Defined in: [eigen-server/packages/server/src/protocol.ts:91](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L91)

One seat's versioned frame on the wire: the socket fan-out payload, and
(for the acting seat) the command-response ride-along. `ratings` appears
only on the post-finish ratings transition.

#### Properties

##### data

```ts
data: JsonObject;
```

Defined in: [eigen-server/packages/server/src/protocol.ts:94](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L94)

##### deadline

```ts
deadline: number | null;
```

Defined in: [eigen-server/packages/server/src/protocol.ts:97](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L97)

The true client-facing deadline (grace is display-only there).

##### outcomes?

```ts
optional outcomes?: OutcomeEntry[];
```

Defined in: [eigen-server/packages/server/src/protocol.ts:99](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L99)

##### pendingPlayers

```ts
pendingPlayers: number[];
```

Defined in: [eigen-server/packages/server/src/protocol.ts:95](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L95)

##### playerTimes

```ts
playerTimes: number[] | null;
```

Defined in: [eigen-server/packages/server/src/protocol.ts:98](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L98)

##### ratings?

```ts
optional ratings?: RatingDelta[];
```

Defined in: [eigen-server/packages/server/src/protocol.ts:100](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L100)

##### type

```ts
type: "frame";
```

Defined in: [eigen-server/packages/server/src/protocol.ts:92](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L92)

##### version

```ts
version: number;
```

Defined in: [eigen-server/packages/server/src/protocol.ts:93](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L93)

***

### LegalConfig

Defined in: [eigen-server/packages/server/src/site/config.ts:29](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L29)

Legal document overrides. Each is an HTML **fragment**: body content only,
no document wrapper; the engine supplies the shell, styling and footer.
Omitted documents fall back to the engine's generic templates.

A fragment is inserted as-is, so it is the implementor's own trusted markup
with their own values already written in. There are no placeholders to fill:
the engine's defaults take an [OperatorConfig](#operatorconfig) as typed props, which is
what a template's tokens used to stand in for.

#### Properties

##### deleteAccount?

```ts
optional deleteAccount?: string;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:32](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L32)

##### privacy?

```ts
optional privacy?: string;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:31](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L31)

##### terms?

```ts
optional terms?: string;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:30](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L30)

***

### OperatorConfig

Defined in: [eigen-server/packages/server/src/site/config.ts:9](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L9)

The legal entity publishing the game. Required whenever `site` is present:
the default legal documents take it as a prop and cannot render without it.

#### Properties

##### contactEmail

```ts
contactEmail: string;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:15](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L15)

Support and privacy contact address.

##### effectiveDate

```ts
effectiveDate: string;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:18](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L18)

Effective date of the legal documents, as displayed. A plain string, not a
Date, since it is prose and its format is the operator's choice.

##### jurisdiction

```ts
jurisdiction: string;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:13](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L13)

Governing jurisdiction, e.g. `India`.

##### name

```ts
name: string;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:11](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L11)

Legal entity name. Also the page footers' copyright holder.

***

### Principal

Defined in: [eigen-server/packages/server/src/protocol.ts:16](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L16)

Who a command acts as, resolved at the edge. Exactly one id is set.

#### Properties

##### botId

```ts
botId: string | null;
```

Defined in: [eigen-server/packages/server/src/protocol.ts:18](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L18)

##### userId

```ts
userId: string | null;
```

Defined in: [eigen-server/packages/server/src/protocol.ts:17](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L17)

***

### RatingDelta

Defined in: eigen-server/packages/kernel/dist/index.d.ts:171

One rated identity's before → after, exactly the rating_history row minus
store keys. Computed by the D1 applier inside the rating CAS and delivered
on the post-finish ratings transition (the `kind: "ratings"` action).

#### Properties

##### displayAfter

```ts
displayAfter: number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:179

##### displayBefore

```ts
displayBefore: number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:176

##### displayChange

```ts
displayChange: number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:180

##### identity

```ts
identity: RatingIdentity;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:172

##### muAfter

```ts
muAfter: number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:177

##### muBefore

```ts
muBefore: number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:174

##### pool

```ts
pool: string;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:173

##### sigmaAfter

```ts
sigmaAfter: number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:178

##### sigmaBefore

```ts
sigmaBefore: number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:175

***

### RetryOptions

Defined in: [eigen-server/packages/server/src/d1/retry.ts:59](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/retry.ts#L59)

#### Properties

##### attempts?

```ts
optional attempts?: number;
```

Defined in: [eigen-server/packages/server/src/d1/retry.ts:61](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/retry.ts#L61)

Total attempts including the first. Default 4.

##### baseDelayMs?

```ts
optional baseDelayMs?: number;
```

Defined in: [eigen-server/packages/server/src/d1/retry.ts:63](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/retry.ts#L63)

First backoff, doubling each retry. Default 50ms.

##### maxDelayMs?

```ts
optional maxDelayMs?: number;
```

Defined in: [eigen-server/packages/server/src/d1/retry.ts:65](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/retry.ts#L65)

Backoff ceiling. Default 2000ms.

##### onRetry?

```ts
optional onRetry?: (error, attempt) => void;
```

Defined in: [eigen-server/packages/server/src/d1/retry.ts:69](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/retry.ts#L69)

Observe each retry (logging); never throws into the loop.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `error` | `unknown` |
| `attempt` | `number` |

###### Returns

`void`

##### shouldRetry?

```ts
optional shouldRetry?: (error) => boolean;
```

Defined in: [eigen-server/packages/server/src/d1/retry.ts:67](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/retry.ts#L67)

Which failures are worth retrying. Default [isTransientD1Error](#istransientd1error).

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `error` | `unknown` |

###### Returns

`boolean`

##### sleep?

```ts
optional sleep?: (ms) => Promise<void>;
```

Defined in: [eigen-server/packages/server/src/d1/retry.ts:71](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/retry.ts#L71)

Delay primitive, injectable so tests run without real timers.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `ms` | `number` |

###### Returns

`Promise`\<`void`\>

***

### RosterSnapshot

Defined in: [eigen-server/packages/server/src/protocol.ts:82](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L82)

The unversioned pre-game snapshot: pushed to every socket on any
roster change, idempotent, so a reconnect just gets the current one. Also the
response body of an accepted waiting-room command.

#### Properties

##### players

```ts
players: Seat[];
```

Defined in: [eigen-server/packages/server/src/protocol.ts:85](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L85)

##### status

```ts
status: GameStatus;
```

Defined in: [eigen-server/packages/server/src/protocol.ts:84](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L84)

##### type

```ts
type: "roster";
```

Defined in: [eigen-server/packages/server/src/protocol.ts:83](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L83)

***

### SiteConfig

Defined in: [eigen-server/packages/server/src/site/config.ts:53](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L53)

The public web surface a deployed game serves on its own host: download page,
legal documents, and the crawler files. Absent → none of it is mounted and
the worker stays API-only.

The scaffold reserves these paths for the Worker with Static Assets'
`run_worker_first`; customize legal prose through this typed config.

#### Properties

##### description?

```ts
optional description?: string;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:59](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L59)

Longer download-page prose. Defaults to `tagline`.

##### legal?

```ts
optional legal?: LegalConfig;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:73](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L73)

##### madeByCredit?

```ts
optional madeByCredit?: string | null;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:71](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L71)

Footer credit line. Defaults to [DEFAULT\_CREDIT](#default_credit); `null` removes it.

##### name?

```ts
optional name?: string;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:55](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L55)

Public game name in titles and OG tags. Defaults to `appName`.

##### ogImage?

```ts
optional ogImage?: string;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:69](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L69)

Path under `public/` to the 1200x630 OG image. Defaults to
`/og-image.png`, the name the
[branding guide](https://eigeninteractive.com/docs/ship-it/branding)
prescribes for the Flutter app's own share card: one image, both
surfaces. The engine never generates images.

##### operator

```ts
operator: OperatorConfig;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:72](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L72)

##### primaryColor

```ts
primaryColor: string;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:61](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L61)

Hex accent colour, e.g. `#1a237e`. Also the `theme-color`.

##### screenshots?

```ts
optional screenshots?: string[];
```

Defined in: [eigen-server/packages/server/src/site/config.ts:63](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L63)

Filenames under `public/screenshots/`, shown as a scrolling strip.

##### tagline

```ts
tagline: string;
```

Defined in: [eigen-server/packages/server/src/site/config.ts:57](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L57)

One-sentence hook. The meta description and OG description.

***

### TokenVerifier

Defined in: [eigen-server/packages/server/src/auth/firebase.ts:29](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/auth/firebase.ts#L29)

The seam `createEngine` consumes. Production is
[createFirebaseVerifier](#createfirebaseverifier) with the default remote JWKS; tests inject a
local JWKS and mint their own RS256 tokens.

#### Methods

##### verify()

```ts
verify(token): Promise<AuthClaims>;
```

Defined in: [eigen-server/packages/server/src/auth/firebase.ts:31](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/auth/firebase.ts#L31)

Resolve a bearer token to claims, or throw [AuthError](#autherror).

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `token` | `string` |

###### Returns

`Promise`\<[`AuthClaims`](#authclaims)\>

## Type Aliases

### Command

```ts
type Command =
  | {
  actor: Principal;
  commandId: string;
  gameId: string;
  kind: "join" | "leave";
}
  | {
  actor: Principal;
  commandId: string;
  gameId: string;
  kind: "cancel";
}
  | {
  actor: Principal;
  commandId: string;
  gameId: string;
  kind: "start";
}
  | {
  actor: Principal;
  botId: string;
  commandId: string;
  gameId: string;
  kind: "add-bot";
}
  | {
  actor: Principal;
  commandId: string;
  data: unknown;
  expectedVersion: number;
  gameId: string;
  kind: "action";
  seat: number;
}
  | {
  actor: Principal | null;
  commandId: string;
  gameId: string;
  kind: "lifecycle";
  seat?: number;
  type: LifecycleType;
};
```

Defined in: [eigen-server/packages/server/src/protocol.ts:23](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L23)

Everything that crosses the worker → DO boundary after creation (
create itself is a worker-direct D1 write; the DO does not exist yet).

#### Union Members

##### Type Literal

```ts
{
  actor: Principal;
  commandId: string;
  gameId: string;
  kind: "join" | "leave";
}
```

***

##### Type Literal

```ts
{
  actor: Principal;
  commandId: string;
  gameId: string;
  kind: "cancel";
}
```

***

##### Type Literal

```ts
{
  actor: Principal;
  commandId: string;
  gameId: string;
  kind: "start";
}
```

***

##### Type Literal

```ts
{
  actor: Principal;
  botId: string;
  commandId: string;
  gameId: string;
  kind: "add-bot";
}
```

***

##### Type Literal

```ts
{
  actor: Principal;
  commandId: string;
  data: unknown;
  expectedVersion: number;
  gameId: string;
  kind: "action";
  seat: number;
}
```

###### actor

```ts
actor: Principal;
```

###### commandId

```ts
commandId: string;
```

###### data

```ts
data: unknown;
```

###### expectedVersion

```ts
expectedVersion: number;
```

The version the client computed the move against; a lower value is
arbitrated by the same-view rule.

###### gameId

```ts
gameId: string;
```

###### kind

```ts
kind: "action";
```

###### seat

```ts
seat: number;
```

The acting seat, carried uniformly by humans and bots. The
DO verifies it belongs to the actor (user id from the token, bot id
from the HMAC claim) against its own roster and rejects otherwise, so
a client can never act on a seat it does not hold. Required because
one bot id may hold several seats, and uniform for one code path.

***

##### Type Literal

```ts
{
  actor: Principal | null;
  commandId: string;
  gameId: string;
  kind: "lifecycle";
  seat?: number;
  type: LifecycleType;
}
```

###### actor

```ts
actor: Principal | null;
```

Null for identity-less system lifecycles (timeout, autoForfeit).

###### commandId

```ts
commandId: string;
```

###### gameId

```ts
gameId: string;
```

###### kind

```ts
kind: "lifecycle";
```

###### seat?

```ts
optional seat?: number;
```

The affected seat: `forfeit` carries the resigning seat (verified
against the actor, like an action); `autoForfeit` the purged seat;
`timeout` carries none (it resolves all pending).

###### type

```ts
type: LifecycleType;
```

***

### CommandResult

```ts
type CommandResult =
  | {
  frame: FrameMessage | null;
  ok: true;
  version: number;
}
  | {
  ok: true;
  roster: RosterSnapshot;
}
  | {
  code:   | RejectCode
     | LobbyRejectCode;
  message: string;
  ok: false;
};
```

Defined in: [eigen-server/packages/server/src/protocol.ts:124](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L124)

What `GameDO.handle()` returns; accepted results are stored for commandId
dedupe and replayed verbatim to a retry. Rejections are computed
fresh each time, since re-evaluating one is always sound. State-transitioning
commands answer with a version (+ the acting seat's frame); waiting-room
commands answer with the post-commit roster snapshot.

***

### LobbyRejectCode

```ts
type LobbyRejectCode =
  | "unknownGame"
  | "notJoinable"
  | "gameFull"
  | "alreadyJoined"
  | "notParticipant"
  | "notCreator"
  | "creatorCannotLeave";
```

Defined in: [eigen-server/packages/server/src/protocol.ts:62](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/protocol.ts#L62)

Why the DO refused a waiting-room command: the integrity column.
These are *expected* refusals (accepted lobby staleness: the lobby may show
a game that just filled), returned as values exactly like kernel
rejections; the worker maps them to HTTP. Genuine protocol violations
(acting on a seat you don't own) still throw.

***

### UserRow

```ts
type UserRow = typeof users.$inferSelect;
```

Defined in: [eigen-server/packages/server/src/auth/provision.ts:19](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/auth/provision.ts#L19)

## Variables

### DEADLINE\_GRACE\_MS

```ts
const DEADLINE_GRACE_MS: 750 = 750;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:443

Grace window (ms) added to every deadline comparison so a player who
submits on time is not rejected because network latency carried the request
past the deadline. Keep it small relative to per-action `turnSeconds`
windows. The client's display-only `kServerDeadlineGrace` mirrors this.

***

### DEFAULT\_CREDIT

```ts
const DEFAULT_CREDIT: "Built with EigenInteractive" = "Built with EigenInteractive";
```

Defined in: [eigen-server/packages/server/src/site/config.ts:41](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/site/config.ts#L41)

The credit line in every page footer. Set `site.madeByCredit` to your own
string, or to `null` to drop it.

The footer links whichever part of the line reads CREDIT\_BRAND, so a
custom credit that names the engine gets the link too, and one that does not
renders as plain text rather than pointing somewhere it never mentioned.

## Functions

### applyFinish()

```ts
function applyFinish(d1, input): Promise<RatingDelta[] | null>;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:48](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L48)

Apply one finished game to D1. Returns the rated deltas (null for an
unrated game) for the DO to deliver as the ratings transition. Throws on
failure, so the caller logs and keeps the outbox row (single attempt at
the call site; the internal loop only absorbs CAS conflicts).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `d1` | `D1Database` |
| `input` | [`FinishApplyInput`](#finishapplyinput) |

#### Returns

`Promise`\<[`RatingDelta`](#ratingdelta)[] \| `null`\>

***

### createEngine()

```ts
function createEngine<TEnv, TDO>(cfg): ExportedHandler<TEnv>;
```

Defined in: [eigen-server/packages/server/src/engine.ts:418](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L418)

Creates the complete Cloudflare Worker for one game deployment.

Call this once from the default export of `src/index.ts`. The returned
handler mounts the authenticated game API, WebSocket upgrades, scheduled
lifecycle work, and any configured public/deep-link routes. Game
implementors provide only [EngineConfig.gameModule](#gamemodule-1) and binding
accessors; routes, persistence, migrations, authentication, and session
dispatch stay engine-owned.

#### Type Parameters

| Type Parameter |
| ------ |
| `TEnv` *extends* `object` |
| `TDO` *extends* [`BaseGameDO`](#abstract-basegamedo)\<`TEnv`\> |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `cfg` | [`EngineConfig`](#engineconfig)\<`TEnv`, `TDO`\> |

#### Returns

`ExportedHandler`\<`TEnv`\>

#### Example

```ts
export default createEngine({
  gameModule,
  appName: "My Game",
  d1: (env: Env) => env.GAME_DB,
  gameDO: (env: Env) => env.GAME_DO,
});
```

***

### createFirebaseVerifier()

```ts
function createFirebaseVerifier(projectId, getKey?): TokenVerifier;
```

Defined in: [eigen-server/packages/server/src/auth/firebase.ts:46](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/auth/firebase.ts#L46)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `projectId` | `string` |
| `getKey?` | `JWTVerifyGetKey` |

#### Returns

[`TokenVerifier`](#tokenverifier)

***

### createGame()

```ts
function createGame(d1, input): Promise<void>;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:314](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L314)

Write the games row + one participants row per seat, atomically. The DO
lazy-inits from exactly these rows on first contact. Callers own the
shortCode retry: a duplicate trips the UNIQUE index and throws.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `d1` | `D1Database` |
| `input` | [`CreateGameInput`](#creategameinput) |

#### Returns

`Promise`\<`void`\>

***

### deriveBotKey()

```ts
function deriveBotKey(masterSecret, botId): Promise<string>;
```

Defined in: [eigen-server/packages/server/src/bot/bot-auth.ts:60](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/bot/bot-auth.ts#L60)

The per-bot signing key as base64, **the operator utility**. This is the
one value an external bot's owner is given, and the only one they need: it
is what they HMAC their request bodies with. The master
`BOT_SIGNING_SECRET` never leaves the operator, and because every bot's key
is derived from it, registering a bot needs no new secret and no redeploy.

Base64 to match the signature transport encoding. Equivalent to:

```
echo -n "<botId>" | openssl dgst -sha256 -hmac "<BOT_SIGNING_SECRET>" -binary | base64
```

Treat the result as a credential: it authenticates that bot to the engine
for as long as it is registered. Rotating one bot's key means rotating the
master secret, which rotates every bot's key, so issue per-bot keys only to
owners you would re-issue all of them for.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `masterSecret` | `string` |
| `botId` | `string` |

#### Returns

`Promise`\<`string`\>

***

### displayRating()

```ts
function displayRating(mu, sigma): number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:184

max(0, round((mu − 3σ) · 40)): the one server-side home of the display
formula (the client mirrors it for optimistic display only).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `mu` | `number` |
| `sigma` | `number` |

#### Returns

`number`

***

### ensureUser()

```ts
function ensureUser(
   d1,
   claims,
   now): Promise<{
  avatarUrl: string | null;
  createdAt: number;
  displayName: string;
  email: string | null;
  id: string;
  isAnonymous: boolean;
  updatedAt: number;
  username: string;
}>;
```

Defined in: [eigen-server/packages/server/src/auth/provision.ts:51](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/auth/provision.ts#L51)

Load the caller's row, creating or backfilling it as the token demands.
One read on the hot path; writes only on first sight and on guest →
permanent conversion.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `d1` | `D1Database` |
| `claims` | [`AuthClaims`](#authclaims) |
| `now` | `number` |

#### Returns

`Promise`\<\{
  `avatarUrl`: `string` \| `null`;
  `createdAt`: `number`;
  `displayName`: `string`;
  `email`: `string` \| `null`;
  `id`: `string`;
  `isAnonymous`: `boolean`;
  `updatedAt`: `number`;
  `username`: `string`;
\}\>

***

### isTransientD1Error()

```ts
function isTransientD1Error(error): boolean;
```

Defined in: [eigen-server/packages/server/src/d1/retry.ts:55](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/retry.ts#L55)

True for the D1 failures worth retrying: a network blip, a storage or
Durable-Object reset, a code-update restart, or a transient routing failure.

Deliberately narrow. Overload and resource-limit errors are excluded (the
remedy is to shed load, not retry), as are deterministic failures such as a
constraint or type error, where retrying only delays the report. The whole
`cause` chain is examined, because drizzle rewraps failures in its own
message that does not carry the underlying text.

This is the default predicate for [withRetry](#withretry); pass
`shouldRetry` to override it.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `error` | `unknown` |

#### Returns

`boolean`

***

### mirrorRoster()

```ts
function mirrorRoster(d1, args): Promise<void>;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:280](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L280)

The roster mirror after a committed waiting-room command. The DO's
roster is the integrity copy; this rewrites the D1 display copy wholesale
(delete + reinsert), which is idempotent and immune to per-row drift.
Fire-and-forget post-commit (the DO leaves it unawaited; no `waitUntil`),
single attempt.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `d1` | `D1Database` |
| `args` | \{ `gameId`: `string`; `now`: `number`; `seats`: [`Seat`](testkit.md#seat)[]; `status`: `GameStatus`; \} |
| `args.gameId` | `string` |
| `args.now` | `number` |
| `args.seats` | [`Seat`](testkit.md#seat)[] |
| `args.status` | `GameStatus` |

#### Returns

`Promise`\<`void`\>

***

### openApiDocument()

```ts
function openApiDocument(version): OpenAPIObject;
```

Defined in: [eigen-server/packages/server/src/engine.ts:494](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/engine.ts#L494)

Build the API document from an inert app: route handlers never run, so
the context can refuse everything. `appName` is an unused placeholder here:
with `deepLink: null` the landing route (its only reader) is never mounted.

`version` is an argument rather than a constant in here because it has
exactly one correct value, `@eigeninteractive/server`'s own, and changesets
owns that value. Baked in as a literal it silently disagrees with the package
on the first release: nothing reads it back, and the CI drift check only
compares this file against itself, so the lie survives every check. The Dart
client's pubspec is stamped from the same source for the same reason.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `version` | `string` |

#### Returns

`OpenAPIObject`

***

### readGameRow()

```ts
function readGameRow(d1, gameId): Promise<
  | {
  access: GameAccess;
  archivedAt: number | null;
  budgetSeconds: number | null;
  config: JsonObject;
  createdAt: number;
  createdBy: string | null;
  finishedAt: number | null;
  finishId: string | null;
  id: string;
  incrementSeconds: number | null;
  maxPlayers: number;
  minPlayers: number;
  outcomes: OutcomeEntry[] | null;
  participants: Seat[];
  pendingPlayers: number[] | null;
  rated: boolean;
  ratingPool: string | null;
  schemaVersion: number;
  shortCode: string;
  status: GameStatus;
  turnDeadline: number | null;
  turnSeconds: number | null;
  updatedAt: number;
}
| undefined>;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:341](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L341)

Lazy-init read: the D1 game + participants rows the DO copies into
its `meta`/`roster` on first contact, in one batched round trip.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `d1` | `D1Database` |
| `gameId` | `string` |

#### Returns

`Promise`\<
  \| \{
  `access`: `GameAccess`;
  `archivedAt`: `number` \| `null`;
  `budgetSeconds`: `number` \| `null`;
  `config`: `JsonObject`;
  `createdAt`: `number`;
  `createdBy`: `string` \| `null`;
  `finishedAt`: `number` \| `null`;
  `finishId`: `string` \| `null`;
  `id`: `string`;
  `incrementSeconds`: `number` \| `null`;
  `maxPlayers`: `number`;
  `minPlayers`: `number`;
  `outcomes`: `OutcomeEntry`[] \| `null`;
  `participants`: [`Seat`](testkit.md#seat)[];
  `pendingPlayers`: `number`[] \| `null`;
  `rated`: `boolean`;
  `ratingPool`: `string` \| `null`;
  `schemaVersion`: `number`;
  `shortCode`: `string`;
  `status`: `GameStatus`;
  `turnDeadline`: `number` \| `null`;
  `turnSeconds`: `number` \| `null`;
  `updatedAt`: `number`;
\}
  \| `undefined`\>

***

### updateSummary()

```ts
function updateSummary(d1, args): Promise<void>;
```

Defined in: [eigen-server/packages/server/src/d1/apply.ts:262](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/apply.ts#L262)

The display upsert after a non-finishing transition: fire-and-forget
post-commit (the DO leaves it unawaited; no `waitUntil`), single attempt,
re-derivable from the DO at any time.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `d1` | `D1Database` |
| `args` | \{ `gameId`: `string`; `now`: `number`; `pendingPlayers`: `number`[]; `status?`: `"active"`; `turnDeadline`: `number` \| `null`; \} |
| `args.gameId` | `string` |
| `args.now` | `number` |
| `args.pendingPlayers` | `number`[] |
| `args.status?` | `"active"` |
| `args.turnDeadline` | `number` \| `null` |

#### Returns

`Promise`\<`void`\>

***

### withRetry()

```ts
function withRetry<T>(op, options?): Promise<T>;
```

Defined in: [eigen-server/packages/server/src/d1/retry.ts:88](https://github.com/eigeninteractive/eigen-server/blob/d152850506ded6d8a33c616163e590072f888af5/packages/server/src/d1/retry.ts#L88)

Run `op`, retrying a *retryable* failure with jittered exponential backoff up
to `attempts`. A non-retryable failure, or the last attempt, throws.

Safe to leave unawaited inside a Durable Object: the DO stays alive while the
returned promise (and its backoff timers) is pending, so the whole sequence
runs to completion without `waitUntil`, exactly like the single-attempt
writes it wraps.

`op` MUST be idempotent: a retry can fire after a write that actually
landed but whose acknowledgement was lost.

#### Type Parameters

| Type Parameter |
| ------ |
| `T` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `op` | () => `Promise`\<`T`\> |
| `options` | [`RetryOptions`](#retryoptions) |

#### Returns

`Promise`\<`T`\>
