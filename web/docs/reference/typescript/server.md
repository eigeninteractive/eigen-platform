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

Defined in: [server/packages/server/src/auth/firebase.ts:12](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/auth/firebase.ts#L12)

Verification failure, always the caller's fault; the app maps it to 401.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new AuthError(message?): AuthError;
```

Defined in: web/node\_modules/.pnpm/typescript@6.0.3/node\_modules/typescript/lib/lib.es5.d.ts:1080

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

Defined in: web/node\_modules/.pnpm/typescript@6.0.3/node\_modules/typescript/lib/lib.es5.d.ts:1080

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

Defined in: [server/packages/server/src/do/game-do.ts:111](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L111)

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

Defined in: [server/packages/server/src/do/game-do.ts:125](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L125)

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

Defined in: [server/packages/server/src/do/game-do.ts:113](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L113)

The implementor's game: the `versions` map the engine dispatches on.

#### Methods

##### abort()

```ts
abort(gameId): Promise<void>;
```

Defined in: [server/packages/server/src/do/game-do.ts:294](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L294)

Unconditional teardown (cron reap): mark the game aborted in D1 and
compact its game data, with no creator gate or init requirement. A
never-touched lobby's DO has no `meta` row, so the caller passes the
gameId. Idempotent; `cancel` shares the teardown for its live path.

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

Defined in: [server/packages/server/src/do/game-do.ts:818](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L818)

A timeout is derived from committed state, not submitted, so it carries no
caller identity and stores no receipt. It is idempotent for a better reason
than a stored result: the kernel abstains once the state it was derived from
has moved on, so a double fire, a retry after an alarm handler throws, and a
race with a latent on-time action all resolve the same way. `handle()`
re-arms the alarm for the next turn on its way out.

###### Returns

`Promise`\<`void`\>

##### d1()

```ts
abstract protected d1(env): D1Database;
```

Defined in: [server/packages/server/src/do/game-do.ts:116](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L116)

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

Defined in: [server/packages/server/src/do/game-do.ts:832](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L832)

The worker routes the upgrade here after authenticating; the principal
header is worker-set (never client-supplied; the worker strips inbound
headers when forwarding). One socket serves the game's whole lifetime and
carries one message kind, the per-seat [SessionSnapshot](#sessionsnapshot). A
not-yet-seated user's socket receives the envelope with no frame until the
roster contains them, which is how it learns the game started at all.

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

Defined in: [server/packages/server/src/do/game-do.ts:119](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L119)

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

Defined in: [server/packages/server/src/do/game-do.ts:1011](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L1011)

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

Defined in: [server/packages/server/src/do/game-do.ts:138](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L138)

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

##### reconcile()

```ts
reconcile(gameId): Promise<ReconcileReport>;
```

Defined in: [server/packages/server/src/do/game-do.ts:781](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L781)

Re-derive D1's read model from this object's committed state, and finish any
post-commit work that never landed.

The repair counterpart to the fire-and-forget mirror. `#mirrorD1` writes the
roster/summary rows off the response path and gives up after its retries,
because a commit whose truth is already durable must not fail on a read
model — which leaves D1 stale with nothing to notice. Likewise a finish whose
D1 apply failed keeps its outbox row precisely so this can retry it. Both are
the same defect from D1's side (a game that stopped being updated), and both
are fixed by the same act: write what the DO knows.

Deliberately does NOT lazy-init. Lazy init reads the games row *from D1*, so
an object with no `meta` has nothing more authoritative than the row it would
be repairing — reconciling it would read the stale copy and write it straight
back, reporting success. No meta row means this object never committed
anything, and the answer is honestly "nothing to reconcile".

The writes here are **awaited**, unlike the post-commit mirror: a repair that
failed silently is worse than no repair, because the operator or sweep that
asked for it would believe the divergence was resolved.

Idempotent, so a sweep may call it on a healthy game: the mirror is rewritten
to the same values, `repokeFinish` reports nothing to do, and the alarm
already matches.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `gameId` | `string` |

###### Returns

`Promise`\<`ReconcileReport`\>

###### Implementation of

```ts
GameStub.reconcile
```

##### session()

```ts
session(gameId, userId): Promise<SessionSnapshot | null>;
```

Defined in: [server/packages/server/src/do/game-do.ts:855](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L855)

The snapshot over RPC, for the HTTP paths that have no socket.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `gameId` | `string` |
| `userId` | `string` \| `null` |

###### Returns

`Promise`\<[`SessionSnapshot`](#sessionsnapshot) \| `null`\>

###### Implementation of

```ts
GameStub.session
```

##### webSocketClose()

```ts
webSocketClose(): Promise<void>;
```

Defined in: [server/packages/server/src/do/game-do.ts:865](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L865)

###### Returns

`Promise`\<`void`\>

##### webSocketError()

```ts
webSocketError(_ws, error): Promise<void>;
```

Defined in: [server/packages/server/src/do/game-do.ts:871](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L871)

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

Defined in: [server/packages/server/src/do/game-do.ts:860](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/do/game-do.ts#L860)

###### Returns

`Promise`\<`void`\>

***

### HttpError

Defined in: [server/packages/server/src/http.ts:46](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/http.ts#L46)

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

Defined in: [server/packages/server/src/http.ts:54](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/http.ts#L54)

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

Defined in: [server/packages/server/src/http.ts:48](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/http.ts#L48)

##### retryAfterSeconds

```ts
readonly retryAfterSeconds: number | undefined;
```

Defined in: [server/packages/server/src/http.ts:52](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/http.ts#L52)

Seconds the caller should wait before retrying, rendered as the
`Retry-After` header. Set only on a 429 (see `ErrorCode.rateLimited`);
`undefined` everywhere else.

##### status

```ts
readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 502;
```

Defined in: [server/packages/server/src/http.ts:47](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/http.ts#L47)

## Interfaces

### AuthClaims

Defined in: [server/packages/server/src/auth/firebase.ts:18](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/auth/firebase.ts#L18)

What a verified ID token asserts. `isAnonymous` (the
`firebase.sign_in_provider === 'anonymous'` claim) drives every guest gate;
the profile claims seed user provisioning (Google supplies name/picture,
Apple usually only email, guests none).

#### Properties

##### email

```ts
email: string | null;
```

Defined in: [server/packages/server/src/auth/firebase.ts:21](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/auth/firebase.ts#L21)

##### isAnonymous

```ts
isAnonymous: boolean;
```

Defined in: [server/packages/server/src/auth/firebase.ts:20](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/auth/firebase.ts#L20)

##### name

```ts
name: string | null;
```

Defined in: [server/packages/server/src/auth/firebase.ts:22](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/auth/firebase.ts#L22)

##### picture

```ts
picture: string | null;
```

Defined in: [server/packages/server/src/auth/firebase.ts:23](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/auth/firebase.ts#L23)

##### uid

```ts
uid: string;
```

Defined in: [server/packages/server/src/auth/firebase.ts:19](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/auth/firebase.ts#L19)

***

### CreateGameInput

Defined in: [server/packages/server/src/d1/apply.ts:299](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L299)

The worker-direct create, engine-owned so implementors never touch
the D1 schema: seats already validated by worker policy.

#### Properties

##### access

```ts
access: GameAccess;
```

Defined in: [server/packages/server/src/d1/apply.ts:304](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L304)

##### budgetSeconds

```ts
budgetSeconds: number | null;
```

Defined in: [server/packages/server/src/d1/apply.ts:308](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L308)

##### config

```ts
config: JsonObject;
```

Defined in: [server/packages/server/src/d1/apply.ts:306](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L306)

##### createdBy

```ts
createdBy: string | null;
```

Defined in: [server/packages/server/src/d1/apply.ts:302](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L302)

##### gameId

```ts
gameId: string;
```

Defined in: [server/packages/server/src/d1/apply.ts:301](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L301)

##### incrementSeconds

```ts
incrementSeconds: number | null;
```

Defined in: [server/packages/server/src/d1/apply.ts:309](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L309)

##### maxPlayers

```ts
maxPlayers: number;
```

Defined in: [server/packages/server/src/d1/apply.ts:313](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L313)

##### minPlayers

```ts
minPlayers: number;
```

Defined in: [server/packages/server/src/d1/apply.ts:312](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L312)

##### now

```ts
now: number;
```

Defined in: [server/packages/server/src/d1/apply.ts:316](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L316)

##### rated

```ts
rated: boolean;
```

Defined in: [server/packages/server/src/d1/apply.ts:310](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L310)

##### ratingPool

```ts
ratingPool: string | null;
```

Defined in: [server/packages/server/src/d1/apply.ts:311](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L311)

##### receipt

```ts
receipt: CreateReceipt;
```

Defined in: [server/packages/server/src/d1/apply.ts:300](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L300)

##### schemaVersion

```ts
schemaVersion: number;
```

Defined in: [server/packages/server/src/d1/apply.ts:305](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L305)

##### seats

```ts
seats: Seat[];
```

Defined in: [server/packages/server/src/d1/apply.ts:315](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L315)

##### shortCode

```ts
shortCode: string;
```

Defined in: [server/packages/server/src/d1/apply.ts:314](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L314)

##### status

```ts
status: "waiting" | "ready";
```

Defined in: [server/packages/server/src/d1/apply.ts:303](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L303)

##### turnSeconds

```ts
turnSeconds: number | null;
```

Defined in: [server/packages/server/src/d1/apply.ts:307](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L307)

***

### EngineConfig

Defined in: [server/packages/server/src/engine.ts:102](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L102)

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

Defined in: [server/packages/server/src/engine.ts:130](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L130)

The whitelabel app's display name, the single source of truth for the
engine's own identity (share metadata and public-page titles today;
FCM titles and share copy later). Deliberately top-level, not nested under
`deepLink`, so there is one place to set it regardless of which optional
feature blocks are enabled.

##### avatars?

```ts
optional avatars?: AvatarsConfig<TEnv>;
```

Defined in: [server/packages/server/src/engine.ts:152](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L152)

Opt-in avatar uploads. Omit → not mounted.

##### clientOrigins?

```ts
optional clientOrigins?: readonly string[] | ((env) => readonly string[]);
```

Defined in: [server/packages/server/src/engine.ts:148](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L148)

Browser origins allowed to call the engine from a different origin.

Same-origin requests always work. When omitted, the engine trusts the
exact origin from the conventional `WEB_APP_ORIGIN` var when it is set.
Supply this option to replace that default for multiple or otherwise
non-standard browser origins. Paths and wildcards are intentionally
unsupported. The list also protects browser WebSocket upgrades, whose
`Origin` header is not governed by CORS.

Set an empty list to disable the `WEB_APP_ORIGIN` default.

##### creatableSchemaVersions?

```ts
optional creatableSchemaVersions?: readonly number[];
```

Defined in: [server/packages/server/src/engine.ts:124](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L124)

The `schemaVersion`s new games may be created at. Defaults to the highest key
of `gameModule.versions` alone.

The default is the whole policy for almost every deployment: ship new rules,
and new games use them. A client that cannot create at that version is out of
date and is told to update — it can still join, play and replay every version
it does ship, because that is governed by `versions`, not by this.

Override it for the two cases the default cannot express:

- **Rollback.** A bad rules release needs creation moved back to the previous
  version WITHOUT unshipping the new one, since games already at it must keep
  loading. Removing it from `versions` would orphan them.
- **Coexisting variants.** A deployment using `versions` for genuinely
  parallel rule sets rather than an upgrade sequence.

Listing several does not make the client negotiate: it always creates at the
newest version it ships, and this decides whether that is allowed.

##### deepLink?

```ts
optional deepLink?: DeepLinkConfig;
```

Defined in: [server/packages/server/src/engine.ts:150](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L150)

Native deep-link verification and store links. Omit for web-only.

##### gameModule

```ts
gameModule: GameModule;
```

Defined in: [server/packages/server/src/engine.ts:103](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L103)

##### lifecycle?

```ts
optional lifecycle?: LifecycleOptions;
```

Defined in: [server/packages/server/src/engine.ts:159](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L159)

Cron-backstop tuning: guest-purge/reap windows and batch caps.
Omit for the defaults (`LIFECYCLE_DEFAULTS`); set any subset to
override just those.

##### site?

```ts
optional site?: SiteConfig;
```

Defined in: [server/packages/server/src/engine.ts:155](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L155)

The public web surface: download page, legal documents, crawler files.
Omit → not mounted (the worker is API-only).

##### testing?

```ts
optional testing?: {
  auth: TokenVerifier;
  firebaseAdmin: FirebaseAdminEffects;
};
```

Defined in: [server/packages/server/src/engine.ts:164](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L164)

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

Defined in: [server/packages/server/src/engine.ts:132](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L132)

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

Defined in: [server/packages/server/src/engine.ts:137](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L137)

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

Defined in: [server/packages/server/src/engine.ts:134](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L134)

The GameDO namespace binding.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `env` | `TEnv` |

###### Returns

`DurableObjectNamespace`\<`TDO`\>

***

### FinishApplyInput

Defined in: [server/packages/server/src/d1/apply.ts:30](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L30)

#### Properties

##### finishId

```ts
finishId: string;
```

Defined in: [server/packages/server/src/d1/apply.ts:34](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L34)

The DO-minted idempotency key. The apply is a no-op replay when
the games row already carries it.

##### gameId

```ts
gameId: string;
```

Defined in: [server/packages/server/src/d1/apply.ts:31](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L31)

##### now

```ts
now: number;
```

Defined in: [server/packages/server/src/d1/apply.ts:39](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L39)

##### outcomes

```ts
outcomes: OutcomeEntry[];
```

Defined in: [server/packages/server/src/d1/apply.ts:35](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L35)

##### rated

```ts
rated: boolean;
```

Defined in: [server/packages/server/src/d1/apply.ts:37](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L37)

##### ratingPool

```ts
ratingPool: string | null;
```

Defined in: [server/packages/server/src/d1/apply.ts:38](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L38)

##### roster

```ts
roster: Seat[];
```

Defined in: [server/packages/server/src/d1/apply.ts:36](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L36)

***

### FirebaseAdminEffects

Defined in: [server/packages/server/src/firebase/admin-effects.ts:15](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/firebase/admin-effects.ts#L15)

The Firebase Admin effects used by authenticated engine paths.

#### Methods

##### deleteAccount()

```ts
deleteAccount(userId): Promise<void>;
```

Defined in: [server/packages/server/src/firebase/admin-effects.ts:19](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/firebase/admin-effects.ts#L19)

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

Defined in: [server/packages/server/src/firebase/admin-effects.ts:17](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/firebase/admin-effects.ts#L17)

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

Defined in: [server/packages/server/src/protocol.ts:141](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L141)

One seat's versioned frame on the wire: the socket fan-out payload, and
(for the acting seat) the command-response ride-along. `ratings` appears
only on the post-finish ratings transition.

#### Properties

##### data

```ts
data: JsonObject;
```

Defined in: [server/packages/server/src/protocol.ts:144](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L144)

##### deadline

```ts
deadline: number | null;
```

Defined in: [server/packages/server/src/protocol.ts:147](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L147)

The true client-facing deadline (grace is display-only there).

##### outcomes?

```ts
optional outcomes?: OutcomeEntry[];
```

Defined in: [server/packages/server/src/protocol.ts:149](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L149)

##### pendingPlayers

```ts
pendingPlayers: number[];
```

Defined in: [server/packages/server/src/protocol.ts:145](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L145)

##### playerTimes

```ts
playerTimes: number[] | null;
```

Defined in: [server/packages/server/src/protocol.ts:148](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L148)

##### ratings?

```ts
optional ratings?: RatingDelta[];
```

Defined in: [server/packages/server/src/protocol.ts:150](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L150)

##### type

```ts
type: "frame";
```

Defined in: [server/packages/server/src/protocol.ts:142](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L142)

##### version

```ts
version: number;
```

Defined in: [server/packages/server/src/protocol.ts:143](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L143)

***

### LegalConfig

Defined in: [server/packages/server/src/site/config.ts:29](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L29)

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

Defined in: [server/packages/server/src/site/config.ts:32](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L32)

##### privacy?

```ts
optional privacy?: string;
```

Defined in: [server/packages/server/src/site/config.ts:31](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L31)

##### terms?

```ts
optional terms?: string;
```

Defined in: [server/packages/server/src/site/config.ts:30](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L30)

***

### OperatorConfig

Defined in: [server/packages/server/src/site/config.ts:9](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L9)

The legal entity publishing the game. Required whenever `site` is present:
the default legal documents take it as a prop and cannot render without it.

#### Properties

##### contactEmail

```ts
contactEmail: string;
```

Defined in: [server/packages/server/src/site/config.ts:15](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L15)

Support and privacy contact address.

##### effectiveDate

```ts
effectiveDate: string;
```

Defined in: [server/packages/server/src/site/config.ts:18](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L18)

Effective date of the legal documents, as displayed. A plain string, not a
Date, since it is prose and its format is the operator's choice.

##### jurisdiction

```ts
jurisdiction: string;
```

Defined in: [server/packages/server/src/site/config.ts:13](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L13)

Governing jurisdiction, e.g. `India`.

##### name

```ts
name: string;
```

Defined in: [server/packages/server/src/site/config.ts:11](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L11)

Legal entity name. Also the page footers' copyright holder.

***

### Principal

Defined in: [server/packages/server/src/protocol.ts:16](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L16)

Who a command acts as, resolved at the edge. Exactly one id is set.

#### Properties

##### botId

```ts
botId: string | null;
```

Defined in: [server/packages/server/src/protocol.ts:18](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L18)

##### userId

```ts
userId: string | null;
```

Defined in: [server/packages/server/src/protocol.ts:17](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L17)

***

### RatingDelta

Defined in: server/packages/kernel/dist/ratings.d.ts:47

One rated identity's before → after, exactly the rating_history row minus
store keys. Computed by the D1 applier inside the rating CAS and delivered
on the post-finish ratings transition (the `kind: "ratings"` action).

#### Properties

##### displayAfter

```ts
displayAfter: number;
```

Defined in: server/packages/kernel/dist/ratings.d.ts:55

##### displayBefore

```ts
displayBefore: number;
```

Defined in: server/packages/kernel/dist/ratings.d.ts:52

##### displayChange

```ts
displayChange: number;
```

Defined in: server/packages/kernel/dist/ratings.d.ts:56

##### identity

```ts
identity: RatingIdentity;
```

Defined in: server/packages/kernel/dist/ratings.d.ts:48

##### muAfter

```ts
muAfter: number;
```

Defined in: server/packages/kernel/dist/ratings.d.ts:53

##### muBefore

```ts
muBefore: number;
```

Defined in: server/packages/kernel/dist/ratings.d.ts:50

##### pool

```ts
pool: string;
```

Defined in: server/packages/kernel/dist/ratings.d.ts:49

##### sigmaAfter

```ts
sigmaAfter: number;
```

Defined in: server/packages/kernel/dist/ratings.d.ts:54

##### sigmaBefore

```ts
sigmaBefore: number;
```

Defined in: server/packages/kernel/dist/ratings.d.ts:51

***

### RetryOptions

Defined in: [server/packages/server/src/retry.ts:17](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/retry.ts#L17)

Bounded retry with jittered exponential backoff.

Deliberately transport-agnostic: the caller supplies the predicate deciding
which failures are worth retrying. Two live users, with very different
predicates and budgets:

- background D1 mirror writes (`isTransientD1Error`, in `d1/errors.ts`);
- Worker-to-Durable-Object calls (`isRetryableDoError`, in `game-stub.ts`).

The shared discipline is the same in both: retry only *transient
infrastructure* failures, never a deterministic one, where retrying would burn
the budget before surfacing the real problem, and never an overload, where the
documented remedy is to shed load rather than add to it.

#### Properties

##### attempts?

```ts
optional attempts?: number;
```

Defined in: [server/packages/server/src/retry.ts:19](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/retry.ts#L19)

Total attempts including the first. Default 4.

##### baseDelayMs?

```ts
optional baseDelayMs?: number;
```

Defined in: [server/packages/server/src/retry.ts:21](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/retry.ts#L21)

First backoff, doubling each retry. Default 50ms.

##### maxDelayMs?

```ts
optional maxDelayMs?: number;
```

Defined in: [server/packages/server/src/retry.ts:23](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/retry.ts#L23)

Backoff ceiling. Default 2000ms.

##### onRetry?

```ts
optional onRetry?: (error, attempt) => void;
```

Defined in: [server/packages/server/src/retry.ts:29](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/retry.ts#L29)

Observe each retry (logging); never throws into the loop.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `error` | `unknown` |
| `attempt` | `number` |

###### Returns

`void`

##### shouldRetry

```ts
shouldRetry: (error) => boolean;
```

Defined in: [server/packages/server/src/retry.ts:27](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/retry.ts#L27)

Which failures are worth retrying. Required: there is no safe default,
because "retryable" is a property of the transport AND of whether the
operation can be applied twice.

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

Defined in: [server/packages/server/src/retry.ts:31](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/retry.ts#L31)

Delay primitive, injectable so tests run without real timers.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `ms` | `number` |

###### Returns

`Promise`\<`void`\>

***

### SessionSnapshot

Defined in: [server/packages/server/src/protocol.ts:102](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L102)

The complete live truth about one game, as ONE SEAT sees it: the only message
the socket carries, and the body of every accepted command.

Sent on socket open whatever the status, and after every committed change,
lobby or state. Self-describing and idempotent: a client that applies the
newest one it has seen is correct, having missed any number of earlier ones,
so there is no state for it to reconstruct and no channel for it to correlate
against another.

It carries the immutable header as well as the moving parts because a game
screen must not need a second source. That is what the old split cost: status
lived only in a D1 read nothing re-issued, so a client could observe a frame
without the status it belonged to, and never learned a game had started.

Hidden information is safe by construction: the envelope is projected per seat
before it is sent, and `frame` is only ever the receiving principal's own
seat's view.

#### Properties

##### access

```ts
access: GameAccess;
```

Defined in: [server/packages/server/src/protocol.ts:115](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L115)

##### budgetSeconds

```ts
budgetSeconds: number | null;
```

Defined in: [server/packages/server/src/protocol.ts:119](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L119)

##### config

```ts
config: JsonObject;
```

Defined in: [server/packages/server/src/protocol.ts:117](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L117)

##### createdBy

```ts
createdBy: string | null;
```

Defined in: [server/packages/server/src/protocol.ts:125](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L125)

##### frame

```ts
frame: FrameMessage | null;
```

Defined in: [server/packages/server/src/protocol.ts:135](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L135)

The receiving seat's observation at `version`. Null in the lobby, and null
for a principal holding no seat, which is how an unseated client still
learns that the game started.

##### gameId

```ts
gameId: string;
```

Defined in: [server/packages/server/src/protocol.ts:113](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L113)

Fixed at creation; carried so this is sufficient on its own.

##### incrementSeconds

```ts
incrementSeconds: number | null;
```

Defined in: [server/packages/server/src/protocol.ts:120](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L120)

##### maxPlayers

```ts
maxPlayers: number;
```

Defined in: [server/packages/server/src/protocol.ts:124](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L124)

##### minPlayers

```ts
minPlayers: number;
```

Defined in: [server/packages/server/src/protocol.ts:123](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L123)

##### players

```ts
players: Seat[];
```

Defined in: [server/packages/server/src/protocol.ts:129](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L129)

##### rated

```ts
rated: boolean;
```

Defined in: [server/packages/server/src/protocol.ts:121](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L121)

##### ratingPool

```ts
ratingPool: string | null;
```

Defined in: [server/packages/server/src/protocol.ts:122](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L122)

##### schemaVersion

```ts
schemaVersion: number;
```

Defined in: [server/packages/server/src/protocol.ts:116](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L116)

##### seq

```ts
seq: number;
```

Defined in: [server/packages/server/src/protocol.ts:110](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L110)

Monotonic per game, incremented by every commit. Totally orders snapshots
across every path they arrive by, which `version` cannot do because a lobby
change has none. Apply a snapshot when `seq` exceeds the held one, OR when
it reports a terminal status the held state does not: `finished` and
`aborted` are absorbing, so they need no ordering even if the final socket
delivery is missed.

##### shortCode

```ts
shortCode: string;
```

Defined in: [server/packages/server/src/protocol.ts:114](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L114)

##### status

```ts
status: GameStatus;
```

Defined in: [server/packages/server/src/protocol.ts:128](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L128)

What moves.

##### turnSeconds

```ts
turnSeconds: number | null;
```

Defined in: [server/packages/server/src/protocol.ts:118](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L118)

##### type

```ts
type: "session";
```

Defined in: [server/packages/server/src/protocol.ts:103](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L103)

##### version

```ts
version: number | null;
```

Defined in: [server/packages/server/src/protocol.ts:131](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L131)

The newest committed version, or null while the game is in the lobby.

***

### SiteConfig

Defined in: [server/packages/server/src/site/config.ts:53](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L53)

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

Defined in: [server/packages/server/src/site/config.ts:59](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L59)

Longer download-page prose. Defaults to `tagline`.

##### legal?

```ts
optional legal?: LegalConfig;
```

Defined in: [server/packages/server/src/site/config.ts:73](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L73)

##### madeByCredit?

```ts
optional madeByCredit?: string | null;
```

Defined in: [server/packages/server/src/site/config.ts:71](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L71)

Footer credit line. Defaults to [DEFAULT\_CREDIT](#default_credit); `null` removes it.

##### name?

```ts
optional name?: string;
```

Defined in: [server/packages/server/src/site/config.ts:55](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L55)

Public game name in titles and OG tags. Defaults to `appName`.

##### ogImage?

```ts
optional ogImage?: string;
```

Defined in: [server/packages/server/src/site/config.ts:69](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L69)

Path under `public/` to the 1200x630 OG image. Defaults to
`/og-image.png`, the name the
[branding guide](https://eigeninteractive.com/docs/ship-it/branding)
prescribes for the Flutter app's own share card: one image, both
surfaces. The engine never generates images.

##### operator

```ts
operator: OperatorConfig;
```

Defined in: [server/packages/server/src/site/config.ts:72](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L72)

##### primaryColor

```ts
primaryColor: string;
```

Defined in: [server/packages/server/src/site/config.ts:61](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L61)

Hex accent colour, e.g. `#1a237e`. Also the `theme-color`.

##### screenshots?

```ts
optional screenshots?: string[];
```

Defined in: [server/packages/server/src/site/config.ts:63](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L63)

Filenames under `public/screenshots/`, shown as a scrolling strip.

##### tagline

```ts
tagline: string;
```

Defined in: [server/packages/server/src/site/config.ts:57](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L57)

One-sentence hook. The meta description and OG description.

***

### TokenVerifier

Defined in: [server/packages/server/src/auth/firebase.ts:29](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/auth/firebase.ts#L29)

The seam `createEngine` consumes. Production is
[createFirebaseVerifier](#createfirebaseverifier) with the default remote JWKS; tests inject a
local JWKS and mint their own RS256 tokens.

#### Methods

##### verify()

```ts
verify(token): Promise<AuthClaims>;
```

Defined in: [server/packages/server/src/auth/firebase.ts:31](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/auth/firebase.ts#L31)

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

Defined in: [server/packages/server/src/protocol.ts:23](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L23)

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

### CommandRejectCode

```ts
type CommandRejectCode = "commandConflict";
```

Defined in: [server/packages/server/src/protocol.ts:81](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L81)

A stable command id was already committed by this principal for different
semantic intent. Retrying or resyncing cannot repair this caller defect.

***

### CommandResult

```ts
type CommandResult =
  | {
  ok: true;
  session: SessionSnapshot;
}
  | {
  code:   | RejectCode
     | LobbyRejectCode
     | CommandRejectCode;
  message: string;
  ok: false;
};
```

Defined in: [server/packages/server/src/protocol.ts:162](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L162)

What `GameDO.handle()` returns: one accepted shape for every command kind,
the caller's own post-commit [SessionSnapshot](#sessionsnapshot), so a lobby command and a
move answer with the same value and the client feeds both into one path.

Accepted results are stored for commandId dedupe and replayed verbatim to a
retry, which means a retry receives the snapshot as it was at first execution.
That is harmless rather than stale: `seq` orders it against whatever the
client now holds, so an older one is simply discarded. Rejections are computed
fresh each time, since re-evaluating one is always sound.

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

Defined in: [server/packages/server/src/protocol.ts:62](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/protocol.ts#L62)

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

Defined in: [server/packages/server/src/auth/provision.ts:19](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/auth/provision.ts#L19)

## Variables

### DEADLINE\_GRACE\_MS

```ts
const DEADLINE_GRACE_MS: 750 = 750;
```

Defined in: server/packages/kernel/dist/timing.d.ts:22

Grace window (ms) added to every deadline comparison so a player who
submits on time is not rejected because network latency carried the request
past the deadline. Keep it small relative to per-action `turnSeconds`
windows. The client's display-only `kServerDeadlineGrace` mirrors this.

***

### DEFAULT\_CREDIT

```ts
const DEFAULT_CREDIT: "Built with EigenInteractive" = "Built with EigenInteractive";
```

Defined in: [server/packages/server/src/site/config.ts:41](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/site/config.ts#L41)

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

Defined in: [server/packages/server/src/d1/apply.ts:48](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L48)

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

Defined in: [server/packages/server/src/engine.ts:458](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L458)

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

Defined in: [server/packages/server/src/auth/firebase.ts:46](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/auth/firebase.ts#L46)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `projectId` | `string` |
| `getKey?` | `JWTVerifyGetKey`\<`CryptoKeyStructuralFallback` \| `Uint8Array`\<`ArrayBufferLike`\>\> |

#### Returns

[`TokenVerifier`](#tokenverifier)

***

### createGame()

```ts
function createGame(d1, input): Promise<void>;
```

Defined in: [server/packages/server/src/d1/apply.ts:329](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L329)

Write the games row + one participants row per seat, atomically. The DO
lazy-inits from exactly these rows on first contact.

The create's receipt is two columns of the games row rather than a row of its
own, so it lands in the same INSERT as the game it identifies and cannot be
separated from it by any failure.

Callers own both failure modes, distinguished by `isCreateReplay` and
`isShortCodeCollision`: a reused command id means this create already happened,
while a duplicate shortCode is a random clash to retry.

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

Defined in: [server/packages/server/src/bot/bot-auth.ts:60](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/bot/bot-auth.ts#L60)

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

Defined in: server/packages/kernel/dist/ratings.d.ts:60

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

Defined in: [server/packages/server/src/auth/provision.ts:51](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/auth/provision.ts#L51)

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

### isRetryableDoError()

```ts
function isRetryableDoError(error): boolean;
```

Defined in: [server/packages/server/src/game-stub.ts:59](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/game-stub.ts#L59)

True for a Durable Object error Cloudflare marks retryable and does not also
mark overloaded.

Structured properties, not message matching, unlike the D1 predicates: the
runtime sets `retryable` and `overloaded` on the error itself. Requiring
`retryable === true` fails closed, so an application exception thrown by the
game (a `GameBugError`, an integrity violation) is never retried — it carries
no such property, and repeating it would only delay the report.

`overloaded` vetoes the retry even when `retryable` is also set: Cloudflare's
guidance is explicit that overloaded errors "should not be retried", because
retrying is what caused the overload.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `error` | `unknown` |

#### Returns

`boolean`

***

### isTransientD1Error()

```ts
function isTransientD1Error(error): boolean;
```

Defined in: [server/packages/server/src/d1/errors.ts:97](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/errors.ts#L97)

True for the D1 failures worth retrying: a network blip, a storage or
Durable-Object reset, a code-update restart, or a transient routing failure.

Deliberately narrow; see RETRYABLE\_D1. Pass to `withRetry` as its
`shouldRetry` for an idempotent D1 write.

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

Defined in: [server/packages/server/src/d1/apply.ts:280](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L280)

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

Defined in: [server/packages/server/src/engine.ts:571](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/engine.ts#L571)

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
  createCommandId: string;
  createdAt: number;
  createdBy: string | null;
  createRequest: string;
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

Defined in: [server/packages/server/src/d1/apply.ts:372](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L372)

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
  `createCommandId`: `string`;
  `createdAt`: `number`;
  `createdBy`: `string` \| `null`;
  `createRequest`: `string`;
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

### retryingGameStub()

```ts
function retryingGameStub(connect, options?): GameStub;
```

Defined in: [server/packages/server/src/game-stub.ts:78](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/game-stub.ts#L78)

Wrap a game stub so every call retries a transient Durable Object failure.

`connect` is called again for each attempt, on purpose: Cloudflare documents
that a `DurableObjectStub` should not be reused after it throws, because many
exceptions leave it in a broken state. Retrying on the same stub would fail
for that reason alone, so the factory — not a stub — is what gets passed in.

Every method is retried except GameStub.fetch, which carries the
WebSocket upgrade. A retry there is meaningless (the client is upgrading one
connection, and the `Request` body is not replayable), so it passes straight
through and a failure surfaces as it always did.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `connect` | () => `GameStub` |
| `options?` | `Partial`\<[`RetryOptions`](#retryoptions)\> |

#### Returns

`GameStub`

***

### updateSummary()

```ts
function updateSummary(d1, args): Promise<void>;
```

Defined in: [server/packages/server/src/d1/apply.ts:262](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/d1/apply.ts#L262)

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
function withRetry<T>(op, options): Promise<T>;
```

Defined in: [server/packages/server/src/retry.ts:49](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/src/retry.ts#L49)

Run `op`, retrying a *retryable* failure with jittered exponential backoff up
to `attempts`. A non-retryable failure, or the last attempt, throws.

Safe to leave unawaited inside a Durable Object: the DO stays alive while the
returned promise (and its backoff timers) is pending, so the whole sequence
runs to completion without `waitUntil`, exactly like the single-attempt writes
it wraps.

`op` MUST be idempotent: a retry can fire after an operation that actually
landed but whose acknowledgement was lost. Nothing here can detect that, so it
is the caller's invariant, not this function's.

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
