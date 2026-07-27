---
sidebar_position: 10
title: Changing a shipped game
description: What to do when the rules change after players are using them — a new unit on both sides, why draining and replay retire at different times, and the checklist.
---

# Changing a shipped game

Once players are using your game, the two halves **stop moving together**. A
shipped app binary keeps calling a newer backend for weeks, and a daily-timed
game can outlive several releases. So every change has to answer one question:

> What does an old client — and an in-flight game started under the old rules —
> do when it meets the new code?

## The mechanism: a new unit, not an edit

When rules or payload shapes change **incompatibly**, never edit a shipped unit's
semantics. That would break games and replays already running under it. Instead:

1. Copy `v1.ts` to `v2.ts`, importing whatever did not change.
2. Make the change in `v2`.
3. Register it: `versions: { 1: rulesV1, 2: rulesV2 }`.
4. **Do the same on the Dart side**, under the same key.

Every game row is stamped with the `schemaVersion` it was created under, and
that is honoured for its whole life. New games are created at the newest version
your build ships; existing games keep running against their own unit until they
drain. Neither side branches on version — the engine resolves it once and calls
the right unit.

Compatible tweaks — a bug fix that changes neither stored shapes nor recorded
behaviour — can edit the unit in place. Update the fixtures alongside.

Before the first release or persisted shared environment, v1 is not frozen:
edit it directly, regenerate `game-contract.json` and the Dart payload library,
and let both fixture suites expose the required client changes. Creating v2 for
every development edit only preserves history that nobody consumes.

## Two gates, and one is longer than you think

Retiring an old unit splits into two lifetimes, and conflating them is how
replays break:

- **The write path** — anything that advances state (`applyAction`,
  `applyLifecycle`) — can go once active games at that version have drained.
- **The read path** — `computeObservation` on the server, `parseObservation` and
  rendering on the client — must survive **as long as you want to replay games
  created under that schema.** Replay re-projects historic transitions at the
  game's own version, so this is not bounded by draining at all.

> **Draining gates the write path; replay gates the read path, and replay
> outlives draining.**

Only delete a `versions` entry once both are satisfied.

## How an old client is protected

Two gates, deliberately redundant:

- **The client** looks the game's version up in `GameModule.versions` and raises
  `UnsupportedGameSchemaException` rather than mis-parsing with old code.
  `supportsSchema` is key membership, not `<= latest`, so a retired old version
  is correctly unsupported.
- **The server** refuses the join, so an unsupported game is rejected *before* a
  seat is created — not only when the screen later fails to render. The lobby
  additionally greys out the Join button as immediate feedback.

## What counts as breaking

**Adding a member to a game payload enum is breaking**, even though it looks
purely additive. The app cannot infer the legality or rendering of an unknown
move, so put it in a new game `schemaVersion`.

Engine API enums have a separate read-side `unknownDefaultOpenApi` fallback.
That protects installed apps from additive transport vocabulary while nudging
an update; it is never serialized back.

Within a version, additive change is still fine: new fields must be nullable or
carry a default, never `required`. Changing a field's type or meaning, or
removing it, is breaking.

## The checklist

| The change | What it needs |
|---|---|
| Alters the observation / action / config shape, or makes in-flight games inconsistent | **Breaking** — new `GameRules` unit on both sides, new fixtures, drain before retiring the write path |
| Purely additive (a new optional field) | Nullable or defaulted, **no bump** |
| Server-only rule logic, same shapes | Change `applyAction` only, **no bump** |
| A new wire enum value | **Breaking** — bump, and ship both sides together |
| A persisted client model's shape changed | Bump that provider's `destroyKey` — a stale cached row must be a cache *miss*, never a crash |

Three version axes move independently, and it helps to name which one you are
touching:

| Axis | Granularity | Where it lives |
|---|---|---|
| Package version | per release | `pubspec.yaml` / `package.json`, git tag |
| **Game schema version** | per game-type revision | `schemaVersion` on the game row — selects the unit on both sides |
| Cache schema version | per persisted model | each provider's `destroyKey` |
