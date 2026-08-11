---
"@eigeninteractive/server": minor
---

The socket now carries one message, a complete per-seat **session snapshot**, and every accepted command answers with the same value. `roster`, `sync` and `frame` as separate message kinds are gone.

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
