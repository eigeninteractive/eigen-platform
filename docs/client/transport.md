---
sidebar_position: 2
title: Session, requests & the frame stream
description: Auth, the generated API client, the error model, and how one WebSocket per game reconciles without ever guessing.
---

# Session, requests & errors

- **Auth is Firebase.** Google and Anonymous sign-in are implemented;
  `linkWithCredential` upgrades a guest to a permanent account, preserving the
  uid, so every game, rating and friendship carries over with no data migration.
  Every request sends the Firebase ID token as `Authorization: Bearer <token>`;
  WebSocket upgrades send it as `?token=` (browsers can't set headers on an
  upgrade). Tokens refresh on the Firebase SDK's schedule; the client attaches
  the current one per request.

  :::note Apple Sign-In is scoped but not wired

  There is no `sign_in_with_apple` dependency yet.

  :::

- **The API client is generated** from the vendored `openapi.json`. Client routes
  live under `/api/engine/*`; the configured base URL is an **origin only**
  (scheme + host, no path, no trailing slash) because every generated route
  already carries its own prefix. The one non-generated piece is the frame
  stream, which is hand-written.
- **Errors** are `{ error, code? }`, and `code` is a **generated enum**
  (`ErrorCode`), so `humanize` switches over it exhaustively — adding a code
  server-side fails the client build until copy exists. `engineCall` converts a
  server-reported failure into `EngineException`; a failure with *no* response
  propagates as the underlying `DioException`, because "the server said no" and
  "the outcome is unknown" mean different things to a state-changing command.
- **Wire enums are closed sets.** Generated enums carry no `unknown` sentinel and
  parse strictly, so adding a member to any of them — `GameStatus`, `ErrorCode`,
  `GameAccess`, seat type — is a breaking change needing a schema-version bump.
  `test/shared/api_contract_test.dart` pins the sets so drift fails loudly. See
  [Compatibility & versioning](./shipping.md#compatibility--versioning) for why
  refusing to build beats degrading gracefully here.
- **Lists page by keyset cursor**, not offset: the cursor is the previous page's
  last sort value. These lists change while they are being read, and an offset
  would show the same row twice after a single insert.
- **Avatar URLs may be relative.** With the default worker-served setup the
  server returns `/avatars/{uid}?v=<ts>`; with a public bucket domain it returns
  an absolute URL. `resolveAvatarUrl` resolves either against the API origin, and
  every seat rendering routes through `PlayerAvatar` so that resolution lives in
  one place. The `?v=` cache-buster means `cached_network_image` refreshes on
  re-upload with no manual invalidation.

## The frame stream

A game has **one WebSocket for its whole lifetime**
(`/api/engine/games/{id}/socket`), opened before the game starts. Over it the
client receives:

- **Roster snapshots** pre-game — unversioned and idempotent, pushed on every
  lobby change. A reconnect just gets the current one.
- **A `sync`** on a mid-game open — `{ version }`, the newest committed version
  at the moment the socket opened. From v0 the roster is frozen, so this is what
  moves; it is what lets a client reconcile in one step instead of guessing.
- **Versioned frames** from v0 — each is one seat's projected observation at one
  state version (`{ version, data, pending_players, deadline, player_times,
  outcomes?, ratings? }`).

Frames are **strictly serial with no gaps**. The client tracks the last version
it holds and reconciles against the `sync`, which costs a request only when it
has to:

- **Nothing held yet** (a cold open, mid-game) — fetch just that one version. A
  cold load snaps to the present rather than replaying the game.
- **Already current** — no request at all. This is the common reconnect on a
  flaky connection, and is why the server states its version rather than leaving
  the client to poll.
- **Behind** — fetch exactly the missing span via
  **`GET /games/{id}/frames?from=&to=`** and emit it in order *before* the frame
  that revealed the gap, so the game animates through every transition it missed.

The same range-fetch endpoint serves finished-game **replay** (the server
re-projects from its immutable log) — replay is just the whole range rather than
a missing slice. Reconnection is therefore always sound: reconcile against the
server's stated version, never guess.

A command's own frame also rides its HTTP response (`CommandAccepted.frame`) and
is fed into the same version-deduped pipeline, so whichever copy arrives second
is dropped. That matters less for latency than it looks — the socket terminates
at the same Durable Object and is written first — but it is what makes the
socket-less paths work: a freshly created solo game has no socket yet, and a
move submitted while the socket is mid-reconnect would otherwise render nothing.
