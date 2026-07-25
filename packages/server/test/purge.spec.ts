/**
 * Account deletion & the cron backstop: the
 * delete-account route, the stale-guest purge and abandoned-game reap run by
 * the `scheduled` handler, and the applyFinish purge guard that keeps a
 * deleted identity from being re-rated by a later finish.
 *
 * FIREBASE_* is unset in the test worker, so `purgeUser` skips the Firebase
 * call and purges D1 directly — exactly the documented no-service-account path.
 */

import { env, exports } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyFinish, createGame } from "../src/d1/apply.js";
import { orm } from "../src/d1/orm.js";
import { games, participants, playerRatings, ratingHistory, users } from "../src/d1/schema.js";
import { testBearer as bearer } from "../src/testing.js";
import { userRow } from "./factories.js";
import worker from "./worker.js";

const db = orm(env.DB);

async function api(uid: string, method: string, path: string, body?: unknown, anonymous = false): Promise<Response> {
  return await exports.default.fetch(`https://x/api/engine${path}`, {
    method,
    headers: { ...(await bearer({ uid, anonymous })), "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return (await res.json()) as T;
}

const createBody = { access: "public" as const, schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2 };
const uid = (tag: string) => `${tag}-${crypto.randomUUID()}`;

/** Provision a user (guest or not) by making one authed request. */
async function provision(id: string, anonymous = false): Promise<void> {
  expect((await api(id, "GET", "/me", undefined, anonymous)).status).toBe(200);
}

/** Fire the cron `scheduled` handler in-band against the real bindings. */
async function runCron(): Promise<void> {
  await worker.scheduled?.({ scheduledTime: Date.now(), cron: "0 3 * * *", noRetry() {} } as ScheduledController, env, {} as ExecutionContext);
}

afterEach(() => vi.restoreAllMocks());

describe("delete-account", () => {
  it("cancels the creator's lobby and purges the user's D1 data", async () => {
    const a = uid("del-a");
    const created = await json<{ gameId: string }>(await api(a, "POST", "/games", { ...createBody, rated: false }), 201);

    expect((await api(a, "DELETE", "/me")).status).toBe(204);

    expect(await db.select().from(users).where(eq(users.id, a)).get()).toBeUndefined();
    const game = await db.select().from(games).where(eq(games.id, created.gameId)).get();
    expect(game?.status).toBe("aborted");
    expect(game?.createdBy).toBeNull();
  });

  it("forfeits an active game — the seat is anonymized, the opponent plays on", async () => {
    const a = uid("del-a");
    const b = uid("del-b");
    const { gameId } = await json<{ gameId: string }>(await api(a, "POST", "/games", { ...createBody, rated: false }), 201);
    await json(await api(b, "POST", `/games/${gameId}/join`, { clientSchemaVersion: 1 }));
    await json(await api(a, "POST", `/games/${gameId}/start`, {}));
    await json(await api(a, "POST", `/games/${gameId}/action`, { seat: 0, expectedVersion: 0, data: { add: 2 } }));

    expect((await api(a, "DELETE", "/me")).status).toBe(204);

    // The forfeit finishes the game (async on the DO); wait for it to land.
    await vi.waitFor(async () => expect((await db.select().from(games).where(eq(games.id, gameId)).get())?.status).toBe("finished"));
    expect(await db.select().from(users).where(eq(users.id, a)).get()).toBeUndefined();
    const seats = await db.select().from(participants).where(eq(participants.gameId, gameId)).all();
    expect(seats.find((s) => s.playerIndex === 0)?.userId).toBeNull(); // A, anonymized
    expect(seats.find((s) => s.playerIndex === 1)?.userId).toBe(b); // B, intact
  });
});

describe("cron: stale-guest purge", () => {
  it("purges an old, inactive guest but keeps a fresh one and an active one", async () => {
    const stale = uid("guest-stale");
    const fresh = uid("guest-fresh");
    const active = uid("guest-active");
    await provision(stale, true);
    await provision(fresh, true);
    await provision(active, true);

    // `active` has a game touched just now; `stale` has none. Age both out.
    await json<{ gameId: string }>(await api(active, "POST", "/games", { ...createBody, rated: false }, true), 201);
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    await db.update(users).set({ createdAt: eightDaysAgo }).where(eq(users.id, stale)).run();
    await db.update(users).set({ createdAt: eightDaysAgo }).where(eq(users.id, active)).run();

    await runCron();

    expect(await db.select().from(users).where(eq(users.id, stale)).get()).toBeUndefined();
    expect(await db.select().from(users).where(eq(users.id, fresh)).get()).toBeDefined();
    expect(await db.select().from(users).where(eq(users.id, active)).get()).toBeDefined();
  });
});

describe("cron: abandoned-game reap", () => {
  it("aborts a lobby nobody started in time", async () => {
    const a = uid("reap-a");
    const { gameId } = await json<{ gameId: string }>(await api(a, "POST", "/games", { ...createBody, rated: false }), 201);
    await db
      .update(games)
      .set({ createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000 })
      .where(eq(games.id, gameId))
      .run();

    await runCron();

    const game = await db.select().from(games).where(eq(games.id, gameId)).get();
    expect(game?.status).toBe("aborted");
  });
});

describe("applyFinish purge guard", () => {
  it("skips a rating write for a user who no longer exists, rating the rest", async () => {
    const present = uid("guard-present");
    const gone = uid("guard-gone"); // never inserted into `users`
    const now = Date.now();
    await db
      .insert(users)
      .values(userRow(present, { username: uid("u"), displayName: "Present" }))
      .run();

    const gameId = crypto.randomUUID();
    await createGame(env.DB, {
      gameId,
      createdBy: present,
      status: "ready",
      access: "public",
      schemaVersion: 1,
      config: { target: 3 },
      turnSeconds: 30,
      budgetSeconds: null,
      incrementSeconds: null,
      rated: true,
      ratingPool: "guard-pool",
      minPlayers: 2,
      maxPlayers: 2,
      shortCode: uid("C").slice(0, 8).toUpperCase(),
      seats: [
        { playerIndex: 0, userId: present, botId: null, type: "human" },
        { playerIndex: 1, userId: gone, botId: null, type: "human" },
      ],
      now,
    });

    const deltas = await applyFinish(env.DB, {
      gameId,
      finishId: crypto.randomUUID(),
      outcomes: [
        { playerIndex: 0, result: "win", placement: 1, teamIndex: 0 },
        { playerIndex: 1, result: "loss", placement: 2, teamIndex: 1 },
      ],
      roster: [
        { playerIndex: 0, userId: present, botId: null, type: "human" },
        { playerIndex: 1, userId: gone, botId: null, type: "human" },
      ],
      rated: true,
      ratingPool: "guard-pool",
      now,
    });

    // The present user is rated; the deleted one gets no row and no delta.
    expect(
      await db
        .select()
        .from(playerRatings)
        .where(and(eq(playerRatings.userId, present), eq(playerRatings.pool, "guard-pool")))
        .get(),
    ).toBeDefined();
    expect(await db.select().from(playerRatings).where(eq(playerRatings.userId, gone)).get()).toBeUndefined();
    expect(await db.select().from(ratingHistory).where(eq(ratingHistory.userId, gone)).get()).toBeUndefined();
    expect(deltas?.some((d) => d.identity.userId === gone)).toBe(false);
    expect(deltas?.some((d) => d.identity.userId === present)).toBe(true);
  });
});
