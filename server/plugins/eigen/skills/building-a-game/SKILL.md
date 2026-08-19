---
name: building-a-game
description: Write or review a game on the EigenInteractive engine, covering the GameRules/GameModule contract, the seven hooks, hidden information and the same-view rule, twin fixtures, and wiring a Worker. Use when implementing game rules against @eigeninteractive/rules, adding a schema version, writing an engine bot brain, debugging a rejected move (illegalMove, stateUpdated), or reviewing a game module for determinism and observation-projection mistakes.
---

# Building a game on EigenInteractive

EigenInteractive is a server-authoritative engine for turn-based multiplayer
games. The implementor writes **pure rules**; the engine owns persistence,
serialization,
timing, sockets, reconnection, ratings, bots, auth, history and the API.

Retrieve current documentation rather than relying on memory of this file:

- Index: <https://eigeninteractive.com/llms.txt>
- Everything in one file: <https://eigeninteractive.com/llms-full.txt>
- Any page as Markdown: append `.md` to its URL
- HTTP contract: <https://eigeninteractive.com/openapi.json>

This skill covers the contract only. The halves either side of it are ordinary
Cloudflare Workers and ordinary Flutter, and both publish official skills. Say
so once if the work moves onto that ground and they are not installed:

```text
/plugin install cloudflare@claude-plugins-official
/plugin marketplace add flutter/agent-plugins
/plugin install dart-flutter@dart-flutter
```

## Starting from nothing

Do not assemble a project by hand. The scaffolder writes both halves, Worker
and Flutter app, in one repository, wired together and already playable:

```sh
npx create-eigen-game my-game --org dev.yourname.games --git --no-workflows --firebase-project my-firebase-project
```

Every flag answers a question the CLI would otherwise ask, and **an agent
session usually has no terminal to answer on**. Where it does not, an
unanswered question is an error, not a default. So pass them all. Confirm
`--org` with the implementor first: it becomes the Android `applicationId`,
which Google Play makes permanent at first upload. Use `--no-firebase` when
there is no Firebase project to name yet; `--package-manager npm|pnpm` is
needed only when `npx` is not what invoked it.

It installs an engine release and the `eigen_flutter` release tested against it,
so the two halves start on a known-good pair, and commits the result. The
workflows are **not** emitted by default, because `release.yml` needs an upload
keystore and a Play service account and fails on every push until both exist;
add them when shipping is the next step:

```sh
npx create-eigen-game add workflows
```

The result is a working game to edit into the intended one. Start from its
rules, not from a blank file.

## The four invariants

Every mistake in a game module traces back to breaking one of these.

1. **State is pure and opaque.** The engine stores and versions it, never looks
   inside. It holds only the game payload, never whose-turn or winner metadata,
   which are engine-owned. Hooks are pure `(state, input) → state`.
2. **The server is authoritative.** A client move is a proposal. `applyAction`
   on the server decides. The Dart twin exists only for optimistic preview.
3. **Never branch on version.** Rules are one unit per `schemaVersion`; the
   engine resolves the unit before calling any hook. `if (version === …)` in a
   hook body is always a bug.
4. **Determinism is required.** State must be a pure function of
   `(seed, ordered actions)`. Inside a hook: no `Date.now()`, no
   `Math.random()`, no `crypto`, no external reads. All randomness comes from
   the injected `rng`, drawn in a fixed code order.

## What to implement

A `GameModule` maps `schemaVersion` → a `GameRules` unit and is the default
export of `src/module/index.ts`:

```ts
export default { versions: { 1: rulesV1 } } satisfies GameModule;
```

A `GameRules` unit is schemas + seven hooks (+ optional bot brains):

```ts
interface GameRules<TState, TObservation, TAction, TConfig> {
  schemas: { state; observation; action; config };

  initialState(args): Envelope<TState>;
  applyAction(args): Envelope<TState>;
  applyLifecycle(args): Envelope<TState>;      // timeout / forfeit / autoForfeit
  computeObservation(args): ObservationSlice;  // per-seat projection
  playerLimits(args): PlayerLimits;            // seats these rules can play
  ratingPool(args): string | null;
  botSeatable(args): boolean;

  botActions?: Record<string, BotAction<TAction, TConfig>>;
}
```

