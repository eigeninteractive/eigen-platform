---
sidebar_position: 13
title: The client transport
description: Auth, the generated API client, the error model, how seat identity is resolved before render, and how one WebSocket per game reconciles without ever guessing.
---

# The client transport

How the app talks to the Worker: the session, the request layer, the frame
stream, and how a seat becomes a name and a face before the game screen renders.
None of it is game code; a game never opens a socket or resolves an identity.

## Session, requests & errors

- **Auth is Firebase.** Google and Anonymous sign-in are implemented. Native
  uses the Google ID token with `signInWithCredential`; web lets Firebase own
  the browser popup with `signInWithPopup`. `linkWithCredential` on native and
  `linkWithPopup` on web upgrade a guest in place, preserving the uid, so every
  game, rating and friendship carries over with no data migration.
  Every ordinary request sends the Firebase ID token as `Authorization: Bearer
  <token>`. Before each WebSocket connection, the client uses that authenticated
  HTTPS channel to mint a signed, game-scoped ticket valid for 60 seconds and
  sends only that narrow credential as `?ticket=` (browsers cannot set headers
  on an upgrade). Firebase tokens refresh on the SDK's schedule and never appear
  in a socket URL.

  :::note[Apple Sign-In is scoped but not wired]

  There is no `sign_in_with_apple` dependency yet.

  :::

- **The API client is generated** from `openapi.json`, in the engine repo, and
  published to pub.dev as `eigen_api`, so the client repo depends on a version
  rather than holding a copy of the spec. Client routes
  live under `/api/engine/*`; the configured base URL is an **origin only**
  (scheme + host, no path, no trailing slash) because every generated route
  already carries its own prefix. The one non-generated piece is the frame
  stream, which is hand-written.
- **Errors** are `{ error, code? }`, and `code` is a **generated enum**
  (`ErrorCode`), so `humanize` switches over it exhaustively, and adding a code
  server-side fails the client build until copy exists. `engineCall` converts a
  server-reported failure into `EngineException`; a failure with *no* response
  propagates as the underlying `DioException`, because "the server said no" and
  "the outcome is unknown" mean different things to a state-changing command.
- **Engine wire enums are forward-readable.** Generated enums map a member an
  older app does not know to `unknownDefaultOpenApi`, so decoding succeeds and
  the app can request an update. The fallback is read-side only and is never
  sent back.
- **Lists page by keyset cursor**, not offset. These lists change while they are
  being read, and an offset would show the same row twice after a single insert.
  The cursor is opaque: a paged response carries a `nextCursor`, and a client
  passes it back untouched rather than deriving it from the last row it holds.
  It is null exactly when the list is exhausted, so "is there another page" is
  an answer rather than something inferred from a short page. Composing a cursor
  is not supported; a malformed one is refused with `invalidCursor`.
- **Avatar URLs may be relative.** With the default worker-served setup the
  server returns `/avatars/{uid}?v=<ts>`; with a public bucket domain it returns
  an absolute URL. `resolveAvatarUrl` resolves either against the API origin, and
  every seat rendering routes through `PlayerAvatar` so that resolution lives in
  one place. The `?v=` cache-buster means `cached_network_image` refreshes on
  re-upload with no manual invalidation.

## The session stream

A game has **one WebSocket for its whole lifetime**
(`/api/engine/games/{id}/socket`), opened before the game starts, and it carries
exactly one kind of message: a **session snapshot**, the complete live truth
about the game as the receiving seat sees it. It is a server-to-client stream;
commands use HTTP, and sending an application message on the socket closes it
with policy code `1008`.

```jsonc
{
  "type": "session",
  "seq": 7,                    // monotonic per game, incremented by every commit
  "gameId": "...", "shortCode": "ABC123", "access": "private",
  "schemaVersion": 1, "config": { ... },
  "turnSeconds": null, "budgetSeconds": null, "incrementSeconds": null,
  "rated": false, "ratingPool": null,
  "minPlayers": 2, "maxPlayers": 2, "createdBy": "...",
  "status": "active",          // what moves
  "players": [ ... ],
  "version": 3,                // null in the lobby
  "frame": { ... }             // THIS seat's observation, null in the lobby
}
```

Three properties follow, and they are the whole design:

- **It is sent on open, at every status.** A client never has to guess where a
  game is, and never holds a frame without the status it belongs to. A reconnect
  needs no announcement: its first message is the current snapshot.
- **It is complete, so it is idempotent.** A client that applies the newest one
  it has seen is correct however many it missed. There is nothing to
  reconstruct and no second channel to correlate against.
- **It is projected per seat before sending.** `frame` is only ever the
  receiving principal's own seat's view, resolved against the roster at send
  time, so hidden information cannot leak. A client holding no seat gets the
  envelope with `frame: null`, which is how a viewer still learns the game
  started.

It carries the immutable header as well as the moving parts on purpose: a game
screen must not need a second source. The D1 game summary
(`GET /games/{id}`) is the **index**, which backs lists and discovery and is a
mirror written after the game's own commit. A screen bound to one game reads the
session; a list reads the index. Never the other way around, and in particular a
list must never subscribe to a session, which would open one socket per row.

