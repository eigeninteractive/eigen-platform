---
sidebar_position: 13
title: The client transport
description: Auth, the generated API client, the error model, how seat identity is resolved before render, and how one WebSocket per game reconciles without ever guessing.
---

# The client transport

How the app talks to the Worker: the session, the request layer, the frame
stream, and how a seat becomes a name and a face before the game screen renders.
None of it is game code — a game never opens a socket or resolves an identity.

## Session, requests & errors

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

- **The API client is generated** from `openapi.json` — in the engine repo, and
  published to pub.dev as `eigen_api`, so the client repo depends on a version
  rather than holding a copy of the spec. Client routes
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
  [Changing a shipped game](../build-a-game/versions.md) for why
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

## Player identity

The transport resolves every seat identity **before** the game screen renders, so
game code gets non-nullable identity — no null checks, no loading states.

- Identity comes from `GET /api/engine/players?ids=` (batch, public identity:
  username, display name, avatar, anonymity — never email), warmed by a
  client-side persisted cache. This is the decided alternative to denormalizing
  identity onto game rows.
- For a **finished game whose participant was deleted**, the server anonymizes the
  seat (the roster keeps the seat, id nulled); the client renders a **synthetic
  identity** ("Deleted User", `player_{index}`) and sets `GamePlayer.isDeleted`.
  **`isDeleted` is the guard** — never inspect the synthetic `Player.id`, which
  exists only to give the seat a distinct widget key and is not a real user id.
- **Game identity vs social identity.** Seat identity covers humans *and* bots and
  is the right tool in game screens and lobby cards. Social features (friend
  search, requests) are human-only and never surface bots. Don't branch on player
  type to decide whether to show identity — show it uniformly; use the seat's
  `type` only where game rules must distinguish a bot seat.
- **The viewer case.** A non-participant replaying a public finished game has no
  seat — `MySeat` is a sealed `Seated(index) | Viewer`, so viewer checks simply
  never match "is it my turn". Read `mySeat.indexOrNull` where a null is the right
  answer for a viewer.
- Per-game **roles** (host, team, dealer) are not a transport concept — they live
  in the game's observation JSON, shaped by `computeObservation`.

**Shared identity widgets** (`lib/shared/widgets/`, exported from the barrel where
a game needs them):

| Widget | Use |
|---|---|
| `PlayerAvatar` | One seat's avatar — cached network image, initials/person fallback, optional active border, relative-URL resolution. `onTap` optional; leave it unset inside a `ListTile` (the tile's own ink covers the row). |
| `OverlappingAvatars` | The overlapped row used on game/lobby cards. |
| `PlayerProfileSheet` | Modal profile — identity, ratings across pools, friendship actions (humans only). Guard with `isDeleted` before opening. |
| `EmptyStateView` | The illustrated empty state shared by all list screens (home, lobby, history, friends, requests). |
| `StatusBanner` | The slim full-width banner primitive behind the offline / reconnecting banners. |
