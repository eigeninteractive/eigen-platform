---
name: building-a-game
description: Write or review a game on the Eigen engine — the GameRules/GameModule contract, the six hooks, hidden information and the same-view rule, twin fixtures, and wiring a Worker. Use when implementing game rules against @eigeninteractive/rules, adding a schema version, writing an engine bot brain, debugging a rejected move (illegal_move, board_updated, state_updated), or reviewing a game module for determinism and observation-projection mistakes.
---

# Building a game on Eigen

Eigen is a server-authoritative engine for turn-based multiplayer games. The
implementor writes **pure rules**; the engine owns persistence, serialization,
timing, sockets, reconnection, ratings, bots, auth, history and the API.

Retrieve current documentation rather than relying on memory of this file:

- Index: <https://eigeninteractive.com/llms.txt>
- Everything in one file: <https://eigeninteractive.com/llms-full.txt>
- Any page as Markdown: append `.md` to its URL
- HTTP contract: <https://eigeninteractive.com/openapi.json>

## The four invariants

Every mistake in a game module traces back to breaking one of these.

1. **State is pure and opaque.** The engine stores and versions it, never looks
   inside. It holds only the game payload — never whose-turn or winner metadata,
   which are engine-owned. Hooks are pure `(state, input) → state`.
2. **The server is authoritative.** A client move is a proposal. `applyAction`
   on the server decides. The Dart twin exists only for optimistic preview.
3. **Never branch on version.** Rules are one unit per `schema_version`; the
   engine resolves the unit before calling any hook. `if (version === …)` in a
   hook body is always a bug.
4. **Determinism is required.** State must be a pure function of
   `(seed, ordered actions)`. Inside a hook: no `Date.now()`, no
   `Math.random()`, no `crypto`, no external reads. All randomness comes from
   the injected `rng`, drawn in a fixed code order.

## What to implement

A `GameModule` maps `schema_version` → a `GameRules` unit:

```ts
export const gameModule: GameModule = { versions: { 1: rulesV1 } };
```

A `GameRules` unit is schemas + six hooks (+ optional bot brains):

```ts
interface GameRules<TState, TAction, TConfig> {
  schemas: { state; action; config };          // Standard Schema each

  initialState(args): Envelope<TState>;
  applyAction(args): Envelope<TState>;
  applyLifecycle(args): Envelope<TState>;      // timeout / forfeit / auto_forfeit
  computeObservation(args): ObservationSlice;  // per-seat projection
  ratingPool(args): string | null;
  botSeatable(args): boolean;

  botActions?: Record<string, BotAction<TAction, TConfig>>;
}
```

Every hook returns an **`Envelope`**: `state`, `pending_players` (empty ⇒ game
over), optional `outcome` (only on the ending transition), optional
`turn_seconds` (overrides the deadline for this one action).

## Rules that are easy to get wrong

**Do not re-validate what the engine already enforced.** Before `applyAction`
runs, the engine has confirmed it is this seat's turn, at the expected version,
within the deadline, by a player who holds that seat. Validate *move legality*
only.

**Throw precisely.** `throw new IllegalMoveError("…")` is the caller's error
(400 `illegal_move`) and an expected outcome. Any *other* throw is treated as a
game bug and surfaces as a 500. Never use exceptions for control flow.

**`computeObservation` silently sets the simultaneous-move policy.** A
stale-version action is accepted **iff** the acting seat's projected observation
is byte-identical between the version it expected and the current version. So:

- Hiding an opponent's commit *and masking their pending status* is what lets
  two simultaneous submissions land in either order.
- A projection must stay truthful about the seat itself — the engine enforces it.
- Perfect-information games use `passthroughObservation` and get the strict
  policy automatically.

**Schemas:** derive types with `z.infer` and `type` aliases, never `interface`
(the engine's `JsonObject` constraint needs the implicit index signature).
Transform-free and synchronous. **Name payload keys in `camelCase`** — the house
convention. Your zod keys *are* the wire keys, and the Dart twin then sets
`field_rename: none`, so the two codecs match one-to-one with no rename layer to
get wrong. (Engine-owned structures like the rating `outcome` carry their own
keys; the convention is about the payloads you define.)

**Versions:** a breaking change is a new unit (`v2`), never an edit to a shipped
one. Old games keep running on their own unit. Retiring splits in two — the
write path can go once games drain, but the read/render path must survive as
long as you want to replay games created under that schema.

## Testing

Twin fixtures are the drift net between the TypeScript and Dart halves — shared
JSON, run by both runners:

```ts
import { twinFixtureTests } from "@eigeninteractive/testkit";
twinFixtureTests(gameModule, new URL("../../src/rules/fixtures/", import.meta.url));
```

Fixtures use the **wire shape** — the JSON keys as serialized, not Dart field
names. Payload keys are `camelCase` (the schema fields verbatim); only engine-
owned fields such as the rating `outcome` (`player_index`, `team_index`) carry
their own keys. Cover at minimum: one legal move with its expected observation,
one illegal move, one game-ending move, and one case per `ratingPool` /
`botSeatable` branch.

**A rules change is a two-repo change.** The fixture JSON is duplicated in the
client repo with no sharing mechanism, so editing it here leaves the other repo
green on a stale copy. Copy the same `v<N>/*.json` into both in the same change.

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
mounted. You never author D1 migrations — the engine ships them; app-specific
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
- [ ] `outcome` present **only** on the transition where `pending_players` is empty
- [ ] State carries no whose-turn / winner metadata
- [ ] Schemas are `type` + `z.infer`, transform-free, synchronous
- [ ] Fixtures exist for hidden-info reveals and masking, and match the client repo
