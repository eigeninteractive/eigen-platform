# Client changes — running list

The server (`eigen-server`) and the Flutter client (`eigen_client` transport +
`eigen_flutter` shell) evolve in lockstep across a big-bang cutover. This file
is the **running list of client-side work each server change implies**, so the
client migration never has to reverse-engineer the diff. Add an entry whenever a
server change needs a client change; mark it `done` when the client lands it.

Convention per entry: **what changed on the server**, **what the client must
do**, and a status (`todo` / `in progress` / `done` / `future`).

---

## Auth & transport (Milestone A)

- **Firebase Auth replaces Supabase.** `todo`
  The client swaps `supabase` auth for `firebase_auth` (Google + Apple +
  Anonymous, `linkWithCredential` for guest→permanent). Every request sends the
  Firebase ID token as `Authorization: Bearer <token>`; WebSocket upgrades send
  it as `?token=` (browsers can't set headers on upgrades).
- **Generated API client from `openapi.json`.** `todo`
  `eigen_client` is generated from the vendored `packages/server/openapi.json`
  (dio, or a hand-written thin client). The frame stream (WebSocket, version
  ordering, gap recovery by range fetch, reconnect resync, pre-start roster
  snapshots) is hand-written.
- **Client routes are under `/api/engine/*`.** `todo`
  The Firebase-authed client surface moved from `/api/*` to **`/api/engine/*`**
  (e.g. `/api/engine/games`, `/api/engine/me`, `/api/engine/lobby`, and the
  socket at `/api/engine/games/{id}/socket`). The API now has two groups under
  one `/api` prefix — `/api/engine/*` (client, Firebase) and `/api/bot/*`
  (external bots, HMAC) — so they can share a host without sharing auth. If the
  client is generated from `openapi.json` the paths come for free; a hand-rolled
  base URL must include `/api/engine`.
- **Error shape.** `todo` Every failure is `{ error, code? }`; the client keys
  retry/resync UX off the stable `code` (e.g. `state_updated`, `game_full`,
  `schema_unsupported`, `not_participant`).
- **Action/forfeit carry the caller's `seat`.** `todo`
  `POST /games/{id}/action` and `/forfeit` bodies now include `seat` (the
  caller's own `player_index`, known from the roster snapshot / frames). The
  DO verifies it against its roster — a seat the caller doesn't hold is a
  clean 403 (`not_participant`). Send it on every move; there is no
  server-side "resolve my seat" fallback anymore.

## Bots (Milestone B — §7)

- **Local bots are DELETED.** `todo`
  Remove the Dart `LocalBot` isolate driver and every local-bot code path/UI.
  Bots now run server-side (in the DO) or are externally hosted; the client no
  longer drives any bot. (See "Offline solo" below for the *replacement* of the
  genuinely-offline use case — a different, future feature.)
- **create-solo: `POST /api/games/solo`.** `todo`
  New single-call "play vs bot" flow: pick bots from the catalog, POST the game
  config + `bot_ids`, and the game is created **and started** in one call. The
  response carries `{ game_id, short_code, version, frame }` — `frame` is the
  caller's opening (v0) projection, so render straight from it; the bot's
  first move (if the bot opens) arrives over the socket a beat later.
- **Bot games must be timed.** `todo`
  The create/solo UI must require a turn/budget clock whenever a bot is seated
  (the server rejects an untimed bot game — bots ⇒ timed).
- **Bot catalog shape changed.** `todo`
  `GET /api/bots` no longer returns `is_local`. Bots now carry a
  `type` (`engine`/`external`/`local`) server-side; the catalog projection
  stays identity-only (name/avatar/config) for the picker, but if the client
  ever surfaces `type`, it must never offer a `local` bot in the online
  picker (those are reserved for offline import).
- **Guests can play bots.** `todo`
  Guest gating relaxed from "local-bots-only" to "bots allowed, unrated" —
  solo-vs-bot is a guest's first-run experience. The client offers it to
  anonymous users (unrated).

## Account deletion (Milestone C)

- **Account deletion is one call: `DELETE /api/engine/me`.** `todo`
  Replaces the Supabase `game/delete-account` edge-function invoke. The
  Settings destructive action calls `DELETE /api/engine/me` with the Firebase
  bearer, then signs out of Firebase (`firebase_auth.signOut()`; swallow the
  error — the token may already be dead). The server forfeits/cancels/leaves
  the caller's live games, deletes the Firebase account, and purges the user's
  data server-side, so the client no longer orchestrates any of that. Handle
  **502** as "deletion failed, the account is intact — retry" (the account is
  never half-deleted). Client-side cleanup that still belongs on the device:
  clear the SQLite profile/friends cache and the FCM installation *before* the
  call (as `signOut` does today), since after deletion the credentials are gone.
  Avatar-file removal is deferred to the avatars milestone (D) — nothing to do
  until uploads exist.
- **Guests can be purged out from under a stale session.** `future`
  A guest inactive for a week is swept server-side (forfeit-then-delete). If a
  long-dormant guest returns and the server has purged them, their token no
  longer resolves to data — the client should treat "my games/profile empty +
  token still valid" gracefully (re-provision is automatic on the next request,
  as a fresh guest). No proactive client work; just don't assume a guest's
  server data is permanent.

## Web, deep links & avatars (Milestone D)

- **Avatar upload is a raw-binary `PUT /api/engine/me/avatar`.** `todo`
  Replaces the Supabase client-direct-to-Storage upload (R2 has no RLS / no
  client-direct writes). The client sends the image bytes as the request body
  with `Content-Type: image/jpeg|png|webp` (not multipart) and the Firebase
  bearer; max ~2 MiB (server returns **415** wrong type, **413** too big, **400**
  empty). The 200 response is `{ avatar_url }` — store/display it directly; it
  already carries a `?v=<ts>` cache-buster, so `cached_network_image` refreshes
  on re-upload with no manual invalidation.
- **`avatar_url` may be relative.** `todo`
  With the default (worker-served) setup it's `/avatars/{uid}?v=<ts>` — resolve
  it against the API base URL. If the deployment sets a public bucket domain
  it's absolute. Treat `avatar_url` as "use as-is if absolute, else prefix with
  the API host." (The Firebase provider photo is still an absolute URL; guests
  still have none → initials.)
