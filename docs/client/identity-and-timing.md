---
sidebar_position: 4
title: Player identity & clocks
description: Non-nullable seat identity resolved before render, and display-only clocks measured against server time.
---

# Player identity

The transport resolves all seat identities before the game screen renders, so
game code gets non-nullable identity — no null checks or loading states.

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

## Timing & clocks

Timing is server-authoritative; the client only *displays* it. Each frame carries
the true `deadline` (epoch ms, or null when untimed) and, in budget mode, the
per-seat `player_times` banks.

- **Measure against server time, not the device clock.** `ServerClock` tracks the
  offset from the `Date` header every response already carries, and
  `deviceTimeFor()` converts a server timestamp into device time so a countdown
  ticks correctly on a device whose clock is minutes out. Deadlines are absolute
  epoch-millisecond **server** timestamps — the same value the server's own
  expiry alarm fires on — so display and expiry cannot diverge.
- **Only one bank drains at a time.** Budget mode permits a single pending seat,
  so the turn deadline and the acting seat's bank are the same quantity.
- **The soft margin nudges honest players to submit early.**
  `softDeadlineMarginFor(window)` returns `min(1s, 25% × window)` — capped as a
  fraction so a short window (a 3 s reaction phase) isn't swallowed.
  `TurnCountdown` subtracts it so the displayed countdown reaches zero slightly
  early, and `BudgetClock` uses it only to raise a "submit!" cue: a budget clock
  stays numerically truthful, because subtracting a margin would make a
  chess-style clock visibly snap back up on submit. Display only, never
  enforcement.
- **The server's grace window is the server's.** `kServerDeadlineGrace` (750 ms)
  records the server's constant for reference; the client does not apply it to
  anything. The soft margin above is what keeps an on-time move from needing it.
- **Expiry is the server's.** When the clock hits zero the client shows "time's
  up" and waits for the timeout frame. There is **no client expiry nudge** — the
  Durable Object's alarm is the timer, which is the main simplification the
  Cloudflare server bought over the database-backed design.

`TimingContext` (on `GameContentContext.timing`) carries `clock`, `deadline`,
`playerTimes`, and `windowMillis`, plus `isTimed`, `deviceDeadline` and
`remaining`. Two headless builders render from it, so a game can place clocks
anywhere:

| Widget | What it owns |
|---|---|
| `TurnTimerBuilder` | A 1 s ticker toward a deadline, self-cancelling at zero. Hands `Duration remaining` to a `builder`. Pass `isPaused` (typically `ref.watch(isOfflineProvider)`) to freeze the display without losing wall-clock position. |
| `PlayerTimerBuilder` | One seat's bank — live drain for the acting seat, static for the rest. Hands `(int remainingMs, bool isActive)` to a `builder`. |

The infra-owned shells `TurnCountdown` (per-action) and `BudgetClock` (a row of
per-seat cells) wrap those and handle the offline pause automatically; the game
screen picks between them by timing mode. Use the builders directly only when a
game needs custom placement (chess clocks beside captured pieces; an N-player
game showing only the active seat).

:::warning Server-seated bots require a timed game

The create/solo UI must require a turn or budget clock whenever a bot is seated
by the server: bot dispatch is single-attempt, so the turn deadline firing the
server's alarm is the only thing that resolves a bot which never moves. The rule
is scoped to *server* seating on purpose — a client-driven bot has no dispatch to
fail, so the deferred offline-solo path stays free to be untimed.

:::
