/**
 * The canonical same-view scenario pair, driven
 * through the real kernel `commit()` with the real RPS rules:
 *
 * - ACCEPT: an opponent's hidden commit doesn't change your projected view,
 *   so your stale-version submission still lands — RPS works with zero game
 *   code, and versions stay strictly serial (A commits N+1, stale-but-same B
 *   commits N+2).
 * - REJECT: the round *resolution* (reveal) changes your view, so anything
 *   computed against the previous round is refused with "state updated".
 */

import type { JsonObject } from "@eigen/rules";
import { type CommitInput, type CommitPlan, commit, type GameRow, isRejected, projectView, type Seat, type StateRow } from "@eigen/testkit";
import { describe, expect, it } from "vitest";
import { rulesV1 } from "../../src/rules/v1.js";

const NOW = 1_800_000_000_000;

const game: GameRow = {
  status: "active",
  schemaVersion: 1,
  config: { targetWins: 2 },
  turnSeconds: null,
  budgetSeconds: null,
  incrementSeconds: null,
  rated: false,
  ratingPool: null,
};

const roster: Seat[] = [
  { player_index: 0, user_id: "user-a", bot_id: null, type: "human" },
  { player_index: 1, user_id: "user-b", bot_id: null, type: "human" },
];

/** v4: a fresh round, both seats pending, nothing committed. */
const v4: StateRow = {
  version: 4,
  state: { round: 1, wins: [0, 0], commits: [null, null], lastRound: null },
  pending: [0, 1],
  rngSeed: "same-view-seed",
  deadline: null,
  playerTimes: null,
  turnStartedAt: null,
};

function frameFor(state: StateRow, seat: number) {
  return projectView(rulesV1, {
    state: state.state,
    pending: state.pending,
    seat,
    config: game.config,
  });
}

function action(seat: number, move: string, expectedVersion: number, extras: Partial<CommitInput> = {}): CommitInput {
  return {
    game,
    state: v4,
    roster,
    intent: { kind: "action", seat, expectedVersion, data: { move }, actor: "user" },
    now: NOW,
    rules: rulesV1,
    ...extras,
  };
}

function expectPlan(result: CommitPlan | { rejected: true }): CommitPlan {
  if (isRejected(result as never)) throw new Error("expected a plan");
  return result as CommitPlan;
}

describe("same-view rule over real RPS rules", () => {
  it("accepts the second simultaneous commit at a stale version — strictly serial", () => {
    // A commits rock against v4 → commits as v5.
    const planA = expectPlan(commit(action(0, "rock", 4)));
    expect(planA.nextState.version).toBe(5);
    const v5 = planA.nextState;

    // B's view did not change: A's commit is hidden and A's pending status
    // is masked. B submits paper still expecting v4.
    const expected = frameFor(v4, 1);
    const current = frameFor(v5, 1);
    expect(current).toEqual(expected); // the crux — B literally can't tell

    const planB = expectPlan(
      commit(
        action(1, "paper", 4, {
          state: v5,
          staleViews: { expected, current },
        }),
      ),
    );
    // Accepted, and committed as the NEXT serial version — no forks, no gaps.
    expect(planB.nextState.version).toBe(6);
    // The round resolved: paper beats rock.
    expect(planB.nextState.state).toMatchObject({
      round: 2,
      wins: [0, 1],
      lastRound: { moves: ["rock", "paper"], winner: 1 },
    });
  });

  it("rejects a submission computed before the reveal — the view genuinely changed", () => {
    // Play the round out to v6 (resolved, revealed).
    const planA = expectPlan(commit(action(0, "rock", 4)));
    const v5 = planA.nextState;
    const planB = expectPlan(
      commit(
        action(1, "paper", 4, {
          state: v5,
          staleViews: { expected: frameFor(v4, 1), current: frameFor(v5, 1) },
        }),
      ),
    );
    const v6 = planB.nextState;

    // Seat 0 now submits a round-2 move it computed back at v4 — but its view
    // moved (lastRound revealed, wins changed): genuine conflict.
    const result = commit(
      action(0, "scissors", 4, {
        state: v6,
        staleViews: { expected: frameFor(v4, 0), current: frameFor(v6, 0) },
      }),
    );
    if (!isRejected(result)) throw new Error("expected a rejection");
    expect(result.code).toBe("state_updated");
  });

  it("rejects conservatively when the stale frame is unavailable", () => {
    const planA = expectPlan(commit(action(0, "rock", 4)));
    const result = commit(
      action(1, "paper", 4, { state: planA.nextState }), // no staleViews
    );
    if (!isRejected(result)) throw new Error("expected a rejection");
    expect(result.code).toBe("state_updated");
  });

  it("hides the opponent's commit in every live frame (leak check)", () => {
    const planA = expectPlan(commit(action(0, "rock", 4)));
    for (const frame of planA.frames) {
      const data = frame.data as JsonObject;
      expect(data.commits).toBeUndefined();
      if (frame.player_index === 1) {
        expect(data.yourMove).toBeNull();
        // Seat 1 sees only its own pending status.
        expect(frame.pending_players).toEqual([1]);
      }
    }
  });
});
