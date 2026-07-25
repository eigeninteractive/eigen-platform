---
sidebar_position: 6
title: Timing
description: Two server touchpoints and a display-only client — deciding what a timeout costs, widening one action's window, and rendering a clock that cannot disagree with the server's alarm.
---

# Timing

You mostly get timing for free. A game is created in one of three modes —
per-action window, chess-clock bank with optional increment, or untimed — the
creation UI picks the values, and the engine enforces the deadline with a durable
per-game alarm.

**Expiry is entirely the server's.** There is no client-side nudge, no
client-side timer that fires anything. That is the single largest simplification
in the system, and it means your only real decisions are the two below.

## The server side: two touchpoints

**`applyLifecycle` on `timeout`** decides what running out costs. The seats in
`pending` are the ones that ran out; resolve the whole set in one envelope.

```ts
if (type === "timeout") {
  // Both idle ⇒ a drawn match; one idle ⇒ the seat that did commit wins.
  if (pending.length === 2) return { state, pendingPlayers: [], outcome: drawOutcome() };
  const winner = (1 - pending[0]) as 0 | 1;
  return { state, pendingPlayers: [], outcome: matchOutcome(winner) };
}
```

**The envelope's `turnSeconds`** widens the deadline for *one* action only — a
longer window for a special phase — without touching any player's bank. Omit it
to use the game's configured timing.

That is the whole server surface. Deadlines, the bank, the grace window and the
alarm are all engine-owned; see
[Timing & the deadline alarm](../how-it-works/timing.md) for how they work.

## The client side: display only

Each frame carries the true `deadline` (epoch ms, or null when untimed) and, in
budget mode, the per-seat `playerTimes` banks. `TimingContext` on
`GameContentContext.timing` exposes them as `clock`, `deadline`, `playerTimes`
and `windowMillis`, plus `isTimed`, `deviceDeadline` and `remaining`.

Four things to know:

- **Measure against server time, not the device clock.** `ServerClock` tracks the
  offset from the `Date` header every response already carries, and
  `deviceTimeFor()` converts a server timestamp into device time so a countdown
  ticks correctly on a device whose clock is minutes out. Deadlines are absolute
  **server** timestamps — the same value the server's own alarm fires on — so
  display and expiry cannot diverge.
- **Only one bank drains at a time.** Budget mode permits a single pending seat,
  so the turn deadline and the acting seat's bank are the same quantity.
- **The soft margin nudges honest players to submit early.**
  `softDeadlineMarginFor(window)` returns `min(1s, 25% × window)` — capped as a
  fraction so a short window (a 3 s reaction phase) is not swallowed.
  `TurnCountdown` subtracts it so the displayed countdown reaches zero slightly
  early. `BudgetClock` uses it only to raise a "submit!" cue, because subtracting
  it would make a chess-style clock visibly snap back up on submit.
- **The server's grace window is the server's.** `kServerDeadlineGrace` (750 ms)
  records the constant for reference; the client applies it to nothing. The soft
  margin is what keeps an on-time move from needing it.

When the clock hits zero the client shows "time's up" and **waits for the timeout
frame**. It never decides that time has expired.

### Rendering a clock

Two shells handle the common cases, and the game screen picks by timing mode:
`TurnCountdown` (per-action) and `BudgetClock` (a row of per-seat cells). Both
pause automatically when the device goes offline.

Two headless builders sit underneath, for a game that needs custom placement —
chess clocks beside captured pieces, or an N-player game showing only the active
seat:

| Builder | What it owns |
|---|---|
| `TurnTimerBuilder` | A 1 s ticker toward a deadline, self-cancelling at zero. Hands `Duration remaining` to a `builder`. Pass `isPaused` to freeze the display without losing wall-clock position. |
| `PlayerTimerBuilder` | One seat's bank — live drain for the acting seat, static for the rest. Hands `(int remainingMs, bool isActive)` to a `builder`. |

:::note Bots imply a timed game

If a game seats a bot it **must** be timed — the deadline is the backstop for a
bot that never moves. The engine enforces this at seating, so `botSeatable` does
not need to, but the creation UI should not offer an untimed option for a game
that allows bots. See [Creation UI](./creation-ui.md).

:::
