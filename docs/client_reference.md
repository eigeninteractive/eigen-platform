# Eigen Client — Reference

The reference for the **client side** of the Eigen engine: the Flutter app shell
and the transport that talks to the server. Its companions are
[`architecture.md`](./architecture.md) (the server) and
[`building_a_game.md`](./building_a_game.md) (writing a game's rules).

> **Status.** The client migration to the Cloudflare-native server has not landed
> yet; [`client_changes.md`](./client_changes.md) tracks the concrete deltas. This
> document is the **current-state reference** for the client's durable design —
> the frame/animation model, identity, offline UX, persistence, timing, push,
> navigation, and platform integration — with every server touchpoint written
> against the **new** API. It lives in this repo for now; once the client
> migration begins it becomes the client's golden doc and `client_changes.md`
> retires. Exact widget/provider APIs live in the client code; this captures the
> design and the contracts.

The client is one Flutter package, **`eigen_flutter`** — transport (auth
plumbing, the frame stream), state, and presentation — layered by directory
rather than by pubspec. It consumes **`eigen_api`**, the REST client generated
from the server's `openapi.json`, as a path dependency; those generated types
are the data model directly, with no hand-written mirrors. Each game supplies a
Dart **`GameRules` twin** for optimistic preview and rendering.

---

## 1. Transport & session

- **Auth is Firebase.** Google, Apple, and Anonymous sign-in; `linkWithCredential`
  upgrades a guest to a permanent account, preserving the uid. Every request
  sends the Firebase ID token as `Authorization: Bearer <token>`; WebSocket
  upgrades send it as `?token=` (browsers can't set headers on an upgrade). Tokens
  refresh on the Firebase SDK's schedule; the client attaches the current one per
  request.
- **The API client is generated** from the vendored `openapi.json`. Client routes
  live under `/api/engine/*`; a hand-rolled base URL must include that prefix. The
  one non-generated piece is the frame stream (below), which is hand-written.
- **Errors** are `{ error, code? }`. Branch retry/resync UX on the stable `code`
  (`state_updated`, `game_full`, `schema_unsupported`, `not_participant`, …); see
  the server's error model in `architecture.md` §19.

### The frame stream

A game has **one WebSocket for its whole lifetime** (`/api/engine/games/{id}/socket`),
opened before the game starts. Over it the client receives:

- **Roster snapshots** pre-game — unversioned and idempotent, pushed on every
  lobby change. A reconnect just gets the current one.
- **Versioned frames** from v0 — each is one seat's projected observation at one
  state version (`{ version, data, pending_players, deadline, player_times,
  outcomes?, ratings? }`).

Frames are **strictly serial with no gaps**. The client tracks the last version
it holds; if the socket drops a frame (or the client reconnects), it recovers by
a **range fetch** — `GET /games/{id}/frames?from=&to=` — and applies the missing
frames in version order before resuming the live stream. The same range-fetch
endpoint serves finished-game **replay** (the server re-projects from its
immutable log). Reconnection is therefore always sound: resync by range fetch,
never guess.

---

## 2. The frame & animation model

Animation is the presentation of **frame transitions**. Three guarantees:

1. **You see every frame, in order.** Every move — yours, an opponent's, a bot's,
   a timeout resolution — arrives as its own frame, so "animate the change between
   the previous frame and this one" is sound for *all* transitions. The one
   exception is a cold (re)load, where the stream starts at the latest frame with
   no predecessor (rule 3).
2. **The observation tells you what happened — don't diff frames.** Frame diffing
   can't recover causality (a hidden move with no visible footprint; two causes
   with the same footprint; a composite resolution the diff collapsed). Instead
   the game's `computeObservation` receives the transition's `cause` and embeds
   each seat's permitted view of it into that seat's `data` (a `lastMove` /
   `events` field, shaped for your animation). Visibility is per-seat because the
   embedding happens inside the projection, and replay frames carry the same cues
   — one animation pipeline serves live play and replay.
3. **Animate a cue only when you rendered its predecessor.** A cue describes a
   transition. On a cold load or stale rejoin you get a frame whose predecessor
   you never rendered — show the cue as static "last move" info (a highlight), not
   an animation. Keep the last rendered `version` in widget state; play the
   entrance animation only when the incoming frame is its direct successor.

### Optimistic preview (optional latency hiding)

A turn-based round trip is usually well under a second, so latency hiding is
**game-owned** — the transport never predicts game state, it only reports how a
submit resolved. Two layers:

- **Outcome-independent feedback** needs no bookkeeping: lift the piece on tap,
  slide it, play the sound in local widget state, resolved when the server frame
  lands.
- **Optimistic rendering** pairs the Dart twin's `previewAction` with the result
  the submit call returns. Compute the predicted observation locally and render it
  while the request is in flight; the result tells you what the stream will do:
  - **committed** — the confirming frame is guaranteed to be the *next* frame
    (versions are serial, so nothing commits in between); clear the prediction
    when it arrives.
  - **rejected** — the move did not commit and no frame is coming; revert (the
    board snaps back) and show the error.
  - **unconfirmed** (the request failed in transit) — the server may or may not
    have committed it; revert, and if it *did* commit, its frame arrives over the
    socket and re-applies.

  `previewAction` returning null means "don't predict this move" — required for
  moves whose result depends on hidden information (a combat resolution, a reveal,
  a deck draw); those render server-driven. Predict only the actor's own moves;
  opponents' moves always arrive as server frames.

---

## 3. Player identity

The transport resolves all seat identities before the game screen renders, so
game code gets non-nullable identity — no null checks or loading states.

- Identity comes from `GET /api/engine/players?ids=` (batch, public identity:
  username, display name, avatar, anonymity — never email), warmed by a
  client-side persisted cache (§6). This is the decided alternative to
  denormalizing identity onto game rows.
- For a **finished game whose participant was deleted**, the server anonymizes the
  seat (the roster keeps the seat, id nulled); the client renders a **synthetic
  identity** ("Deleted User", `player_{index}`). Flag it so profile lookups are
  skipped for that seat.
- **Game identity vs social identity.** Seat identity covers humans *and* bots and
  is the right tool in game screens and lobby cards. Social features (friend
  search, requests) are human-only and never surface bots. Don't branch on player
  type to decide whether to show identity — show it uniformly; use the seat's
  `type` only where game rules must distinguish a bot seat.
- **The viewer case.** A non-participant replaying a public finished game has no
  seat — model "my seat" as `Seated(index) | Viewer` and let viewer checks simply
  never match "is it my turn".
- Per-game **roles** (host, team, dealer) are not a transport concept — they live
  in the game's observation JSON, shaped by `computeObservation`.

---

## 4. Timing & clock widgets

Timing is server-authoritative; the client only *displays* it. Each frame carries
the true `deadline` (epoch ms, or null when untimed) and, in budget mode, the
per-seat `player_times` banks. The client:

- Renders a countdown to `deadline`, and for budget mode the remaining bank per
  seat.
- Mirrors the server's `DEADLINE_GRACE_MS` (750 ms) as a **display-only** cushion
  so a move made at 0:00 that the server still accepts doesn't flash "expired" on
  the mover's screen. The grace is never the client's to enforce — it's the
  server's; the mirror only smooths the display.
- Treats the deadline as advisory for UI only: the server decides expiry. When the
  clock hits zero the client shows "time's up" and waits for the timeout frame,
  which resolves the turn authoritatively.

The create/solo UI must require a turn or budget clock whenever a bot is seated
(the server rejects an untimed bot game).

---

## 5. App startup

`AppStartup` wires the singletons the shell depends on, in a fixed order so no
initial event is missed: register the notification navigation listener *before*
initializing messaging (the terminated-state tap arrives on a broadcast stream);
open the persistence database; establish auth. It also owns an
`AppLifecycleListener` that, on resume, re-checks OS notification permission and
(Android) polls for an in-app update (§9, §10).

A splash screen covers the async startup; it should paint the brand immediately
and hand off to the first real screen (home) when startup completes, with no
intermediate spinner where cached data exists (§6).

---

## 6. Local persistence

**Goal:** eliminate cold-start spinners for data that is already known and rarely
changes — first paint shows real data, background refreshes update silently.

- A single on-device SQLite database stores persisted provider state as JSON,
  keyed by a string, opened once at startup and shared.
- **User-scoped cache keys** (e.g. `profile_{uid}`, `friendships_{uid}`, the
  player-info cache) are centralized so reads, writes, and deletion stay in sync.
- **Clear on sign-out and account deletion.** A single `deleteUserData(uid)`
  wipes every user-scoped key; call it *before* the auth session ends (after
  deletion the credentials are gone). The server's `DELETE /api/engine/me` handles
  the server side; the client is responsible only for the on-device cache and the
  FCM installation.

The persisted player-info cache is what keeps the batch `players?ids=` endpoint
warm — most identity reads hit the cache and only cold ids round-trip.

---

## 7. Connectivity & offline UX

Connectivity is infra-owned — game code never watches it. Two banners:

- An **offline banner** on shell screens when the device reports no network.
- A **reconnecting banner** on the game screen when offline *or* the game
  stream/observation is erroring *and* the game is non-terminal — a spinner +
  "Reconnecting…". It isolates connectivity rebuilds to a leaf widget so a drop
  doesn't rebuild the whole game tree.

Both push content down (never overlay) with an animated height change. Note that
interface availability isn't internet reachability — a captive Wi-Fi reports
online — so the real recovery signal is the stream re-syncing (§1), not the
connectivity flag alone.

---

## 8. Navigation

A shell with indexed-stack branches, and full-screen routes above it:

```
/home /lobby /history /social /about /settings   — shell branches (drawer-switched)
/game/:gameId   /join/:code   /profile            — full-screen, above the shell
```

- Branch screens are top-level destinations; Back exits the app (branches switch
  via the drawer, not Back).
- `/game` is always reached by a push, so Back returns to the source screen
  (home/lobby/history) with the predictive-back peek.
- `/join/:code` is a transient spinner that resolves the short code and
  `pushReplacement`s into the game (or shows a clean "invite no longer valid").
- Deep links (`/j/{code}` from a share, or a push's deep link) route through the
  same join/game paths.

Use `go` for auth redirects and branch roots (replaces the stack), `push` for
anything Back should undo, `pushReplacement` for transient screens.

---

## 9. Push notifications (FCM)

Push is infra-owned; game code never registers tokens. On startup the client:

1. Creates the Android notification channels (your-turn, game-over, social).
2. Enables foreground banners (iOS presentation options +
   `flutter_local_notifications`).
3. Requests OS permission once (gated by a persisted first-launch flag).
4. Forces FCM registration, then reads the **Firebase Installation ID (FID)** and
   registers it with the server via **`PUT /api/engine/me/devices { fid, platform }`**
   (replacing the old `app_upsert_device_installation` RPC). It re-registers on
   `onIdChange`. On sign-out it calls **`DELETE /api/engine/me/devices/{fid}`**.
5. On a foreground message, shows a local banner — **except** a `your_turn` push
   for the game currently on screen (read the router's current URI and suppress a
   banner for `/game/{id}` matching the push's deep link).
6. Taps route via the deep link (`/game/{id}`, `/social`).

The server sends best-effort pushes (your-turn, game-over, friend-request,
friend-accepted); there is no delivery guarantee — the game state is the truth and
the app catches up on open, so the client must never depend on a push arriving.

---

## 10. Platform integration

These are the mechanical shell concerns. The design decisions that matter:

- **In-app updates (Android).** On resume, query Play Core for an update. If an
  *immediate* update is allowed and no game is active, run the full-screen update;
  if a game is active, skip and retry next resume (never interrupt a game). A
  *flexible* update downloads in the background and surfaces a "new version ready
  — Restart" snackbar. The mid-game gate reads the current route.
- **In-app review.** Request the OS review prompt at a genuine positive moment
  (e.g. after a satisfying win), rate-limited by the platform and a local cooldown
  — never on launch, never mid-game.
- **App icon, favicon & social preview.** One source image generates the platform
  icon sets; the web favicon and the OG/social-share image are produced alongside.
  (The server renders the per-game share card at `/j/{code}`; this is the app's own
  branding.)
- **Haptics.** A thin haptics helper maps game events (move, win, error) to
  platform feedback, centralized so intensity/enable-state is one setting.
- **Splash assets.** A native splash (not a Flutter-drawn one) so the brand paints
  before the engine boots; it hands off to `AppStartup`'s cover.
- **Android release hardening.** Standard shrink/obfuscate (R8), signing config,
  and the store-listing checklist live with the client build; keep the deep-link
  host's `assetlinks.json` (served by the server) in sync with the release signing
  cert's SHA-256 fingerprint.

---

## 11. The client/server boundary

What the **client** owns: rendering, animation, optimistic preview
(`previewAction`), the frame-stream/reconnect state machine, all shell concerns
(navigation, splash, offline UX, persistence cache, push registration, platform
integration), and the create/lobby UX.

What the **server** owns (client never reimplements): the rules, timing/expiry,
seat authority, ratings, history, identity resolution, and every write's policy.
The client proposes; the server decides.

The two rules twins (Dart preview, TS authority) are kept honest by the shared
JSON fixtures run on both sides — a drift fails a test in both languages. When in
doubt about behaviour, the server's TS rules are the truth; the Dart twin exists
only to hide latency and render.