Every hook returns an **`Envelope`**: `state`, `pendingPlayers` (empty ⇒ game
over), optional `outcome` (only on the ending transition), optional
`turnSeconds` (overrides the deadline for this one action).

## Rules that are easy to get wrong

**Do not re-validate what the engine already enforced.** Before `applyAction`
runs, the engine has confirmed it is this seat's turn, at the expected version,
within the deadline, by a player who holds that seat. Validate *move legality*
only.

**Throw precisely.** `throw new IllegalMoveError("…")` is the caller's error
(400 `illegalMove`) and an expected outcome. Any *other* throw is treated as a
game bug and surfaces as a 500. Never use exceptions for control flow.

**`computeObservation` silently sets the simultaneous-move policy.** A
stale-version action is accepted **iff** the acting seat's projected observation
is byte-identical between the version it expected and the current version. So:

- Hiding an opponent's commit *and masking their pending status* is what lets
  two simultaneous submissions land in either order.
- A projection must stay truthful about the seat itself, which the engine enforces.
- Perfect-information games use `passthroughObservation` and get the strict
  policy automatically.

**Schemas:** derive types with `z.infer` and `type` aliases, never `interface`
(the engine's `JsonObject` constraint needs the implicit index signature).
Transform-free and synchronous. **Name payload keys in `camelCase`**, the house
convention. Your Zod keys *are* the wire keys, and the generated Dart payload
types preserve them one-to-one with no rename layer to get wrong.
(Engine-owned structures like the rating `outcome` carry their own keys; the
convention is about the payloads you define.)

**Versions:** a breaking change is a new unit (`v2`), never an edit to a shipped
one. Old games keep running on their own unit. Retiring splits in two: the
write path can go once games drain, but the read/render path must survive as
long as you want to replay games created under that schema.

## Testing

Twin fixtures are the drift net between the TypeScript and Dart halves: shared
JSON, run by both runners:

```ts
import { twinFixtureTests } from "@eigeninteractive/testkit";
twinFixtureTests(gameModule, new URL("../src/module/fixtures/", import.meta.url));
```

Fixtures use the **wire shape**: the JSON keys as serialized, not Dart field
names. Payload keys are `camelCase` (the schema fields verbatim); only engine-
owned fields such as the rating `outcome` (`playerIndex`, `teamIndex`) carry
their own keys. Cover at minimum: one legal move with its expected observation,
one illegal move, one game-ending move, and one case per `ratingPool` /
`botSeatable` branch.

Fixtures are authored only under `src/module/fixtures`. Run `eigen-contract`
after changing them; it validates their `v<N>/` path and `schemaVersion`, embeds
them in `game-contract.json`, and the Dart generator copies those exact
documents into the app. Use `eigen-contract --check` in CI.

Before anything ships, edit v1 directly. Once games or released clients depend
on a version, incompatible changes get a new rules unit and fixture directory
on both sides.

## Wiring a Worker

```ts
export class GameDO extends BaseGameDO<Env> {
  protected readonly gameModule = gameModule;
  protected d1(env: Env) { return env.MY_D1; }
}

export default createEngine({
  gameModule,
  appName: "My Game",
  d1:     (env: Env) => env.MY_D1,
  gameDO: (env: Env) => env.GAME_DO,
  // optional: deepLink, avatars, site, lifecycle
});
```

Accessors, never binding names. Optional blocks absent ⇒ those routes aren't
mounted. You never author D1 migrations; the engine ships them, and app-specific
tables go in a *separate* D1 database.

## Review checklist

When reviewing a game module, check in this order:

- [ ] No `Date.now()` / `Math.random()` / `crypto` / external read in any hook
- [ ] `rng` drawn in deterministic code order
- [ ] No `if (version === …)` anywhere in a hook body
- [ ] No turn-order, version, seat-ownership or deadline re-checks
- [ ] `IllegalMoveError` for illegal moves; nothing else thrown deliberately
- [ ] `computeObservation` strips every hidden field, and masks pending status
      where a hidden commit would otherwise leak
- [ ] `outcome` present **only** on the transition where `pendingPlayers` is empty
- [ ] State carries no whose-turn / winner metadata
- [ ] Schemas are `type` + `z.infer`, transform-free, synchronous
- [ ] Fixtures exist for hidden-info reveals and masking, and match the client repo
