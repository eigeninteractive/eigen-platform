# @eigeninteractive/server

## 0.6.0

### Minor Changes

- [`54882cd`](https://github.com/eigeninteractive/eigen-platform/commit/54882cd6b847dd03011da2abb0dbdd33f82acd70) Thanks [@seenu-k](https://github.com/seenu-k)! - Simplify the pre-production engine contract around server-authoritative game
  creation, contiguous game versions, operation-specific mutation correctness,
  and short-lived WebSocket tickets. New games now use exactly the latest rules
  version; the capabilities endpoint and generic command-receipt protocol are
  removed. Rules declare allowed timing policies, and the kernel fixes charging
  and deadline-alarm behavior across timed transitions. Unknown public game IDs
  are rejected from the retained D1 registry before a Durable Object is derived
  or woken. Game and external-bot JSON bodies are capped at 64 KiB, and the
  server-only WebSocket closes clients that send application messages.
  
  Build all public TypeScript packages with tsdown, including declaration maps,
  from their own package dependencies rather than cross-workspace `node_modules`
  paths.

### Patch Changes

- Updated dependencies [[`54882cd`](https://github.com/eigeninteractive/eigen-platform/commit/54882cd6b847dd03011da2abb0dbdd33f82acd70)]:
  - @eigeninteractive/rules@0.6.0
  - @eigeninteractive/kernel@0.6.0

## 0.5.2

### Patch Changes

- [#24](https://github.com/eigeninteractive/eigen-platform/pull/24) [`1f0be89`](https://github.com/eigeninteractive/eigen-platform/commit/1f0be8931be65360fe349edcdb51595aac81856c) Thanks [@dependabot](https://github.com/apps/dependabot)! - Refresh the server workspace's dependencies.
  
  Runtime dependencies of this package move with it: `hono` 4.12 → 4.13, `jose`
  6.2.3 → 6.2.9, `@hono/zod-openapi` 1.5 → 1.6, and `openapi3-ts` 4.6.0 → 4.6.1.
  Consumers receive those ranges, which is why a dependency refresh is a release
  rather than an internal change.
  
  The rest is tooling and does not reach a published artifact: `wrangler`,
  `@cloudflare/workers-types`, `@cloudflare/vitest-pool-workers`, `@biomejs/biome`,
  `@types/node`, `tsx`, and `@changesets/changelog-github`. TypeScript is
  deliberately absent — `.github/dependabot.yml` holds its majors back, and the
  header there records why for each half of the repository.
  
  `server/examples/rps/worker-configuration.d.ts` is regenerated for the newer
  `wrangler`, which is the mechanical half of triaging one of these: the generated
  files are committed, and the bot cannot run the generators.
- Updated dependencies []:
  - @eigeninteractive/kernel@0.5.2
  - @eigeninteractive/rules@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [[`e8be483`](https://github.com/eigeninteractive/eigen-platform/commit/e8be48352e5e6408ebb4bd05d7d0c00a162ec12e)]:
  - @eigeninteractive/rules@0.5.1
  - @eigeninteractive/kernel@0.5.1

## 0.5.0

### Minor Changes

- [`4e3e470`](https://github.com/eigeninteractive/eigen-platform/commit/4e3e4701be05aabceb6456304f9fadadc939d167) Thanks [@seenu-k](https://github.com/seenu-k)! - Deduplicate game creation on the `Idempotency-Key`, so a retried create returns
  the game it already made instead of a second one.
  
  Every other game mutation is committed by a game's Durable Object, which stores
  its receipt beside the state change. Creation has no game yet, so its receipt is
  two new columns on the `games` row — `create_command_id` and `create_request` —
  written in the same INSERT as the rest of it. A new
  `idx_games_create_key` UNIQUE index on `(created_by, create_command_id)` is what
  makes a second create under the same key impossible.
  
  - A retried `POST /games` returns the original `gameId` and `shortCode`, and
    fans out no second round of friend invites.
  - A retried `POST /games/solo` returns the same running game. It is two
    operations under one key: the create is recognised from its receipt, and the
    start is re-issued under an id derived from that key, which also resumes a
    create whose process died before the start landed.
  - Reusing a key for a materially different create is refused with
    `422 commandConflict`, matching the behaviour of every other mutation.
  - Keys are scoped per creator, so two callers may independently choose the same
    one.
  
  The receipt is kept for the life of the game, like the Durable Object's own
  receipts and for the same reason: an expired receipt would let an ancient retry
  become a new mutation. It costs nothing, because the row exists anyway.
  
  **Migration.** These columns are added to the initial D1 migration rather than a
  forward one, since no deployment exists yet: re-apply migrations
  (`wrangler d1 migrations apply`) and discard local development data
  (`rm -rf .wrangler`).

- [`15e2577`](https://github.com/eigeninteractive/eigen-platform/commit/15e257714336292d49ecb0445ff7b2a424f6c63d) Thanks [@seenu-k](https://github.com/seenu-k)! - Retry a transient Durable Object failure instead of turning it into a 500.
  
  A Durable Object call can fail for reasons unrelated to the command: the object
  was reset because its code was updated (which happens on every deploy), its host
  was rescheduled, a network hop dropped. Cloudflare marks those errors
  `retryable`. Until now they surfaced as `500 Internal server error`, which is the
  worst available answer — it carries a response, so a client cannot distinguish it
  from a deliberate server decision and correctly declines to retry. A player lost
  a move to a deploy.
  
  Every game stub call except the WebSocket upgrade now retries such a failure
  twice with jittered backoff (~300ms worst case), and each attempt builds a fresh
  stub, because Cloudflare documents that a `DurableObjectStub` must not be reused
  after it throws.
  
  This is safe only because every command the Worker sends carries a stable
  identity — the caller's `Idempotency-Key`, a derived id for create-solo's start,
  or a deterministic id for the account purge and the bot webhook — so the object
  either commits once or replays its receipt. `retryable` does **not** promise the
  operation was skipped; Cloudflare's guidance is to retry such errors *if requests
  are idempotent*, and receipts are what make them so. Overloaded errors are never
  retried, and an exception thrown by the game itself is never retried, since the
  predicate requires the runtime's own `retryable` flag.
  
  `isRetryableDoError` and `retryingGameStub` are exported for implementors calling
  a game stub directly.
  
  **Breaking, for direct `withRetry` callers only.** `RetryOptions.shouldRetry` is
  now required and `withRetry` moved to `@eigeninteractive/server`'s root module
  (the package export path is unchanged). It previously defaulted to the D1
  predicate, which silently made "retry with D1 semantics" the behaviour for any
  caller, including ones retrying something that was not D1. Pass
  `shouldRetry: isTransientD1Error` to keep the old behaviour.

- [`94532bc`](https://github.com/eigeninteractive/eigen-platform/commit/94532bc441537c7a269abb12a0c17ce14f8a2d2a) Thanks [@seenu-k](https://github.com/seenu-k)! - Check schema-version support exactly, and move creation authority to the server.
  
  **Breaking.** `Join` and `JoinByCode` replace `clientSchemaVersion: number` with
  `clientSchemaVersions: number[]`, the full set of versions the client build ships.
  
  The old field was a maximum, compared as `game.schemaVersion <= clientMaximum`.
  That is not a compatibility test: `GameModule.versions` is deliberately sparse — a
  build may ship `{1, 3}` once v2 has drained — so the comparison seated a `{1, 3}`
  client into a v2 game whose frames it cannot decode. The server now tests exact
  membership, before a seat is created.
  
  **Creation is the server's decision.** New games may only be created at the
  deployment's highest shipped version. A create asserting any other version is
  refused with `409 schemaUnsupported`, which clients already surface as "update
  your app". Previously the client's own newest version decided, so an app could
  race ahead of a server that could not run that version, and an old app could keep
  creating a version the operator had retired. An unshipped version now answers
  `schemaUnsupported` rather than a bare 400, matching the join gate.
  
  `EngineConfig.creatableSchemaVersions` overrides the default for the two cases it
  cannot express: rolling creation back after a bad rules release without
  unshipping the version that games already exist at, and a deployment whose
  `versions` are parallel variants rather than an upgrade sequence. Listing several
  does not make clients negotiate — a client always creates at the newest version it
  ships, and this decides whether that is allowed. A configured version the
  deployment does not ship fails at startup rather than at a player's first create.
  
  **New:** `GET /api/engine/capabilities` publishes `creatableSchemaVersions` and
  `supportedSchemaVersions`, so a client can tell whether it is compatible before
  trying. Nothing is required to read it: the refusal path carries the same
  information, and a stale client that ignores it behaves exactly as it does now.

- [`d6f16dd`](https://github.com/eigeninteractive/eigen-platform/commit/d6f16dd0f9fd4170440d009330424aa1c0181e9a) Thanks [@seenu-k](https://github.com/seenu-k)! - Carry the mutation command id in the standard `Idempotency-Key` request header,
  and require it.
  
  **Breaking.** Every game mutation now requires the `Idempotency-Key` header and
  no longer accepts a `commandId` body field. The server no longer mints one when
  it is absent: that fallback silently gave every attempt a fresh identity, which
  is no idempotency at all. A request without the header is refused with
  `400 idempotencyKeyInvalid`.
  
  Account, social and device routes are unchanged and require no key: they are
  set-like operations whose repetition already reaches the same state.
  
  `commandConflict` moves from 409 to 422, matching the `Idempotency-Key`
  specification and keeping 409 honest: every other 409 here means "your view is
  stale, resync and retry", which is exactly what a caller must not do with a key
  already committed for a different request.
  
  Leave, cancel and start no longer take a request body at all, so the empty
  `LobbyCommand` schema is gone.
  
  `@eigeninteractive/server/testing` gains `testMutationHeaders`, which supplies
  the bearer token, the content type, and a fresh key — or an exact one, to
  exercise a retry.
  
  Creation deduplicates on it too; see the create-receipt changeset.

- [`d87de0e`](https://github.com/eigeninteractive/eigen-platform/commit/d87de0eb19b0bfed248ea43f24ceb9fc62332db0) Thanks [@seenu-k](https://github.com/seenu-k)! - Make seat counts rules-authoritative with a new `playerLimits` hook.
  
  **Breaking.** `GameRules` gains a required `playerLimits({ config }) →
  { minPlayers, maxPlayers }`: the seats a version can actually be played with, read
  from the parsed config.
  
  Seat counts were entirely caller-supplied. `POST /games` and `POST /games/solo`
  took `minPlayers`/`maxPlayers` and validated them only against *each other*, and
  no hook existed to check them against the rules — so a client could create a
  three-seat game of a two-seat game. That is not a bigger game: `initialState`
  receives `playerCount` seats and hooks index by it, so the example RPS rules
  (`moves: z.tuple([move, move])`, `playerIndex as 0 | 1`) would mis-slot the third
  seat's move or fail state validation. RFC 0005 requires that caller-supplied
  derived values not exist; this closes the seat case.
  
  Creation now derives the bounds and validates the caller's range against them.
  The two body fields are **optional**: omitted means exactly what the rules
  declared, which is every fixed-size game. A caller may still *narrow* the range
  for one lobby (opening a 2-6 game as 3-6). A range reaching outside the derived
  bounds is refused with **422**, matching how a drifted `rated` assertion is
  refused rather than coerced. `playerLimits` returning a malformed range is a 500
  naming the hook, not a corrupt game.
  
  Twin fixtures gain a `playerLimits` case kind so TS/Dart drift on the seat
  declaration fails a test. It is the one twin the server enforces, so drift there
  breaks creation instead of a rendering detail — worth a case even in a fixed-size
  game.

- [`1c598e2`](https://github.com/eigeninteractive/eigen-platform/commit/1c598e24314fc89141008424fa65f39534245017) Thanks [@seenu-k](https://github.com/seenu-k)! - Repair D1 read models that have fallen behind the Durable Object, and add the
  operator surface that runs the same repair on demand.
  
  **The defect.** `GameStub.repokeFinish` existed, was tested, and **nothing called
  it.** A finish whose D1 apply fails keeps its outbox row in the DO precisely so it
  can be retried — but with no caller, that row was kept forever and the game's
  rating deltas were never written. Silent, permanent, and invisible from D1, which
  just holds a plausible row that stopped changing. The same silence is what a lost
  post-commit mirror write looks like, since `#mirrorD1` gives up after its retries
  rather than failing a commit whose truth is already durable.
  
  **`GameStub.reconcile(gameId)`** is the repair: rewrite D1's roster and summary
  rows from committed state, retry a retained finish, re-arm the alarm if it
  disagrees, and report what it found. Idempotent, so it is safe on a healthy game.
  It deliberately does **not** lazy-init — lazy init reads the games row *from D1*,
  so an object with no committed state has nothing more authoritative than the row it
  would be repairing, and reconciling it would read the stale copy, write it back,
  and report success. That case reports `initialized: false` instead.
  
  **A third cron job** finds candidates without being told which defect it is
  looking at: an active game long past its committed turn deadline (its alarm should
  have fired and written by now), or any non-terminal game with no D1 update for
  `mirrorStaleMs`. The second is the only signal that finds a stuck finish on an
  untimed game, which has no deadline to be late for. Oldest first, batch-capped —
  each candidate wakes a Durable Object, so this is the tightest of the three
  batches. New `lifecycle` options: `deadlineGraceMs` (6h), `mirrorStaleMs` (7d),
  `reconcileBatch` (100). `mirrorStaleMs` must stay below `untimedActiveTtlMs` or the
  reap aborts such a game before this can repair it.
  
  **New: `/api/ops`,** gated by an `OPS_TOKEN` secret. `GET /api/ops/games/{id}`
  shows the DO's view and D1's side by side; `POST /api/ops/games/{id}/reconcile`
  runs the repair. Every route answers **404** while `OPS_TOKEN` is unset, so a
  deployment that never configures one has no surface to probe rather than a guarded
  one. Not in the OpenAPI document and not in the generated clients: a player's app
  has no business knowing these routes exist.
  
  `inspect` returns the **unseated** session view — what a spectator sees, carrying
  no observation data — so it cannot become a cheating channel for a live game
  whoever holds the secret. The token is compared by SHA-256 digest in an
  accumulating loop, since Workers has no `timingSafeEqual`.
  
  **Breaking.** `GameStub.repokeFinish` is removed; `reconcile` supersedes it. Two
  operator entry points where one was a strict subset of the other gave a caller no
  way to know the narrow one was the right choice, and nothing outside tests called
  it. The Durable Object retains the retry as a private step of `reconcile`.

### Patch Changes

- [`517b06b`](https://github.com/eigeninteractive/eigen-platform/commit/517b06badf929f2ee8beb0a8670ac051acc2987a) Thanks [@seenu-k](https://github.com/seenu-k)! - Store command results as principal-scoped Durable Object receipts, and derive the
  deadline alarm from committed state.
  
  A retry carrying the same `(principal, commandId)` and the same canonical RFC 8785
  request replays the committed result; the same id carrying different intent is
  refused as `commandConflict` rather than guessed at. Receipts survive finish and
  cancel compaction. Identity-less system commands, such as a deadline timeout,
  store no receipt: they are idempotent because the kernel abstains once the state
  they were derived from has moved on.
  
  `CommitPlan.alarm` is gone. The host now derives the alarm from the committed
  deadline with the new `alarmForDeadline` helper and reconciles it after every
  command, so a `setAlarm` lost after its deadline committed repairs itself without
  a player having to act.
  
  Pre-production storage break: the Durable Object `commands` table is redefined in
  the initial migration rather than migrated forward. Discard local development
  state (`rm -rf .wrangler`) before running against it.
- Updated dependencies [[`517b06b`](https://github.com/eigeninteractive/eigen-platform/commit/517b06badf929f2ee8beb0a8670ac051acc2987a), [`6075b87`](https://github.com/eigeninteractive/eigen-platform/commit/6075b87bc44a2ca536c989531590a169b112b081), [`d87de0e`](https://github.com/eigeninteractive/eigen-platform/commit/d87de0eb19b0bfed248ea43f24ceb9fc62332db0), [`25b9239`](https://github.com/eigeninteractive/eigen-platform/commit/25b923910be86edbfd66a0cd7dbf8e3955fc3f67)]:
  - @eigeninteractive/kernel@0.5.0
  - @eigeninteractive/rules@0.5.0

## 0.4.1

### Patch Changes

- Charge budget clocks according to the persisted turn that ended, including
  budget-to-override, override timeout, and finishing transitions, and arm
  deadline alarms at the first genuinely expired millisecond.

- [#2](https://github.com/eigeninteractive/eigen-platform/pull/2) [`55f0ac8`](https://github.com/eigeninteractive/eigen-platform/commit/55f0ac878338a0141ba4e7f2ddb702f2a1a2ab75) Thanks [@seenu-k](https://github.com/seenu-k)! - Point package source, issue, changelog, and release metadata at the unified
  `eigen-platform` repository. Runtime behavior is unchanged.
- Updated dependencies [[`55f0ac8`](https://github.com/eigeninteractive/eigen-platform/commit/55f0ac878338a0141ba4e7f2ddb702f2a1a2ab75)]:
  - @eigeninteractive/kernel@0.4.1
  - @eigeninteractive/rules@0.4.1

## 0.4.0

### Minor Changes

- [#60](https://github.com/eigeninteractive/eigen-server/pull/60) [`4339dff`](https://github.com/eigeninteractive/eigen-server/commit/4339dff9c9f43bff9b9f482f6e9cd72f4f9476c7) Thanks [@seenu-k](https://github.com/seenu-k)! - Pagination cursors are now opaque tokens, and empty query parameters are treated as absent.
  
  Every paged list could silently return nothing. A client that sent an optional
  query parameter it had no value for produced `?cursor`, which arrives as the
  empty string, and `z.coerce.number()` is `Number()`, so `""` became `0`. Zero is
  a structurally valid integer cursor meaning "strictly older than the beginning of
  time", so the request did not fail: the lobby, both `games/mine` buckets, the
  friends list and every history screen returned `200` with an empty array. Nothing
  was logged, because nothing had gone wrong as far as any layer could tell.
  
  Three changes, each closing a different part of it:
  
  - **`cursor` is now an opaque string** rather than a bare epoch-millisecond
    integer, and paged responses carry a **`nextCursor`** that is null exactly when
    the list is exhausted. There is no byte string that accidentally decodes to the
    beginning of time, so the failure above cannot recur by construction. A cursor
    that does not decode is a `400` with the new `invalidCursor` code.
  - **The cursor carries the row id alongside the sort value**, so pages no longer
    drop a row when two games share a timestamp - a limitation the previous
    implementation documented but did not fix. The comparison is a SQLite row value
    (`(sortKey, id) < (?, ?)`), which is planned against the same index.
  - **Query parameters are parsed, never coerced.** This is the origin of the whole
    failure, and it took four correct layers to become invisible. `Number(null)` is
    `0`, so `z.coerce.number().int().min(0)` genuinely accepts null; the emitted
    schema honestly reported `["integer", "null"]`; `openapi-generator` correctly
    dropped its `if (x != null)` guard, because the API had declared null welcome;
    dio rendered that null as a bare `?to=`; and the server coerced `""` back to
    `0`. No library was misbehaving. Integer query parameters now parse from a
    strict pattern, so they reject null and empty alike, which means the generated
    client omits an absent parameter on its own and a malformed one is a loud `400`
    rather than a plausible, wrong `200`. `?pool=` and `?to=` were failing the same
    way and are fixed by the same change.
  
    A contract test now asserts that no query parameter in the published document
    is nullable, which is the tell that was invisible in review: `.min(0)` was
    nullable and `.min(1)` was not.
  
  Because `nextCursor` is now an answer rather than something a client infers from
  a short page, callers no longer need to know how any list is sorted, and a final
  page that happens to be exactly full no longer triggers one pointless request.
  
  Breaking for direct API consumers: `cursor` is a string, and the four paged
  responses (`Lobby`, `MyGames`, `PlayerGames`, `FriendsGames`) gained a required
  `nextCursor` field. The generated Dart client and `eigen_flutter` are updated to
  match.

### Patch Changes

- Updated dependencies []:
  - @eigeninteractive/kernel@0.4.0
  - @eigeninteractive/rules@0.4.0

## 0.3.1

### Patch Changes

- [#55](https://github.com/eigeninteractive/eigen-server/pull/55) [`13ac3e3`](https://github.com/eigeninteractive/eigen-server/commit/13ac3e38ab18a8da39e09392bc3a70226d0b3bf2) Thanks [@seenu-k](https://github.com/seenu-k)! - Serve a placeholder app icon instead of linking one that is not there.
  
  Every page the engine renders linked `/favicon.png` and `/icons/Icon-192.png`
  unconditionally. Those are static assets from the game's own `public/`, which a
  fresh scaffold ships holding a single `.gitkeep`, so until a Flutter web build
  landed there the browser tab was blank and all four manifest icons 404ed. An
  Android-only game, which never runs `build:web`, stayed that way permanently,
  even though the download page's hero already had a fallback for exactly this
  case.
  
  The shell now links the EigenInteractive mark, served by the worker at
  `/_eigen/icon/v1/mark.svg` and drawn in the game's `site.primaryColor`, and the
  manifest advertises that single scalable icon rather than four missing PNGs.
  Apple's touch icon is omitted rather than pointed at a missing file, since it
  has no SVG support.
  
  It is a placeholder, not a default: as soon as `favicon.png` exists in
  `public/`, the shell links the game's own icons everywhere and the placeholder
  goes unused.
  
  The probe behind that decision was split in two. `hasWebBuild` asks for
  `index.html` and still gates the "Play on the web" button; the new
  `hasAppIcons` asks for `favicon.png` and gates every icon. They used to be one
  question on the grounds that `flutter build web` emits both together, which is
  true for a game that ships on the web and wrong for the case worth supporting:
  an Android-only game that copies its launcher icons into `public/` now gets
  them. `hasAppIcons` checks the response's content type as well as its status,
  because the scaffold's `single-page-application` fallback answers `200 OK` with
  `index.html` for any asset that is missing.
- Updated dependencies []:
  - @eigeninteractive/kernel@0.3.1
  - @eigeninteractive/rules@0.3.1

## 0.3.0

### Minor Changes

- [#51](https://github.com/eigeninteractive/eigen-server/pull/51) [`d0b28f4`](https://github.com/eigeninteractive/eigen-server/commit/d0b28f4397a3363027b469982451a87b282bbd25) Thanks [@seenu-k](https://github.com/seenu-k)! - The socket now carries one message, a complete per-seat **session snapshot**, and every accepted command answers with the same value. `roster`, `sync` and `frame` as separate message kinds are gone.
  
  This is a breaking wire change, and it fixes a class of bug rather than an instance. The old shape asked a client to assemble one session out of four sources, each carrying a different slice of the truth under a different versioning scheme: an HTTP summary that carried status, unversioned `roster` messages that stopped at the lobby, a `sync` on mid-game open that carried only a version, and versioned `frame` messages that carried neither. Read that list for "how does a client learn the game became `active`" and the answer is that it cannot. Nothing on the live channel said so. A creator sitting in a full waiting room never saw a Start button, and every seat stayed in the waiting room after the game began, until the screen was disposed and re-entered.
  
  ```jsonc
  {
    "type": "session",
    "seq": 7,                    // monotonic per game, incremented by EVERY commit
    "gameId": "…", "shortCode": "ABC123", "access": "private",
    "schemaVersion": 1, "config": { … },
    "turnSeconds": null, "budgetSeconds": null, "incrementSeconds": null,
    "rated": false, "ratingPool": null,
    "minPlayers": 2, "maxPlayers": 2, "createdBy": "…",
    "status": "active",          // what moves
    "players": [ … ],
    "version": 3,                // null in the lobby
    "frame": { … }               // THIS seat's observation; null in the lobby
  }
  ```
  
  It is sent on socket open at **every** status, and after every committed change, lobby or state. Being complete makes it idempotent: a client that applies the newest one it has seen is correct however many it missed, so there is nothing to reconstruct and no second channel to correlate against. It carries the immutable header as well as the moving parts because a game screen must not need a second source; the D1 summary stays what it always was, the index behind lists and discovery.
  
  Hidden information is safe by construction rather than by vigilance. The envelope is projected per seat before it is sent, `frame` is only ever the receiving principal's own seat's view resolved against the roster at send time, and a socket holding no seat gets the envelope with `frame: null`, which is how a viewer learns the game started at all.
  
  **`seq` is the new ordering key**, because `version` cannot order a lobby change that has none. Apply a snapshot when `seq` exceeds the one you hold; that single comparison resolves a command response racing its own socket push, a duplicate delivery, and a reconnect that missed nothing. One clause is added, and it is a property of the state machine rather than an exception: a `finished` or `aborted` snapshot applies whatever its `seq`, because those statuses are absorbing and the abort teardown drops the storage the counter lives in.
  
  Gap recovery is unchanged and still animates. `GET /games/{id}/frames?from=&to=` still fills a version jump, and the missing span is played through **under the previous envelope**, so only the real snapshot may move `status`, `players` and `seq`. A client that missed a finish therefore animates the moves and then shows the outcome, instead of displaying a finished game while mid-game moves play.
  
  New and changed surface:
  
  - `GET /games/{id}/session` returns the snapshot over HTTP, for the paths that have no socket.
  - `LobbyAccepted`, `Joined` and `Roster` are gone. `CommandAccepted` and `SoloStarted` are now `{ session }`.
  - `RosterSnapshot` and `SyncMessage` are removed from the exported protocol types; `SessionSnapshot` replaces them. `FrameMessage` remains, as the payload inside a snapshot and the element type of the range fetch.
  - `GameStub` gains `session(gameId, userId)`.
  - The Durable Object's `meta` table gains `seq`, `short_code` and `outcomes`. Pre-1.0 and with no games depending on the engine, these are edited into the init migration in place rather than added as a second one, so **local `.wrangler` state predating this must be deleted**. Outcomes are retained rather than drained by the finish compaction, because they are kernel output that no transition row holds, so a cold open of a finished game could not otherwise be answered from the DO alone.
  
  One incidental fix rides along: `frame` was typed non-nullable in the generated Dart client, because a nullable `$ref` lost its null branch on the way into the OpenAPI document. The schema now spells it as a union, so it emits `anyOf: [$ref, {type: null}]` and generates as `Frame?`. A lobby session would have crashed the old typing on arrival.

### Patch Changes

- Updated dependencies []:
  - @eigeninteractive/kernel@0.3.0
  - @eigeninteractive/rules@0.3.0

## 0.2.5

### Patch Changes

- [#46](https://github.com/eigeninteractive/eigen-server/pull/46) [`4efa591`](https://github.com/eigeninteractive/eigen-server/commit/4efa591cb75546194a4a6bc8ed984bf78c9cf782) Thanks [@seenu-k](https://github.com/seenu-k)! - Em dashes are gone from every line this repository writes. Most of that is comments and documentation, but some of it is text that ships:
  
  - **Error and response messages.** `State updated, try again` (kernel `stateUpdated`), `Too many requests in a short window. Slow down and try again.`, `Unsupported image type '…'. Use image/jpeg, …`, `Account deletion failed. Please try again`. Dispatch on `code`, never on `error`, so nothing that follows that rule is affected.
  - **OpenAPI descriptions**, and therefore the generated `eigen_api` Dart client and the published HTTP reference. Wording only; no operation, schema or status code moved.
  - **Engine-rendered public pages.** A page title now reads `Terms of Service: My Game`, joined with a colon rather than a dash, and the `/j` share description separates the versus line with a comma.
  - **`create-eigen-game`'s own output**, including the greeting, the missing-tooling report and the scaffolded project's README.
  
  `worker-configuration.d.ts` is untouched: it is Cloudflare's generated runtime types, reproduced by `wrangler types`.
- Updated dependencies [[`4efa591`](https://github.com/eigeninteractive/eigen-server/commit/4efa591cb75546194a4a6bc8ed984bf78c9cf782)]:
  - @eigeninteractive/kernel@0.2.5
  - @eigeninteractive/rules@0.2.5

## 0.2.4

### Patch Changes

- [#34](https://github.com/eigeninteractive/eigen-server/pull/34) [`905b841`](https://github.com/eigeninteractive/eigen-server/commit/905b841158238c21bd7086d9a73e23a7a0fb4ba3) Thanks [@seenu-k](https://github.com/seenu-k)! - Reword the footer credit to `Built with EigenInteractive`, linking only the
  name, accent-coloured and without an underline. A custom `madeByCredit` that names the
  engine keeps the link on that word; one that does not renders as plain text.
  
  Every link the engine renders (the legal pages, the store buttons, the credit)
  now opens in a new tab, and the `/j` share page honours `madeByCredit`
  instead of always showing the default.
- Updated dependencies []:
  - @eigeninteractive/kernel@0.2.4
  - @eigeninteractive/rules@0.2.4

## 0.2.3

### Patch Changes

- [#32](https://github.com/eigeninteractive/eigen-server/pull/32) [`258c2d7`](https://github.com/eigeninteractive/eigen-server/commit/258c2d7c53f31dfcfa8fa22832f378c0eaf3c4be) Thanks [@seenu-k](https://github.com/seenu-k)! - Give the download page something to look at, and stop it offering links it cannot honour.
  
  The page now leads with the app's own launcher icon, centres itself rather than
  clinging to the top of an empty viewport, and ends in a footer on every page:
  the operator's copyright and legal links when `site` is configured, and a credit
  line either way. `site.madeByCredit` overrides that line or removes it with
  `null`, mirroring the Flutter shell's `Branding.madeByCredit`.
  
  Before a web build exists there is no app icon to show, so the EigenInteractive
  mark stands in: inline SVG drawn in the page's own tokens, so it takes a
  configured `primaryColor` and follows the visitor's colour scheme. A game with
  neither a web build nor store URLs has nothing to offer at all, and now says
  `Coming soon.` instead of ending after the tagline.
  
  Two fixes behind it. The "Play on the web" button and the icon are now shown
  only when a Flutter web build is actually deployed: the `ASSETS` binding is
  bound from the first `wrangler dev` whether or not `public/` has anything in it,
  so the button was sending visitors to `/`, which redirected straight back. And
  `--on-primary` is now paired with `--primary` per colour scheme, computed from
  luminance for a game that configures its own: white on the dark scheme's light
  teal was the one pairing in the palette that failed contrast outright.
- Updated dependencies []:
  - @eigeninteractive/kernel@0.2.3
  - @eigeninteractive/rules@0.2.3

## 0.2.2

### Patch Changes

- [#27](https://github.com/eigeninteractive/eigen-server/pull/27) [`c7e1172`](https://github.com/eigeninteractive/eigen-server/commit/c7e1172497088a38e5d09167b12e60b3f402f9c5) Thanks [@seenu-k](https://github.com/seenu-k)! - Give the engine-rendered public pages the EigenInteractive look: Space Grotesk
  on headings and the call to action, and the Material 3 palette generated from
  `Colors.teal`, the same seed the Flutter shell now defaults to, so a game that
  has configured nothing reads as one product across its app and its pages.
  
  The palette replaces three unrelated defaults: `#4f46e5` in the stylesheet,
  `#6750a4` on `/download` and in the web manifest, and Material's baseline
  neutrals, which were tinted for a purple brand. The neutrals here are
  `ColorScheme.fromSeed` output too, which is why the greys are faintly green.
  
  `--primary` also gets a dark-scheme value. It previously kept its light value on
  a dark ground. A game that sets `site.primaryColor` still wins in both schemes,
  that arrives as an inline style on the root element, which beats the stylesheet.
  
  Both faces are served by the worker at versioned, immutable paths and declared
  with `font-display: swap`, so nothing blocks the first paint and one fetch is
  reused across every page, every game on the origin and every later session.
  They are fronted by `caches.default`, because a Worker response is not
  edge-cached automatically and the immutable header alone only reaches the
  device. Nothing is requested from a font CDN, so an operator's domain gains no
  third party. Together they are roughly 90KB of the worker's 3MB compressed budget,
  subset to latin plus punctuation, currency and arrows.
  
  Each face is committed twice: the `.woff2` a font tool can open, and a generated
  `.ts` module holding its base64, which is what the worker imports. `pnpm run
  fonts` regenerates the second from the first and `fonts:check` verifies it in
  CI, so the two cannot drift. `tsup` could inline a `.woff2`, but
  `vitest-pool-workers` resolves worker-side modules outside vite's plugin graph,
  so the route would have answered 500 in the test suite while working in
  production, the same reason `site.css` renders empty under test today.
- Updated dependencies []:
  - @eigeninteractive/kernel@0.2.2
  - @eigeninteractive/rules@0.2.2

## 0.2.1

### Patch Changes

- [#19](https://github.com/eigeninteractive/eigen-server/pull/19) [`993883f`](https://github.com/eigeninteractive/eigen-server/commit/993883f8bb71ebfb36708e2badd7ae98859b7094) Thanks [@seenu-k](https://github.com/seenu-k)! - Use **EigenInteractive** as the product name throughout, matching the domain,
  the npm scope and the GitHub organization. Package descriptions, READMEs and
  the OpenAPI document title change; every identifier (`@eigeninteractive/*`,
  `eigen_flutter`, `create-eigen-game`, the `Eigen-Signature` header) is
  untouched.
- Updated dependencies [[`993883f`](https://github.com/eigeninteractive/eigen-server/commit/993883f8bb71ebfb36708e2badd7ae98859b7094)]:
  - @eigeninteractive/kernel@0.2.1
  - @eigeninteractive/rules@0.2.1

## 0.2.0

### Minor Changes

- [#5](https://github.com/eigeninteractive/eigen-server/pull/5) [`ddd4893`](https://github.com/eigeninteractive/eigen-server/commit/ddd4893a7e45c743345adbd56dbc6870f6dbb042) Thanks [@seenu-k](https://github.com/seenu-k)! - Clean up public API surface

### Patch Changes

- Updated dependencies [[`ddd4893`](https://github.com/eigeninteractive/eigen-server/commit/ddd4893a7e45c743345adbd56dbc6870f6dbb042)]:
  - @eigeninteractive/kernel@0.2.0
  - @eigeninteractive/rules@0.2.0

## 0.1.0

Initial release. The Eigen engine, a server-authoritative engine for turn-based
multiplayer games on Cloudflare Workers.

Documentation: <https://eigeninteractive.com>

Subsequent entries in this file are generated by
[changesets](https://github.com/changesets/changesets); do not edit them by hand.
