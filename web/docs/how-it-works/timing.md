---
sidebar_position: 6
title: Timing & the deadline alarm
description: Three timing modes, the deadline precedence chain, and why one grace constant replaces a timeout-sweep cron.
---

# Timing & the deadline alarm

Timing is server-authoritative and lives in the kernel. A game is created in
exactly one timing mode:

- **Turn**: a fixed budget per move (`turnSeconds`).
- **Budget** (chess-clock): a per-player bank (`budgetSeconds`) with an optional
  Fischer `incrementSeconds` added after each move.
- **Untimed**: no clock at all.

(Turn and budget are mutually exclusive; increment requires budget.) A hook may
also override the deadline for a single action via the envelope's `turnSeconds`,
without touching any player's bank.

## The deadline computation

After every transition the kernel computes the next `deadline` and whether a
budget bank is running by a fixed precedence chain (all instants are injected
epoch milliseconds, since the kernel never reads a clock). The persisted
`turnStartedAt` is non-null only while the current turn consumes a budget bank:

1. **Game over** → both `null` (no deadline).
2. **Hook per-action override** (`envelope.turnSeconds = N`) → `now + N·1000`
   and `turnStartedAt = null`; banks are untouched for this new turn.
3. **Budget mode** → `now + min(remaining bank over the new pending seats)`. A
   budget-timed game allows at most one pending seat (enforced upstream), so this
   min is normally just that seat's bank; the min is a safe degradation if a
   multi-pending state ever arrives.
4. **Per-turn mode** → `now + turnSeconds·1000` and
   `turnStartedAt = null`.
5. **Untimed** → both `null`.

In budget mode the acting seat's bank is charged when a budget-consuming turn
ends, including when the action finishes the game:
`bank[seat] = max(0, bank[seat] − (now − turnStartedAt)) + increment·1000`.
The deduction floors at 0 (an overrun lands at 0, never negative), and the
Fischer increment is added after. Charging is decided entirely from the
persisted turn being completed. The envelope returned by that action controls
only the next turn, so budget → override and override → budget transitions
cannot debit the wrong clock. If an override itself times out, the underlying
bank remains untouched; only a budget-consuming turn can drain or zero it.

## Grace, and why it's a single constant

The enforcement mechanism is the **DO's durable alarm**, and this is a key
simplification over a database-backed engine. Server time is measured when the
request *arrives*, not when the player tapped, so a move made on time can land
just past the deadline through pure network latency. One grace constant in the
kernel (`DEADLINE_GRACE_MS = 750ms`) compensates, with exactly two call sites:
the kernel accepts an action while `now ≤ deadline + grace`, and the DO arms its
alarm one millisecond later, at the first instant for which expiry is true.
This avoids an equality-boundary alarm abstaining and disappearing. Whichever
arrives first, the latent action or the alarm, commits; the loser sees
already-advanced state and no-ops. When the alarm fires it commits a `timeout`
lifecycle, which needs no stored receipt to be safe: the kernel abstains once the
state the timeout was derived from has moved on, so a double fire, a platform
retry, and a real move that arrived first all resolve the same way.

The grace forgives **acceptance, not time charged**: in budget mode the elapsed
deduction still runs, so flag-fall is honoured: a player whose bank hits 0 can
overrun by at most the grace and still have that final move counted (bounded and
self-limiting). This replaced an older three-place race symmetry with one
constant.

:::tip[There is no timeout-sweep cron]

Because the alarm is a durable, per-game, platform-retried timer, the periodic
scan for overdue turns that a database-backed engine needs simply evaporates.
The database has no per-row timer, but the DO alarm *is* that timer.

`reconcileAlarm` is the **only** code that writes the DO's alarm. A stray
`setAlarm` elsewhere would silently disarm a turn deadline.

:::

## The alarm is derived, not tracked

There is no desired-alarm column and no generation counter. An active game's
committed deadline **is** the desired alarm, so the engine re-derives it from
storage and writes only when the armed alarm differs.

That matters because the deadline and the alarm are separate storage writes. An
object that stops between them would otherwise hold a committed deadline nothing
is armed for, and a deadline is exactly the case where no player is going to act
and trigger a repair. Since re-deriving is idempotent and cheap, every command
does it on the way out, whether it committed a transition, replayed a receipt, or
was refused. Recovery is not a separate mechanism from the normal path.

Untimed games have no alarm at all; their only backstop is the abandoned-game
reap, described in [Account lifecycle & the cron](./account-lifecycle.md).
