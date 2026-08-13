/**
 * Pure timing math: deadlines, the grace window, and the budget bank. All
 * instants are epoch milliseconds and always injected: the kernel never reads
 * a clock.
 *
 * The grace window compensates network physics (server time is measured at
 * request arrival, not at the tap). It is ONE constant with exactly two call
 * sites: the kernel accepts an action while `now <= deadline + grace`, and the
 * DO arms its alarm one millisecond later, at the first genuinely expired
 * instant. Whichever arrives first, the latent action or the alarm, commits;
 * the loser sees already-advanced state and no-ops.
 *
 * Budget-mode fairness: the grace forgives *acceptance*, not *time charged*;
 * the elapsed bank deduction (floored at 0) still runs. So does flag-fall: a
 * player whose bank hits 0 can overrun by up to the grace and still have that
 * final move counted (bounded and self-limiting: accepted behaviour).
 */

import { GameBugError } from "./errors.js";

/** Grace window (ms) added to every deadline comparison so a player who
 * submits on time is not rejected because network latency carried the request
 * past the deadline. Keep it small relative to per-action `turnSeconds`
 * windows. The client's display-only `kServerDeadlineGrace` mirrors this. */
export const DEADLINE_GRACE_MS = 750;

/** TRUE once a turn deadline (plus the grace window) has genuinely passed,
 * measured against the injected `now`. A null deadline (untimed turn) is
 * never expired. */
export function deadlineExpired(deadline: number | null, now: number): boolean {
  return deadline !== null && deadline + DEADLINE_GRACE_MS < now;
}

/** Deducts the acting player's elapsed thinking time from their budget bank
 * and applies the Fischer increment. Returns a new `playerTimes` array (ms
 * banks, one per seat). Floored at 0: a player who overran their bank lands
 * at 0, not negative. */
export function deductBank(playerTimes: readonly number[], playerIndex: number, now: number, turnStartedAt: number | null, incrementSeconds: number | null): number[] {
  if (turnStartedAt === null) {
    throw new GameBugError("deductBank called with null turnStartedAt");
  }
  const elapsed = Math.max(0, now - turnStartedAt);
  const times = [...playerTimes];
  times[playerIndex] = Math.max(0, times[playerIndex] - elapsed) + (incrementSeconds ?? 0) * 1000;
  return times;
}

export interface NextDeadline {
  deadline: number | null;
  /** Start of a budget-consuming turn. Null for every other timing mode. */
  turnStartedAt: number | null;
}

/** Computes the deadline and budget chargeability for the next action: the
 * precedence chain used by start and every commit mode. Pass
 * `gameOver = true` when the transition ends the game.
 *
 * 1. game over → both null
 * 2. hook returned `turnSeconds` N → now + N s (banks untouched)
 * 3. budget mode → now + MIN remaining bank over the new pending set
 * 4. per-action mode → now + configured `turnSeconds`
 * 5. untimed → both null
 *
 * Budget mode allows at most one pending seat, enforced at the source by
 * `assertBudgetPending` before any envelope reaches this; the MIN remains the
 * graceful-degradation safeguard should a multi-pending state arrive anyway.
 */
export function computeNextDeadline(input: {
  now: number;
  gameOver: boolean;
  /** The hook's per-action override (envelope `turnSeconds`), else null. */
  actionSeconds: number | null;
  budgetSeconds: number | null;
  turnSeconds: number | null;
  newPending: readonly number[];
  newPlayerTimes: readonly number[] | null;
}): NextDeadline {
  const { now, gameOver, actionSeconds, budgetSeconds, turnSeconds, newPending, newPlayerTimes } = input;

  if (gameOver) return { deadline: null, turnStartedAt: null };

  if (actionSeconds !== null) {
    return { deadline: now + actionSeconds * 1000, turnStartedAt: null };
  }
  if (budgetSeconds !== null && newPending.length > 0) {
    if (newPlayerTimes === null) {
      throw new GameBugError("budget-timed game has no playerTimes banks");
    }
    const minBank = Math.min(...newPending.map((seat) => newPlayerTimes[seat]));
    return { deadline: now + minBank, turnStartedAt: now };
  }
  if (budgetSeconds !== null) {
    // Budget mode with an empty pending set and no outcome: nothing to time.
    return { deadline: null, turnStartedAt: null };
  }
  if (turnSeconds !== null) {
    return { deadline: now + turnSeconds * 1000, turnStartedAt: null };
  }
  return { deadline: null, turnStartedAt: null };
}
