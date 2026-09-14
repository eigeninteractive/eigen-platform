/** Atomic commercial-meter and live-capacity invariants at the D1 boundary. */

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { CommercialLimitWriteError, type CreateGameInput, createGame, mirrorRoster } from "../src/d1/apply.js";
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
