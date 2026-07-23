/**
 * The rating write's compare-and-swap.
 *
 * The hazard is a lost update across two DIFFERENT games that share a player
 * and finish at the same moment: both read the same prior, both compute from
 * it, and whichever commits second overwrites the first — the player's rating
 * moves as if only one game happened.
 *
 * The guard is `idx_rating_history_{user,bot}_cas`: every history row is
 * stamped with the `player_ratings.revision` its delta was computed against,
 * and that triple is unique per identity+pool. A second finish computing
 * against the same revision collides, its `batch()` rolls back, and
 * `applyFinish` recomputes against fresh priors.
 */

import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "../src/d1/apply.js";
import { playerRatings, ratingHistory, users } from "../src/d1/schema.js";
import { applyFinish, createGame } from "../src/index.js";

const db = drizzle(env.DB);
const POOL = "cas-pool";

let seq = 0;

/** A rated 2-seat game between the two named users, ready to finish. */
async function seedRatedGame(a: string, b: string): Promise<string> {
  const gameId = `cas-${++seq}-${crypto.randomUUID()}`;
  const now = Date.now();
  await db
    .insert(users)
    .values([a, b].map((id) => ({ id, username: id, email: null, displayName: id, avatarUrl: null, isAnonymous: false, createdAt: now, updatedAt: now })))
    .onConflictDoNothing()
    .run();
  await createGame(env.DB, {
    gameId,
    createdBy: a,
    status: "ready",
    access: "public",
    schemaVersion: 1,
    config: {},
    turnSeconds: null,
    budgetSeconds: null,
    incrementSeconds: null,
    rated: true,
    ratingPool: POOL,
    minPlayers: 2,
    maxPlayers: 2,
    shortCode: `${gameId.slice(0, 6)}${seq}`,
    seats: [
      { player_index: 0, user_id: a, bot_id: null, type: "human" },
      { player_index: 1, user_id: b, bot_id: null, type: "human" },
    ],
    now,
  });
  return gameId;
}

/** Finish `gameId` with seat 0 winning. */
function finish(gameId: string, a: string, b: string) {
  return applyFinish(env.DB, {
    gameId,
    finishId: `finish-${gameId}`,
    outcomes: [
      { player_index: 0, result: "win", placement: 1, team_index: 0 },
      { player_index: 1, result: "loss", placement: 2, team_index: 1 },
    ],
    roster: [
      { player_index: 0, user_id: a, bot_id: null, type: "human" },
      { player_index: 1, user_id: b, bot_id: null, type: "human" },
    ],
    rated: true,
    ratingPool: POOL,
    now: Date.now(),
  });
}

describe("rating CAS", () => {
  // NOTE: this does not reproduce the race — local D1 serializes the two
  // applies, so both observe the other's commit and neither has to retry.
  // It pins the *shape* the CAS produces (a gapless revision chain, each
  // delta computed from the previous one's result), which is what a lost
  // update would visibly break. The index that makes that shape enforceable
  // under real concurrency is covered by the next test.
  it("chains revisions across two finishes sharing a player, with no lost update", async () => {
    const shared = `shared-${crypto.randomUUID()}`;
    const oppA = `opp-a-${crypto.randomUUID()}`;
    const oppB = `opp-b-${crypto.randomUUID()}`;
    const [g1, g2] = await Promise.all([seedRatedGame(shared, oppA), seedRatedGame(shared, oppB)]);

    await Promise.all([finish(g1, shared, oppA), finish(g2, shared, oppB)]);

    const rating = await db
      .select()
      .from(playerRatings)
      .where(and(eq(playerRatings.userId, shared), eq(playerRatings.pool, POOL)))
      .get();
    expect(rating?.revision).toBe(2); // one bump per finish, neither lost

    const log = await db
      .select()
      .from(ratingHistory)
      .where(and(eq(ratingHistory.userId, shared), eq(ratingHistory.pool, POOL)))
      .orderBy(ratingHistory.revisionBefore)
      .all();
    expect(log).toHaveLength(2);
    expect(log.map((r) => r.revisionBefore)).toEqual([0, 1]);

    // The chain is unbroken: the second finish started from where the first
    // ended. Under a lost update these would both read the default prior.
    expect(log[1].muBefore).toBe(log[0].muAfter);
    expect(log[1].sigmaBefore).toBe(log[0].sigmaAfter);
    expect(rating?.mu).toBe(log[1].muAfter);
  });

  it("rejects a second history row computed against an already-consumed revision", async () => {
    // The index in isolation — the mechanism every recompute above depends on.
    const user = `dup-${crypto.randomUUID()}`;
    const now = Date.now();
    const row = {
      userId: user,
      botId: null,
      pool: POOL,
      revisionBefore: 0,
      muBefore: 25,
      sigmaBefore: 8.333,
      displayBefore: 0,
      muAfter: 26,
      sigmaAfter: 8.2,
      displayAfter: 40,
      displayChange: 40,
      createdAt: now,
    };
    await db.insert(ratingHistory).values({ ...row, id: crypto.randomUUID(), gameId: `g1-${user}`, finishId: `f1-${user}` });

    // A different game, same identity+pool, same revision — the lost-update
    // shape. It must not be storable, and `applyFinish` must recognise the
    // rejection as retryable. Note the constraint text is NOT in the
    // top-level message: drizzle rethrows with its own "Failed query: ...",
    // so a naive `error.message` test would classify this as fatal and
    // disable the CAS retry entirely.
    const conflict = await db
      .insert(ratingHistory)
      .values({ ...row, id: crypto.randomUUID(), gameId: `g2-${user}`, finishId: `f2-${user}` })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(conflict).toBeInstanceOf(Error);
    expect((conflict as Error).message).not.toMatch(/UNIQUE constraint failed/i);
    expect(isUniqueViolation(conflict)).toBe(true);

    // The next revision is fine: that is a legitimate sequential finish.
    await db.insert(ratingHistory).values({ ...row, id: crypto.randomUUID(), gameId: `g2-${user}`, finishId: `f2-${user}`, revisionBefore: 1 });
    const stored = await db.select().from(ratingHistory).where(eq(ratingHistory.userId, user)).all();
    expect(stored).toHaveLength(2);
  });
});
