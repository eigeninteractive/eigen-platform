---
sidebar_position: 11
title: Changing a shipped game
description: "What to do when rules change after players use them: publish an immutable new version and retain every earlier version while games exist."
---

# Changing a shipped game

Once players are using your game, the two halves **stop moving together**. A
shipped app binary keeps calling a newer backend for weeks, and a daily-timed
game can outlive several releases. So every change has to answer one question:

> What does an old client, or an in-flight game started under the old rules,
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
drain. Neither side branches on version; the engine resolves it once and calls
the right unit.

Compatible tweaks, a bug fix that changes neither stored shapes nor recorded
behaviour, can edit the unit in place. Update the fixtures alongside.

Before the first release or persisted shared environment, v1 is not frozen:
edit it directly, regenerate `game-contract.json` and the Dart payload library,
and let both fixture suites expose the required client changes. Creating v2 for
every development edit only preserves history that nobody consumes.

## Retain every published version

Eigen initially retains every finished game and re-projects its observations
through the rules version it was created with. Therefore every published rules
unit remains installed on both sides while a retained game may reference it:

- register versions contiguously from 1 (`{1, 2, 3}`);
- never edit the meaning of a published entry; and
- never remove an entry merely because its active games have drained.

Removing old code becomes valid only after a future deletion/retention policy
proves that no stored game references it. That policy does not exist yet.

## How an old client is protected

Two gates, deliberately redundant:

- **The client** supports every positive version through
  `GameModule.latestSchemaVersion` and raises
  `UnsupportedGameSchemaException` for a newer game rather than mis-parsing it.
- **The server** refuses the join, so an unsupported game is rejected *before* a
  seat is created, not only when the screen later fails to render. The lobby
  additionally greys out the Join button as immediate feedback.

Join sends that one latest version. Because versions are never skipped or
removed, `game.schemaVersion <= client.latestSchemaVersion` is the complete
compatibility test.

## Creating: the newest version, and only that one

New games are created at the **server's** highest shipped version. The client
sends its latest version as an assertion and creation requires exact equality.
A client behind receives `clientUpdateRequired`, which the app presents as an
update blocker. A client ahead receives `serverUpdateRequired`, which identifies
a deployment mismatch instead of incorrectly asking the player to update.

There is no capabilities endpoint or create-version override. Deploy the server
before releasing a client that creates the new version; if a release must be
rolled back, roll back both rules implementations without deleting the published
registry entry.

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
| Alters the observation / action / config shape, or changes recorded behavior | **Breaking**: append a `GameRules` unit on both sides and add fixtures |
| Purely additive (a new optional field) | Nullable or defaulted, **no bump** |
| Server-only rule logic, same shapes | Change `applyAction` only, **no bump** |
| A new wire enum value | **Breaking**: bump, and ship both sides together |
| A persisted client model's shape changed | Bump that provider's `destroyKey`; a stale cached row must be a cache *miss*, never a crash |

Three version axes move independently, and it helps to name which one you are
touching:

| Axis | Granularity | Where it lives |
|---|---|---|
| Package version | per release | `pubspec.yaml` / `package.json`, git tag |
| **Game schema version** | per game-type revision | `schemaVersion` on the game row, which selects the unit on both sides |
| Cache schema version | per persisted model | each provider's `destroyKey` |
