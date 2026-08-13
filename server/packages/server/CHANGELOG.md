# @eigeninteractive/server

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