- **Account deletion no longer removes the avatar client-side.** `todo`
  Drop the old §22 "best-effort avatar removal before delete" step —
  `DELETE /api/engine/me` (Milestone C) deletes the R2 object server-side.
- **Share links are `https://<host>/j/<shortCode>`; wire App/Universal Links.** `todo`
  The server hosts `/.well-known/assetlinks.json` (Android) and
  `/.well-known/apple-app-site-association` (iOS), generated from `deepLink`
  config. The client app must declare the deep-link host + `/j/*` path in its
  Android intent-filters and iOS associated-domains so an installed app opens
  `/j/<code>` directly (no custom URL scheme needed). When the app isn't
  installed the URL renders a server OG/landing page with store links — the
  client does nothing for that case. Share sheets should emit the `/j/<code>`
  URL (the `short_code` is already in create/summary responses).

## Push notifications — device registration (review pass)

- **Register the FCM device on sign-in: `PUT /api/engine/me/devices`.** `todo`
  Replaces the Supabase `app_upsert_device_installation` RPC. After auth, the
  client sends `{ fid, platform }` (`platform` ∈ `ios`/`android`/`web`; `fid` =
  the Firebase Installation ID) so turn/finish pushes can reach the install. The
  server upserts on the FID, so signing in on a device reassigns it to the
  current user — call it on every sign-in / FID refresh.
- **Deregister on sign-out: `DELETE /api/engine/me/devices/{fid}`.** `todo`
  Replaces `app_delete_device_installation`. Call it before dropping the
  Firebase session (the delete is scoped to the caller, so a device already
  reassigned to another account is left alone). Account deletion already removes
  the caller's device rows server-side, so this is only for sign-out.

## Offline solo — transcript import (future)

- **`future`** The replacement for the deleted local-bot "offline" story. The
  client simulates a whole solo game on-device (Dart rules twin + a Dart bot
  brain, seeded RNG), then uploads the seed + ordered action transcript; the
  server replays it through the real TS rules and records it as a normal
  finished game (identical history/replay). Client work when built: record the
  transcript, drive the on-device game loop, upload on finish/reconnect. The
  bot in such a game is a registry row of `type: local` (server never dispatches
  it). Nothing is required in the client for this yet.

## Not a client change

- **Registering external bots** is an operator task (`wrangler d1 execute` /
  a seed inserting a `type: 'external'` row with a `webhook_url`), not a
  game-client concern. The *bot operator* (the third party hosting the bot)
  needs the bot's derived signing key (`HMAC(BOT_SIGNING_SECRET, bot_id)`) and
  the wake/action protocol — it POSTs moves to **`POST /api/bot/action`** with
  the HMAC in the **`Eigen-Signature`** header over the exact request body
  (domain `action`); the engine signs wakes with the same header the other way
  — that's a separate bot-author doc, not this file.
