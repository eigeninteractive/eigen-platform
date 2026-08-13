import { describe, expect, it } from "vitest";
import { type CommitInput, commit, isRejected } from "../src/commit.js";
import { GameBugError } from "../src/errors.js";
import { deriveRng } from "../src/rng.js";
import { DEADLINE_GRACE_MS } from "../src/timing.js";
import { makeGame, makeRoster, makeState, NOW, turnRules } from "./helpers.js";

function input(overrides: Partial<CommitInput> = {}): CommitInput {
  return {
    game: makeGame(),
    state: makeState(),
    roster: makeRoster(),
    intent: { kind: "action", seat: 0, expectedVersion: 4, data: { add: 1 }, actor: "user" },
    now: NOW,
    rules: turnRules,
    ...overrides,
  };
}

function expectPlan(result: ReturnType<typeof commit>) {
  if (isRejected(result)) {
    throw new Error(`expected a plan, got rejection: ${result.code}: ${result.message}`);
  }
  return result;
}

function expectRejection(result: ReturnType<typeof commit>, code: string) {
  if (!isRejected(result)) {
    throw new Error("expected a rejection, got a plan");
  }
  expect(result.code).toBe(code);
  return result;
}

describe("commit: start", () => {
  const startInput = (status: "waiting" | "ready" | "active") =>
    input({
      game: makeGame({ status }),
      state: null,
      intent: { kind: "start", seed: "base-seed" },
    });

  it("commits v0 from initialState with per-seat frames", () => {
    const plan = expectPlan(commit(startInput("ready")));
    expect(plan.nextState.version).toBe(0);
    expect(plan.nextState.state).toEqual({ count: 0 });
    expect(plan.nextState.pending).toEqual([0]);
    expect(plan.nextState.rngSeed).toBe("base-seed");
    expect(plan.action).toBeNull();
    expect(plan.frames.map((f) => f.playerIndex)).toEqual([0, 1]);
    expect(plan.outcomes).toBeNull();
  });

  it("is a clean no-op on an already active game", () => {
    expectRejection(commit(startInput("active")), "abstain");
  });

  it("rejects starting a game that is not ready", () => {
    expectRejection(commit(startInput("waiting")), "notReady");
  });

  it("initializes budget banks for every seat", () => {
    const plan = expectPlan(
      commit({
        ...startInput("ready"),
        game: makeGame({ status: "ready", budgetSeconds: 60 }),
      }),
    );
    expect(plan.nextState.playerTimes).toEqual([60_000, 60_000]);
    expect(plan.nextState.deadline).toBe(NOW + 60_000);
    expect(plan.alarm).toBe(NOW + 60_000 + DEADLINE_GRACE_MS + 1);
  });

  it("throws on an empty seed, which is a host bug", () => {
    expect(() => commit({ ...startInput("ready"), intent: { kind: "start", seed: "" } })).toThrow(GameBugError);
  });
});

describe("commit: game action", () => {
  it("commits the next serial version with the actor's log entry", () => {
    const plan = expectPlan(commit(input()));
    expect(plan.nextState.version).toBe(5);
    expect(plan.nextState.state).toEqual({ count: 5 });
    expect(plan.nextState.pending).toEqual([1]);
    expect(plan.action).toEqual({
      type: "user",
      kind: "game",
      data: { add: 1 },
      playerIndex: 0,
    });
    expect(plan.outcomes).toBeNull();
    expect(plan.frames).toHaveLength(2);
  });

  it("rejects when the game is not active", () => {
    expectRejection(commit(input({ game: makeGame({ status: "finished" }) })), "notActive");
  });

  it("rejects a seat that is not pending", () => {
    expectRejection(
      commit(
        input({
          intent: { kind: "action", seat: 1, expectedVersion: 4, data: { add: 1 }, actor: "user" },
        }),
      ),
      "notPending",
    );
  });

  it("rejects a payload failing the action schema", () => {
    expectRejection(
      commit(
        input({
          intent: { kind: "action", seat: 0, expectedVersion: 4, data: { add: "x" }, actor: "user" },
        }),
      ),
      "invalidPayload",
    );
  });

  it("rejects an illegal move via IllegalMoveError", () => {
    const rejection = expectRejection(
      commit(
        input({
          intent: { kind: "action", seat: 0, expectedVersion: 4, data: { add: 7 }, actor: "user" },
        }),
      ),
      "illegalMove",
    );
    expect(rejection.message).toBe("add must be 1-3");
  });

  it("finishes the game with validated outcomes and cleared clocks", () => {
    const plan = expectPlan(
      commit(
        input({
          state: makeState({ state: { count: 9 } }),
          intent: { kind: "action", seat: 0, expectedVersion: 4, data: { add: 1 }, actor: "user" },
        }),
      ),
    );
    expect(plan.outcomes).not.toBeNull();
    expect(plan.outcomes?.[0]).toMatchObject({ playerIndex: 0, result: "win" });
    expect(plan.nextState.deadline).toBeNull();
    expect(plan.alarm).toBeNull();
    expect(plan.effects).toEqual([{ kind: "notifyFinished", userIds: ["user-a", "user-b"] }]);
  });
});

