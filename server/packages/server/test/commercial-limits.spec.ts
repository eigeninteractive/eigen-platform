/** Atomic commercial-meter and live-capacity invariants at the D1 boundary. */

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { CommercialLimitWriteError, type CreateGameInput, createGame, mirrorRoster } from "../src/d1/apply.js";
import { isCommercialLimitReached, isSlotContention } from "../src/d1/errors.js";
import { orm } from "../src/d1/orm.js";
import { commerceCapacity, commerceUsage, creationOperations, games } from "../src/d1/schema.js";

const db = orm(env.DB);

function input(userId: string, operationId: string): CreateGameInput {
  const gameId = crypto.randomUUID();
  return {
    gameId,
    createdBy: userId,
    status: "waiting",
    access: "public",
    origin: "online",
    schemaVersion: 1,
    config: { target: 3 },
    turnSeconds: null,
    budgetSeconds: null,
    incrementSeconds: null,
    rated: false,
    ratingPool: null,
    minPlayers: 2,
    maxPlayers: 2,
    shortCode: crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase(),
    seats: [
      {
        playerIndex: 0,
        userId,
        botId: null,
        type: "human",
      },
    ],
    createdAt: Date.now(),
    now: Date.now(),
    creation: {
      creatorId: userId,
      creationId: operationId,
      fingerprint: `fingerprint-${operationId}`,
    },
  };
}

describe("commercial create limits", () => {
  it("rolls back the entire create when a period has no free usage slot", async () => {
    const userId = `meter-${crypto.randomUUID()}`;
    const first = input(userId, crypto.randomUUID());
    first.usage = [
      {
        metric: "game.create.success",
        periodKey: "calendarMonth:2026-09",
        maximum: 1,
        operationId: first.creation?.creationId as string,
      },
    ];
    await createGame(env.DB, first);

    const second = input(userId, crypto.randomUUID());
    second.usage = [
      {
        metric: "game.create.success",
        periodKey: "calendarMonth:2026-09",
        maximum: 1,
        operationId: second.creation?.creationId as string,
      },
    ];
    await expect(createGame(env.DB, second)).rejects.toBeInstanceOf(CommercialLimitWriteError);

    expect(await db.select().from(games).where(eq(games.id, second.gameId)).get()).toBeUndefined();
    expect(await db.select().from(creationOperations).where(eq(creationOperations.gameId, second.gameId)).get()).toBeUndefined();
    const uses = await db.select().from(commerceUsage).where(eq(commerceUsage.userId, userId)).all();
    expect(uses).toHaveLength(1);
  });

  it("releases concurrent creation capacity when a game becomes terminal", async () => {
    const userId = `capacity-${crypto.randomUUID()}`;
    const first = input(userId, crypto.randomUUID());
    first.capacity = { maximum: 1 };
    await createGame(env.DB, first);

    const second = input(userId, crypto.randomUUID());
    second.capacity = { maximum: 1 };
    await expect(createGame(env.DB, second)).rejects.toBeInstanceOf(CommercialLimitWriteError);

    await mirrorRoster(env.DB, {
      gameId: first.gameId,
      status: "aborted",
      seats: [],
      seq: 1,
      now: Date.now(),
    });
    await createGame(env.DB, second);

    const capacity = await db.select().from(commerceCapacity).where(eq(commerceCapacity.userId, userId)).all();
    expect(capacity).toHaveLength(1);
    expect(capacity[0]?.gameId).toBe(second.gameId);
  });

  it("records usage under unlimited access without enforcing a ceiling", async () => {
    const userId = `unlimited-${crypto.randomUUID()}`;
    for (let index = 0; index < 2; index++) {
      const operationId = crypto.randomUUID();
      const game = input(userId, operationId);
      game.usage = [
        {
          metric: "game.create.success",
          periodKey: "calendarMonth:2026-09",
          maximum: null,
          operationId,
        },
      ];
      await createGame(env.DB, game);
    }

    const uses = await db.select().from(commerceUsage).where(eq(commerceUsage.userId, userId)).all();
    expect(uses).toHaveLength(2);
  });
});

describe("a spent allowance and a lost race", () => {
  // The guarded insert reports both on the same column, and they mean opposite
  // things: NOT NULL is the insert declining to produce a slot because the
  // allowance is spent, UNIQUE is another of this account's writes having taken
  // the number first while there was still room. Reading the second as the
  // first tells a player under their limit that they have reached it.
  const d1 = (message: string) => new Error(`D1_ERROR: ${message}`, { cause: new Error(message) });

  it("reads a refused slot as the allowance being spent", () => {
    for (const table of ["commerce_usage", "commerce_capacity"]) {
      const error = d1(`NOT NULL constraint failed: ${table}.slot`);
      expect(isCommercialLimitReached(error)).toBe(true);
      expect(isSlotContention(error)).toBe(false);
    }
  });

  it("reads a duplicate slot as contention, whatever else the index covers", () => {
    // SQLite names every column of the index, not just the one that clashed.
    const error = d1("UNIQUE constraint failed: commerce_usage.user_id, commerce_usage.metric, commerce_usage.period_key, commerce_usage.slot");
    expect(isSlotContention(error)).toBe(true);
    expect(isCommercialLimitReached(error)).toBe(false);
  });

  it("claims neither for an unrelated constraint", () => {
    const error = d1("UNIQUE constraint failed: games.short_code");
    expect(isCommercialLimitReached(error)).toBe(false);
    expect(isSlotContention(error)).toBe(false);
  });

  it("admits every concurrent creation that fits inside the allowance", async () => {
    const userId = `race-${crypto.randomUUID()}`;
    const creates = [1, 2, 3].map(() => {
      const value = input(userId, crypto.randomUUID());
      value.usage = [
        {
          metric: "game.create.success",
          periodKey: "calendarMonth:2026-09",
          maximum: 5,
          operationId: value.creation?.creationId as string,
        },
      ];
      return value;
    });

    const settled = await Promise.allSettled(creates.map((value) => createGame(env.DB, value)));

    // Whether D1 serializes these or not, three creations against an allowance
    // of five must never be refused for want of allowance.
    for (const result of settled) {
      if (result.status === "rejected") expect(result.reason).not.toBeInstanceOf(CommercialLimitWriteError);
    }
  });
});
