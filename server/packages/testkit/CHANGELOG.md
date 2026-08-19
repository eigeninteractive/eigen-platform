# @eigeninteractive/testkit

## 0.5.2

### Patch Changes

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

- [`25b9239`](https://github.com/eigeninteractive/eigen-platform/commit/25b923910be86edbfd66a0cd7dbf8e3955fc3f67) Thanks [@seenu-k](https://github.com/seenu-k)! - Enforce the portable schema profile when emitting a game contract.
  
  `@eigeninteractive/rules` exports `portableSchemaViolations` / `assertPortableSchema`,
  and `eigen-contract` now runs them on every emitted payload. A schema outside the
  profile fails the build with a JSON pointer per violation instead of emitting a
  document the Dart generator cannot honour.
  
  **This was not a style rule.** Nothing checked before, and the RPS example violated
  the profile in 17 places — one of them a real defect. `z.tuple([Move, Move])` emits
  `{"type": "array", "prefixItems": [Move, Move]}`, and `prefixItems` constrains only
  the listed positions without bounding the length, so the emitted contract validated
  a three-element array that Zod itself rejects. A Dart validator generated from it
  would have been weaker than the server. Use `z.array(x).length(n)`, which emits
  `items` with `minItems`/`maxItems`.
  
  **Breaking for game authors** whose schemas use `z.tuple` or a `z.union` of
  literals: the contract build now fails and names the pointer. `.nullable()` is
  unaffected — `anyOf: [T, {"type": "null"}]` is the one `anyOf` shape the profile
  accepts, since it is what every library emits for nullability and is equivalent to
  the `[T, "null"]` type union the profile already allowed.
  
  **Contracts now emit the output direction of all four schemas.** Action used the
  input direction, and Zod omits `additionalProperties: false` there — so the one
  payload clients submit was described as open. Committed `game-contract.json` files
  need regenerating; schemas are required to be transform-free, so nothing else about
  them changes.
  
  **Fixed:** the emitter sorted object keys with `localeCompare` while
  `tool/check-contracts.mjs` sorted by code point, as RFC 8785 requires. Generated
  JSON Schema is full of capitalized `$defs` names, so the two orders genuinely
  disagreed — `Move` before `additionalProperties` under one rule and after it under
  the other. Any digest computed over one would never have matched a document written
  by the other. Both now sort by code point.
  
  **Removed:** `contracts/protocol/v1/`. Four hand-written wire schemas that nothing
  generated from or validated against, all four drifted from the shipped protocol.
  The wire is the Zod schemas published as generated OpenAPI 3.1, which is JSON
  Schema; `Session` and `Frame` are in that document, so the socket payload was
  already normative.

### Patch Changes

- Updated dependencies [[`517b06b`](https://github.com/eigeninteractive/eigen-platform/commit/517b06badf929f2ee8beb0a8670ac051acc2987a), [`6075b87`](https://github.com/eigeninteractive/eigen-platform/commit/6075b87bc44a2ca536c989531590a169b112b081), [`d87de0e`](https://github.com/eigeninteractive/eigen-platform/commit/d87de0eb19b0bfed248ea43f24ceb9fc62332db0), [`25b9239`](https://github.com/eigeninteractive/eigen-platform/commit/25b923910be86edbfd66a0cd7dbf8e3955fc3f67)]:
  - @eigeninteractive/kernel@0.5.0
  - @eigeninteractive/rules@0.5.0

## 0.4.1

### Patch Changes

- [#2](https://github.com/eigeninteractive/eigen-platform/pull/2) [`55f0ac8`](https://github.com/eigeninteractive/eigen-platform/commit/55f0ac878338a0141ba4e7f2ddb702f2a1a2ab75) Thanks [@seenu-k](https://github.com/seenu-k)! - Point package source, issue, changelog, and release metadata at the unified
  `eigen-platform` repository. Runtime behavior is unchanged.
- Updated dependencies [[`55f0ac8`](https://github.com/eigeninteractive/eigen-platform/commit/55f0ac878338a0141ba4e7f2ddb702f2a1a2ab75)]:
  - @eigeninteractive/kernel@0.4.1
  - @eigeninteractive/rules@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies []:
  - @eigeninteractive/kernel@0.4.0
  - @eigeninteractive/rules@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies []:
  - @eigeninteractive/kernel@0.3.1
  - @eigeninteractive/rules@0.3.1

## 0.3.0

### Patch Changes

- [#51](https://github.com/eigeninteractive/eigen-server/pull/51) [`e140da5`](https://github.com/eigeninteractive/eigen-server/commit/e140da5ee5f916a4a763b17c9dc338cb836484b6) Thanks [@seenu-k](https://github.com/seenu-k)! - New `eigen-inspect` command, for reading a Worker's local `.wrangler` state from the terminal while you develop a game.
  
  A game's truth is split across two stores on purpose. D1 is the index: discovery, history, ratings, identity. The game's own Durable Object is the session: the authoritative status, the roster, and the append-only transition log. That split is what makes the engine's read paths cheap, and it is also why a question like "the lobby filled, so why is nothing happening" cannot be answered by looking at one table. The D1 `games` row is a fire-and-forget display mirror, so it can lag; the DO is the only authority.
  
  `eigen-inspect game <id|code|prefix>` joins both, decodes every JSON column, prints the transition log as a timeline, and ends with the sentence you actually wanted:
  
  ```
  Diagnosis     ready and not started: 2/2 seats filled. Nothing happens until the
                CREATOR calls POST /api/engine/games/{id}/start. A start is explicit
                and creator-only; filling the lobby does not start a game.
  ```
  
  When the two stores disagree it says so as `Mirror drift`, naming the DO as authoritative, so a lost mirror write reads as a lost mirror write rather than as a mystery. A finished game with surviving `outbox` rows is called out the same way, since that means the D1 finish apply has not landed and ratings are not published.
  
  The other commands are `games` (the index), `do` (every local Durable Object mapped back to its game id, which the hashed filename cannot tell you), `players`, `tables`, and `sql` for anything unmodelled. `--game <ref>` points `tables` and `sql` at one game's Durable Object instead of D1; `--json` emits everything for a script or an agent.
  
  This complements rather than replaces Wrangler's own local browser, which is `e` in `wrangler dev` (or `/cdn-cgi/explorer`) and is the better tool for generic table browsing. `eigen-inspect` is the one that knows what a game is, and it needs no dev server, browser, or account.
  
  The reader is also exported as a library at `@eigeninteractive/testkit/local-state`, so a test or a script can assert against local state directly:
  
  ```ts
  import { LocalStore } from "@eigeninteractive/testkit/local-state";
  
  const store = LocalStore.open();
  const game = store.game("ABC123");
  expect(game?.meta?.status).toBe("active");
  store.close();
  ```
  
  Every database is opened read-only, so all of this is safe to run against a live `wrangler dev`. It reads them through Node's built-in `node:sqlite`, so it adds no dependency, needs no native build, and nothing new reaches your Worker's runtime dependencies. It needs Node 24, which the engine already requires.
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

- Updated dependencies []:
  - @eigeninteractive/kernel@0.2.4
  - @eigeninteractive/rules@0.2.4

## 0.2.3

### Patch Changes

- Updated dependencies []:
  - @eigeninteractive/kernel@0.2.3
  - @eigeninteractive/rules@0.2.3

## 0.2.2

### Patch Changes

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