describe("commit: deadline + grace", () => {
  const timed = (deadline: number) =>
    input({
      game: makeGame({ turnSeconds: 30 }),
      state: makeState({ deadline, turnStartedAt: deadline - 30_000 }),
    });

  it("accepts a latent action inside the grace window", () => {
    const plan = expectPlan(commit(timed(NOW - DEADLINE_GRACE_MS)));
    expect(plan.nextState.version).toBe(5);
  });

  it("rejects one millisecond past deadline + grace", () => {
    expectRejection(commit(timed(NOW - DEADLINE_GRACE_MS - 1)), "expired");
  });

  it("arms the next alarm just after the new deadline + grace", () => {
    const plan = expectPlan(commit(timed(NOW - 100)));
    expect(plan.nextState.deadline).toBe(NOW + 30_000);
    expect(plan.alarm).toBe(NOW + 30_000 + DEADLINE_GRACE_MS + 1);
  });
});

describe("commit: same-view rule", () => {
  const stale = (staleViews: CommitInput["staleViews"]) =>
    input({
      intent: { kind: "action", seat: 0, expectedVersion: 3, data: { add: 1 }, actor: "user" },
      staleViews,
    });

  const view = { data: { count: 4 }, pendingPlayers: [0] };

  it("accepts a stale action when the seat's view is unchanged, as the next serial version", () => {
    const plan = expectPlan(commit(stale({ expected: view, current: { ...view } })));
    expect(plan.nextState.version).toBe(5);
  });

  it("rejects when the seat's view changed", () => {
    expectRejection(
      commit(
        stale({
          expected: view,
          current: { data: { count: 5 }, pendingPlayers: [0] },
        }),
      ),
      "stateUpdated",
    );
  });

  it("rejects when the observed pending set changed, even with identical data", () => {
    expectRejection(
      commit(
        stale({
          expected: view,
          current: { data: { count: 4 }, pendingPlayers: [0, 1] },
        }),
      ),
      "stateUpdated",
    );
  });

  it("rejects conservatively when frames are missing", () => {
    expectRejection(commit(stale(undefined)), "stateUpdated");
    expectRejection(commit(stale({ expected: null, current: view })), "stateUpdated");
  });

  it("rejects an expectedVersion ahead of the game", () => {
    expectRejection(
      commit(
        input({
          intent: { kind: "action", seat: 0, expectedVersion: 9, data: { add: 1 }, actor: "user" },
        }),
      ),
      "stateUpdated",
    );
  });
});