**Ordering is by `seq`, not `version`**, because a lobby change has no version.
A client applies a snapshot when `seq` exceeds the one it holds, which is what
resolves a command response racing its own socket push, a duplicate delivery, and
a reconnect that missed nothing. One exception, and it is a property of the state
machine rather than a special case: a `finished` or `aborted` snapshot is applied
whatever its `seq`, because those statuses are absorbing and the abort teardown
drops the storage the counter lived in.

### Gaps still animate

Frames are append-only server-side, one per seat per version, so a version jump
means the client missed transitions it would rather show than skip. It fetches
exactly the missing span with **`GET /games/{id}/frames?from=&to=`** and plays it
through first, one emission per version, **each carrying the previous envelope**.
Only the real snapshot may move `status`, `players` and `seq`, so a client that
missed a finish animates the moves and *then* shows the outcome, rather than
displaying a finished game while mid-game moves play.

A cold open does not animate: with no predecessor rendered there is nothing to
animate from, so it snaps to the present. The same range endpoint serves
finished-game **replay** (the server re-projects from its immutable log), so
replay is the whole range rather than a missing slice.

### Commands answer with the same value

Every accepted command, from `join` to a move, answers with the caller's own
post-commit session, so the client feeds HTTP responses and socket pushes into
one path and drops whichever arrives second by `seq`. That is what makes the
socket-less paths work: a freshly created solo game has no socket yet, and a move
submitted while the socket is mid-reconnect would otherwise render nothing.

**`GET /games/{id}/session`** returns the same snapshot over HTTP, for the paths
with no socket at all.

:::note[Commands are HTTP, deliberately]

The socket is one-way, and sending moves over it was considered and rejected.
Four reasons, none of which is "a socket cannot do it":

- **There is no latency to win.** A WebSocket to a Durable Object is established
  through the client's nearest colo and proxied to the object's colo; an HTTP
  command lands at the same colo and is proxied to the same object. Same two
  hops. What a socket send saves is one token verification and one Worker
  invocation, at a cadence of one move every few seconds.
- **Bots have no socket.** An external bot posts to `/bot/action` with an HMAC
  signature, and the Worker mints the *same* command a human's move mints, with
  the same `expectedVersion` and the same seat verification. That is why there is
  one action path rather than two.
- **Some commands precede any socket.** `createGame` runs before the Durable
  Object exists, `createSolo` starts a game that never had one, and
  `joinByCode` is how a client learns the id it would need to open one.
- **Auth stays fresh.** Every command presents a current ID token, verified per
  request, so expiry and revocation take effect on the next command. A socket's
  principal is resolved once at upgrade and outlives that token.

It also keeps a command's outcome unambiguous: it is an HTTP status, not
something to correlate against a later broadcast, which is what keeps "the server
said no" distinguishable from "the outcome is unknown".

If a game ever needs input faster than about one message per second per seat, or
continuous input such as dragging, this is worth reopening. It would be additive:
the socket already carries the authoritative session.

:::

## Player identity

The transport resolves every seat identity **before** the game screen renders, so
game code gets non-nullable identity, with no null checks and no loading states.

- Identity comes from `GET /api/engine/players?ids=` (batch, public identity:
  username, display name, avatar, anonymity, never email), warmed by a
  client-side persisted cache. Game rows carry no denormalized identity, so a
  renamed user is correct everywhere on the next fetch.
- For a **finished game whose participant was deleted**, the server anonymizes the
  seat (the roster keeps the seat, id nulled); the client renders a **synthetic
  identity** ("Deleted User", `player_{index}`) and sets `GamePlayer.isDeleted`.
  **`isDeleted` is the guard**. Never inspect the synthetic `Player.id`, which
  exists only to give the seat a distinct widget key and is not a real user id.
- **Game identity vs social identity.** Seat identity covers humans *and* bots and
  is the right tool in game screens and lobby cards. Social features (friend
  search, requests) are human-only and never surface bots. Don't branch on player
  type to decide whether to show identity. Show it uniformly; use the seat's
  `type` only where game rules must distinguish a bot seat.
- **The viewer case.** A non-participant replaying a public finished game has no
  seat. `MySeat` is a sealed `Seated(index) | Viewer`, so viewer checks simply
  never match "is it my turn". Read `mySeat.indexOrNull` where a null is the right
  answer for a viewer.
- Per-game **roles** (host, team, dealer) are not a transport concept; they live
  in the game's observation JSON, shaped by `computeObservation`.

**Shared identity widgets** (`lib/shared/widgets/`, exported from the barrel where
a game needs them):

| Widget | Use |
|---|---|
| `PlayerAvatar` | One seat's avatar: cached network image, initials/person fallback, optional active border, relative-URL resolution. `onTap` optional; leave it unset inside a `ListTile` (the tile's own ink covers the row). |
| `OverlappingAvatars` | The overlapped row used on game/lobby cards. |
| `PlayerProfileSheet` | Modal profile: identity, ratings across pools, friendship actions (humans only). Guard with `isDeleted` before opening. |
| `EmptyStateView` | The illustrated empty state shared by all list screens (home, lobby, history, friends, requests). |
| `StatusBanner` | The slim full-width banner primitive behind the offline / reconnecting banners. |
