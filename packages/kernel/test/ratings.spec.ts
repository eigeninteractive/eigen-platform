import { describe, expect, it } from "vitest";
import { computeRatings, defaultRating, type PlayerInput } from "../src/ratings.js";

const base = defaultRating();

function seat(playerIndex: number, placement: number, overrides: Partial<PlayerInput> = {}): PlayerInput {
  return {
    playerIndex,
    userId: `user-${playerIndex}`,
    botId: null,
    placement,
    teamIndex: playerIndex,
    mu: base.mu,
    sigma: base.sigma,
    ...overrides,
  };
}

describe("computeRatings", () => {
  it("moves the winner up and the loser down", () => {
    const results = computeRatings([seat(0, 1), seat(1, 2)]);
    expect(results).toHaveLength(2);
    const winner = results.find((r) => r.identity.userId === "user-0");
    const loser = results.find((r) => r.identity.userId === "user-1");
    expect(winner?.mu).toBeGreaterThan(base.mu);
    expect(loser?.mu).toBeLessThan(base.mu);
    expect(winner?.sigma).toBeLessThan(base.sigma);
  });

  it("a draw between equal ratings moves nobody's mu", () => {
    const results = computeRatings([seat(0, 1), seat(1, 1)]);
    expect(results[0].mu).toBeCloseTo(results[1].mu, 10);
  });

  it("is deterministic", () => {
    const a = computeRatings([seat(0, 1), seat(1, 2)]);
    const b = computeRatings([seat(0, 1), seat(1, 2)]);
    expect(a).toEqual(b);
  });

  it("collapses a multi-seat bot into exactly one result", () => {
    const results = computeRatings([seat(0, 1), seat(1, 2, { userId: null, botId: "bot-x" }), seat(2, 3, { userId: null, botId: "bot-x" })]);
    expect(results).toHaveLength(2);
    const botResults = results.filter((r) => r.identity.botId === "bot-x");
    expect(botResults).toHaveLength(1);
    // Both of the bot's placements were losses to the human: the single net
    // update must land below the prior.
    expect(botResults[0].mu).toBeLessThan(base.mu);
  });

  it("a purged seat shapes the field but yields no result", () => {
    const results = computeRatings([seat(0, 1), seat(1, 2, { userId: null, botId: null })]);
    expect(results).toHaveLength(1);
    expect(results[0].identity).toEqual({ userId: "user-0", botId: null });
    expect(results[0].mu).toBeGreaterThan(base.mu);
  });

  it("rates seats sharing a teamIndex as one team", () => {
    const results = computeRatings([seat(0, 1, { teamIndex: 0 }), seat(1, 1, { teamIndex: 0 }), seat(2, 2, { teamIndex: 1 }), seat(3, 2, { teamIndex: 1 })]);
    expect(results).toHaveLength(4);
    const [w0, w1, l0, l1] = results.map((r) => r.mu);
    expect(w0).toBeGreaterThan(base.mu);
    expect(w1).toBeGreaterThan(base.mu);
    expect(l0).toBeLessThan(base.mu);
    expect(l1).toBeLessThan(base.mu);
  });
});
