---
sidebar_position: 8
title: Identity & the social graph
description: Firebase ID tokens verified in-worker, guest accounts, usernames, and the friends/blocking model.
---

# Identity & authentication

## Firebase ID tokens, verified in-worker

Every ordinary `/api/engine/*` request carries a Firebase ID token as
`Authorization: Bearer <token>`. A WebSocket first obtains a signed, 60-second,
game-scoped ticket over that authenticated HTTPS channel and presents the ticket
on the upgrade; the Firebase credential never enters a URL. The Worker verifies
Firebase tokens with jose against Google's
securetoken JWKS: RS256 pinned (no algorithm confusion), issuer and audience
checked against the configured `FIREBASE_PROJECT_ID`, expiry enforced. A failure
is a deliberately unspecific 401: signature, expiry, issuer, and audience
failures all read the same to a client ("re-authenticate").

Socket tickets are HS256 JWTs with fixed issuer and audience plus the game id,
user id, expiry, and unique id. The upgrade verifies the signature, scope, and
expiry before it derives the game's Durable Object.

The verified claims carry the uid, `isAnonymous` (the `anonymous`
sign-in-provider claim, which drives every guest gate), and the profile fields
(Google supplies name + picture, Apple usually only email, guests none).

## Provisioning & guests

A `users` row appears on first sight of a valid token, so there is no signup
call to make. Username is derived from the email local part (sanitized to a
`[a-z0-9_.]{3,20}` charset) or a generated `player_NNNNN` handle for guests, with
a collision-retry loop.

Guests are first-class: anonymous sign-in gives a real uid and a real (ephemeral)
account. Because `linkWithCredential` preserves the uid, guest→permanent
conversion is an in-place backfill on the same row, and the provider's display name
and avatar overwrite the guest's, while the stable username handle survives.
Guest capability is deliberately narrowed: guests may play (including vs bots,
unrated) but cannot create friends-access games or join rated games. Inactive
guests are swept by the cron; see [Account lifecycle](./account-lifecycle.md).

The **username** is the stable, editable handle (distinct from the provider
display name, which the engine never lets a user edit). `PUT /me/username`
validates the same `[a-z0-9_.]{3,20}` charset and returns a clean 409 on a
collision (the column is UNIQUE). The **display name** and **avatar** come from
the auth provider (or an uploaded avatar); `PUT /me/avatar` is the only way a
user changes their picture.

## The social graph

Friendships, search, and blocking are **cross-game and D1-only**; they never
touch a Durable Object. The `relationships` table stores one row per unordered
pair in canonical order (`user_id_1 < user_id_2`) with a `status`
(`pending` / `accepted` / `blocked`) and an `initiated_by` actor, so a single
shared row encodes the relationship and the direction of a request or block is
recovered from `initiated_by`.

- **Requests.** `POST /friends/requests {targetUserId}` inserts a `pending`
  row, unless the target already has a pending request out to the caller, in
  which case it **auto-accepts** (sending back is accepting). `accept`
  transitions the request the *other* party initiated. `DELETE /friends/{id}`
  is the single idempotent unfriend / withdraw / decline. All writes require a
  **registered** caller, and a friend target must be registered too (a guest is a
  throwaway identity).
- **Blocking.** `POST /friends/{id}/block` overwrites any pending/accepted row
  (or creates one) as `blocked`, recording the blocker in `initiated_by`. A block
  in *either* direction refuses new requests; only the blocker can `unblock`.
- **Search.** `GET /users/search?q=` is a case-insensitive substring match on
  username or display name, excluding the caller, guests, and anyone in a blocked
  relationship with the caller, ranked exact → prefix → substring. `LIKE` today,
  D1 FTS5 later; the `%` wildcard is stripped so a caller can't force a scan.
- **Discovery.** `GET /friends/games` lists joinable games created by the
  caller's accepted friends, the lobby that makes `friends`-access games
  reachable.

Friend-event pushes (`friend_request`, `friend_accepted`) fire from the route
through the shared, required FCM path. Because these
run in a **stateless Worker** (not the always-alive DO), they ride
`executionCtx.waitUntil` so a slow FCM call never delays the response, the one
place the engine uses `waitUntil` deliberately.