describe("commit: budget banks", () => {
  const budgetInput = () =>
    input({
      game: makeGame({ budgetSeconds: 60, incrementSeconds: 2 }),
      state: makeState({
        playerTimes: [50_000, 60_000],
        deadline: NOW + 46_000,
        turnStartedAt: NOW - 4_000,
      }),
    });

  it("deducts elapsed time and applies the increment", () => {
    const plan = expectPlan(commit(budgetInput()));
    expect(plan.nextState.playerTimes).toEqual([48_000, 60_000]);
    // Next deadline = the incoming pending seat's remaining bank.
    expect(plan.nextState.deadline).toBe(NOW + 60_000);
    expect(plan.nextState.turnStartedAt).toBe(NOW);
  });

  it("charges the budget turn that ended before starting an override", () => {
    const base = budgetInput();
    const plan = expectPlan(
      commit({
        ...base,
        intent: { kind: "action", seat: 0, expectedVersion: 4, data: { add: 1, boost: true }, actor: "user" },
      }),
    );
    expect(plan.nextState.playerTimes).toEqual([48_000, 60_000]);
    expect(plan.nextState.deadline).toBe(NOW + 5_000);
    expect(plan.nextState.turnStartedAt).toBeNull();
  });

  it("does not charge an override before returning to the budget clock", () => {
    const plan = expectPlan(
      commit({
        ...budgetInput(),
        state: makeState({
          playerTimes: [50_000, 60_000],
          deadline: NOW + 1_000,
          turnStartedAt: null,
        }),
      }),
    );
    expect(plan.nextState.playerTimes).toEqual([50_000, 60_000]);
    expect(plan.nextState.deadline).toBe(NOW + 60_000);
    expect(plan.nextState.turnStartedAt).toBe(NOW);
  });

  it("charges a budget turn when its action finishes the game", () => {
    const base = budgetInput();
    const plan = expectPlan(
      commit({
        ...base,
        state: makeState({
          state: { count: 9 },
          playerTimes: [50_000, 60_000],
          deadline: NOW + 46_000,
          turnStartedAt: NOW - 4_000,
        }),
      }),
    );
    expect(plan.outcomes).not.toBeNull();
    expect(plan.nextState.playerTimes).toEqual([48_000, 60_000]);
  });

  it("does not charge an override when its action finishes the game", () => {
    const plan = expectPlan(
      commit({
        ...budgetInput(),
        state: makeState({
          state: { count: 9 },
          playerTimes: [50_000, 60_000],
          deadline: NOW + 1_000,
          turnStartedAt: null,
        }),
      }),
    );
    expect(plan.outcomes).not.toBeNull();
    expect(plan.nextState.playerTimes).toEqual([50_000, 60_000]);
  });

  it("matches a reference clock across generated budget/override sequences", () => {
    const sequenceLength = 8;
    for (let mask = 0; mask < 1 << sequenceLength; mask += 1) {
      let now = NOW;
      let state = makeState({
        version: 0,
        state: { count: 0 },
        pending: [0],
        playerTimes: [60_000, 60_000],
        deadline: NOW + 60_000,
        turnStartedAt: NOW,
      });
      const expectedBanks = [60_000, 60_000];
      let currentTurnConsumesBudget = true;

      for (let step = 0; step < sequenceLength; step += 1) {
        const elapsed = 250 + step * 125;
        now += elapsed;
        const seat = state.pending[0];
        const nextTurnIsOverride = (mask & (1 << step)) !== 0;

        if (currentTurnConsumesBudget) {
          expectedBanks[seat] = Math.max(0, expectedBanks[seat] - elapsed) + 2_000;
        }

        const plan = expectPlan(
          commit(
            input({
              game: makeGame({ budgetSeconds: 60, incrementSeconds: 2, config: { target: 100 } }),
              state,
              intent: {
                kind: "action",
                seat,
                expectedVersion: state.version,
                data: { add: 1, ...(nextTurnIsOverride ? { boost: true } : {}) },
                actor: "user",
              },
              now,
            }),
          ),
        );

        expect(plan.nextState.playerTimes, `mask ${mask}, step ${step}`).toEqual(expectedBanks);
        expect(plan.nextState.turnStartedAt, `mask ${mask}, step ${step}`).toBe(nextTurnIsOverride ? null : now);
        state = plan.nextState;
        currentTurnConsumesBudget = !nextTurnIsOverride;
      }
    }
  });
});

describe("commit: timeout", () => {
  const timeoutInput = (overrides: Partial<CommitInput> = {}) =>
    input({
      intent: { kind: "lifecycle", type: "timeout" },
      state: makeState({ deadline: NOW - DEADLINE_GRACE_MS - 1 }),
      ...overrides,
    });

  it("abstains while the deadline has not genuinely expired", () => {
    expectRejection(commit(timeoutInput({ state: makeState({ deadline: NOW - DEADLINE_GRACE_MS }) })), "abstain");
  });

  it("abstains on a no-longer-active game", () => {
    expectRejection(commit(timeoutInput({ game: makeGame({ status: "finished" }) })), "abstain");
  });

  it("commits one identity-less system transition resolving the pending set", () => {
    const plan = expectPlan(commit(timeoutInput()));
    expect(plan.action).toEqual({
      type: "system",
      kind: "lifecycle",
      data: { type: "timeout" },
      playerIndex: null,
    });
    // Test rules: the sole pending seat (0) loses on timeout.
    expect(plan.outcomes).not.toBeNull();
    expect(plan.outcomes?.find((o) => o.playerIndex === 0)?.result).toBe("loss");
  });

  it("zeroes every pending seat's bank in budget mode", () => {
    const plan = expectPlan(
      commit(
        timeoutInput({
          game: makeGame({ budgetSeconds: 60 }),
          state: makeState({
            pending: [0],
            playerTimes: [7_000, 42_000],
            deadline: NOW - DEADLINE_GRACE_MS - 1,
            turnStartedAt: NOW - 10_000,
          }),
        }),
      ),
    );
    expect(plan.nextState.playerTimes).toEqual([0, 42_000]);
  });

  it("leaves the underlying bank untouched when an override times out", () => {
    const plan = expectPlan(
      commit(
        timeoutInput({
          game: makeGame({ budgetSeconds: 60 }),
          state: makeState({
            pending: [0],
            playerTimes: [7_000, 42_000],
            deadline: NOW - DEADLINE_GRACE_MS - 1,
            turnStartedAt: null,
          }),
        }),
      ),
    );
    expect(plan.nextState.playerTimes).toEqual([7_000, 42_000]);
  });
});

