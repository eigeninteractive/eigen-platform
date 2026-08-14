/**
 * The batched single-game readers: `readGame` (by id) and `readGameByCode`
 * (by short code). Both fold the games row and its roster into one D1 round
 * trip; `readGameByCode` does it through a subquery because it does not hold
 * the id. This pins that the roster each returns is correct, not just that it
 * is non-empty (the join-by-code route asserts the DO's roster, and the
 * deep-link landing page, the one consumer of `readGameByCode.participants`
 * for its "seats open" copy, is not otherwise covered).
 */

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { orm } from "../src/d1/orm.js";
import { readGame, readGameByCode } from "../src/d1/reads.js";
import { users } from "../src/d1/schema.js";
import { createGame } from "../src/index.js";
import { createReservationRow, userRow } from "./factories.js";

const db = orm(env.DB);

let seq = 0;

async function seedTwoSeatGame(): Promise<{ gameId: string; shortCode: string; a: string; b: string }> {
  const a = `reads-a-${crypto.randomUUID()}`;
  const b = `reads-b-${crypto.randomUUID()}`;
  const gameId = `reads-${++seq}-${crypto.randomUUID()}`;
  const shortCode = `RD${`${seq}`.padStart(4, "0")}`;
  const now = Date.now();
  await db
    .insert(users)
    .values([a, b].map((id) => userRow(id)))
    .run();
  await createGame(env.DB, {
    reservation: createReservationRow(),
    gameId,
    createdBy: a,
    status: "ready",
    access: "public",
    schemaVersion: 1,
    config: {},
    turnSeconds: null,
    budgetSeconds: null,
    incrementSeconds: null,
    rated: false,
    ratingPool: null,
    minPlayers: 2,
    maxPlayers: 2,
    shortCode,
    seats: [
      { playerIndex: 0, userId: a, botId: null, type: "human" },
      { playerIndex: 1, userId: b, botId: null, type: "human" },
    ],
    now,
  });
  return { gameId, shortCode, a, b };
}

describe("single-game readers", () => {
  it("readGameByCode returns the row and its full roster in code order", async () => {
    const { gameId, shortCode, a, b } = await seedTwoSeatGame();
    const game = await readGameByCode(env.DB, shortCode);
    expect(game?.id).toBe(gameId);
    // The subquery must resolve this game's seats: not none, not another
    // game's. Both seats, in playerIndex order.
    expect(game?.participants).toEqual([
      { playerIndex: 0, userId: a, botId: null, type: "human" },
      { playerIndex: 1, userId: b, botId: null, type: "human" },
    ]);
  });

  it("readGame returns the same roster by id", async () => {
    const { gameId, a, b } = await seedTwoSeatGame();
    const game = await readGame(env.DB, gameId);
    expect(game?.id).toBe(gameId);
    expect(game?.participants).toEqual([
      { playerIndex: 0, userId: a, botId: null, type: "human" },
      { playerIndex: 1, userId: b, botId: null, type: "human" },
    ]);
  });

  it("both return undefined for an unknown key", async () => {
    expect(await readGameByCode(env.DB, "NOSUCH")).toBeUndefined();
    expect(await readGame(env.DB, "no-such-id")).toBeUndefined();
  });
});
