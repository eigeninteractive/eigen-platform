import { describe, expect, it } from "vitest";
import { GameBugError } from "../src/errors.js";
import { computeNextDeadline, DEADLINE_GRACE_MS, deadlineExpired, deductBank } from "../src/timing.js";

const NOW = 1_800_000_000_000;

describe("deadlineExpired", () => {
  it("is never expired for an untimed turn", () => {
    expect(deadlineExpired(null, NOW)).toBe(false);
  });

  it("accepts up to and including deadline + grace", () => {
    const deadline = NOW - DEADLINE_GRACE_MS;
    expect(deadlineExpired(deadline, NOW)).toBe(false);
  });

  it("expires one millisecond past deadline + grace", () => {
    const deadline = NOW - DEADLINE_GRACE_MS - 1;
    expect(deadlineExpired(deadline, NOW)).toBe(true);
  });
});

describe("deductBank", () => {
  it("charges elapsed time against the acting seat only", () => {
    const times = deductBank([60_000, 60_000], 0, NOW, NOW - 4_000, null);
    expect(times).toEqual([56_000, 60_000]);
  });

  it("floors an overrun bank at zero", () => {
    const times = deductBank([3_000, 60_000], 0, NOW, NOW - 10_000, null);
    expect(times[0]).toBe(0);
  });

  it("adds the Fischer increment after deduction", () => {
    const times = deductBank([60_000, 60_000], 1, NOW, NOW - 4_000, 5);
    expect(times).toEqual([60_000, 61_000]);
  });

  it("grants the increment even from a floored bank", () => {
    const times = deductBank([1_000, 60_000], 0, NOW, NOW - 10_000, 2);
    expect(times[0]).toBe(2_000);
  });

  it("never charges negative elapsed (clock skew)", () => {
    const times = deductBank([60_000, 60_000], 0, NOW, NOW + 500, null);
    expect(times[0]).toBe(60_000);
  });

  it("throws on a null turnStartedAt — a game bug", () => {
    expect(() => deductBank([60_000], 0, NOW, null, null)).toThrow(GameBugError);
  });

  it("does not mutate the input array", () => {
    const input = [60_000, 60_000];
    deductBank(input, 0, NOW, NOW - 4_000, null);
    expect(input).toEqual([60_000, 60_000]);
  });
});

describe("computeNextDeadline precedence chain", () => {
  it("1. game over clears deadline and turnStartedAt", () => {
    const next = computeNextDeadline({
      now: NOW,
      gameOver: true,
      actionSeconds: 5,
      budgetSeconds: 60,
      turnSeconds: null,
      newPending: [],
      newPlayerTimes: [1_000, 2_000],
    });
    expect(next).toEqual({ deadline: null, turnStartedAt: null });
  });

  it("2. a hook override wins over budget and per-action", () => {
    const next = computeNextDeadline({
      now: NOW,
      gameOver: false,
      actionSeconds: 10,
      budgetSeconds: 60,
      turnSeconds: null,
      newPending: [0],
      newPlayerTimes: [30_000, 30_000],
    });
    expect(next).toEqual({ deadline: NOW + 10_000, turnStartedAt: NOW });
  });

  it("3. budget mode arms at the minimum remaining bank over pending", () => {
    const next = computeNextDeadline({
      now: NOW,
      gameOver: false,
      actionSeconds: null,
      budgetSeconds: 60,
      turnSeconds: null,
      newPending: [0, 1],
      newPlayerTimes: [30_000, 12_000],
    });
    expect(next).toEqual({ deadline: NOW + 12_000, turnStartedAt: NOW });
  });

  it("4. per-action mode uses the configured window", () => {
    const next = computeNextDeadline({
      now: NOW,
      gameOver: false,
      actionSeconds: null,
      budgetSeconds: null,
      turnSeconds: 45,
      newPending: [1],
      newPlayerTimes: null,
    });
    expect(next).toEqual({ deadline: NOW + 45_000, turnStartedAt: NOW });
  });

  it("5. untimed has neither deadline nor turnStartedAt", () => {
    const next = computeNextDeadline({
      now: NOW,
      gameOver: false,
      actionSeconds: null,
      budgetSeconds: null,
      turnSeconds: null,
      newPending: [0],
      newPlayerTimes: null,
    });
    expect(next).toEqual({ deadline: null, turnStartedAt: null });
  });

  it("a drained bank produces an immediate deadline (flag-fall)", () => {
    const next = computeNextDeadline({
      now: NOW,
      gameOver: false,
      actionSeconds: null,
      budgetSeconds: 60,
      turnSeconds: null,
      newPending: [1],
      newPlayerTimes: [30_000, 0],
    });
    expect(next.deadline).toBe(NOW);
  });

  it("throws when a budget game arrives without banks", () => {
    expect(() =>
      computeNextDeadline({
        now: NOW,
        gameOver: false,
        actionSeconds: null,
        budgetSeconds: 60,
        turnSeconds: null,
        newPending: [0],
        newPlayerTimes: null,
      }),
    ).toThrow(GameBugError);
  });
});