describe("commit: forfeit / autoForfeit", () => {
  it("records a resign as the user's own lifecycle action", () => {
    const plan = expectPlan(commit(input({ intent: { kind: "lifecycle", type: "forfeit", seat: 0 } })));
    expect(plan.action).toEqual({
      type: "user",
      kind: "lifecycle",
      data: { type: "forfeit", playerIndex: 0 },
      playerIndex: 0,
    });
    expect(plan.outcomes?.find((o) => o.playerIndex === 0)?.result).toBe("loss");
  });

  it("records an auto-forfeit as an identity-less system action", () => {
    const plan = expectPlan(commit(input({ intent: { kind: "lifecycle", type: "autoForfeit", seat: 1 } })));
    expect(plan.action).toEqual({
      type: "system",
      kind: "lifecycle",
      data: { type: "autoForfeit", playerIndex: 1 },
      playerIndex: null,
    });
  });

  it("rejects when the game is not active (unlike timeout, loudly)", () => {
    expectRejection(
      commit(
        input({
          game: makeGame({ status: "finished" }),
          intent: { kind: "lifecycle", type: "forfeit", seat: 0 },
        }),
      ),
      "notActive",
    );
  });

  it("throws when the hook leaves the forfeited seat pending", () => {
    const badRules = {
      ...turnRules,
      applyLifecycle: () => ({ state: { count: 1 }, pendingPlayers: [0] }),
    };
    expect(() =>
      commit(
        input({
          rules: badRules,
          intent: { kind: "lifecycle", type: "forfeit", seat: 0 },
        }),
      ),
    ).toThrow(GameBugError);
  });
});

describe("commit: rated finish", () => {
  // Rating deltas are not the kernel's to compute at commit time; they need
  // global priors (D1-domain data). The plan carries outcomes only; the D1
  // applier computes deltas inside the rating CAS and the host delivers them
  // as a follow-up versioned ratings transition.
  it("finishes a rated game with outcomes and no rating material in the plan", () => {
    const plan = expectPlan(
      commit(
        input({
          game: makeGame({ rated: true, ratingPool: "main" }),
          state: makeState({ state: { count: 9 } }),
        }),
      ),
    );
    expect(plan.outcomes).not.toBeNull();
    expect("ratings" in plan).toBe(false);
  });
});

describe("commit: effects", () => {
  it("wakes a pending bot and notifies a pending human, skipping the actor", () => {
    const roster = makeRoster();
    roster[1] = { playerIndex: 1, userId: null, botId: "bot-1", type: "bot" };
    const plan = expectPlan(commit(input({ roster })));
    expect(plan.effects).toEqual([{ kind: "wakeBot", seat: 1, botId: "bot-1" }]);
  });

  it("emits no frame for a purged seat", () => {
    const roster = makeRoster();
    roster[1] = { playerIndex: 1, userId: null, botId: null, type: "human" };
    const plan = expectPlan(
      commit(
        input({
          roster,
          // Keep pending on the identified seat so the guard passes.
          state: makeState({ state: { count: 9 } }),
        }),
      ),
    );
    expect(plan.frames.map((f) => f.playerIndex)).toEqual([0]);
  });
});

describe("deriveRng", () => {
  it("yields an identical stream for the same (seed, version)", () => {
    const a = deriveRng("seed", 3);
    const b = deriveRng("seed", 3);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("yields independent streams per version and per seed", () => {
    expect(deriveRng("seed", 3).next()).not.toBe(deriveRng("seed", 4).next());
    expect(deriveRng("seed", 3).next()).not.toBe(deriveRng("other", 3).next());
  });
});
