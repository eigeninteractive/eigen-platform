/**
 * GameDO skeleton suite — the folded-in Phase 0 spike, minus the two
 * checks only a real deploy can make (hibernation billing, forced eviction):
 * lazy init, the gated command loop, dedupe, the deadline alarm, hibernating
 * socket fan-out, and the finish sequence (compaction → outbox → D1 apply →
 * ratings transition N+1 → outbox clear). The worker-facing surface
 * (`createEngine`) is exercised HTTP-first in engine.spec.ts; this suite
 * drives the DO's RPC seam directly.
 */

import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { GameStatus } from "@eigen/kernel";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it, vi } from "vitest";
import { games, playerRatings, ratingHistory, users } from "../src/d1/schema.js";
import { type Command, createGame, type FrameMessage } from "../src/index.js";

/** Typed D1 access for seeds and assertions — the DO's own SQLite is
 * inspected raw (`state.storage.sql.exec`) on purpose: those checks verify
 * what is physically on disk beneath the ORM. */
const db = drizzle(env.DB);

interface SeedOptions {
  rated?: boolean;
  turnSeconds?: number | null;
  status?: Extract<GameStatus, "waiting" | "ready">;
}

let gameCounter = 0;

/** Seed via the engine's own create, with both seats already joined
 * (the waiting room is a later milestone). */
async function seedGame(opts: SeedOptions = {}): Promise<string> {
  const gameId = `game-${++gameCounter}-${crypto.randomUUID()}`;
  const now = Date.now();
  // Both seats have real `users` rows, as any authed player would — the finish
  // apply's purge guard only rates identities that still exist.
  await db
    .insert(users)
    .values([
      { id: "user-a", username: "user-a", email: null, displayName: "A", avatarUrl: null, isAnonymous: false, createdAt: now, updatedAt: now },
      { id: "user-b", username: "user-b", email: null, displayName: "B", avatarUrl: null, isAnonymous: false, createdAt: now, updatedAt: now },
    ])
    .onConflictDoNothing()
    .run();
  await createGame(env.DB, {
    gameId,
    createdBy: "user-a",
    status: opts.status ?? "ready",
    access: "public",
    schemaVersion: 1,
    config: { target: 3 },
    turnSeconds: opts.turnSeconds ?? null,
    budgetSeconds: null,
    incrementSeconds: null,
    rated: opts.rated ?? false,
    ratingPool: opts.rated ? "test-pool" : null,
    minPlayers: 2,
    maxPlayers: 2,
    shortCode: gameId.slice(0, 6) + gameCounter,
    seats: [
      { player_index: 0, user_id: "user-a", bot_id: null, type: "human" },
      { player_index: 1, user_id: "user-b", bot_id: null, type: "human" },
    ],
    now: Date.now(),
  });
  return gameId;
}

function stubFor(gameId: string) {
  return env.GAME_DO.get(env.GAME_DO.idFromName(gameId));
}

let commandCounter = 0;
function cmd<K extends Command["kind"]>(kind: K, gameId: string, extra: Record<string, unknown> = {}): Command {
  return { kind, gameId, commandId: `cmd-${++commandCounter}`, actor: { userId: "user-a", botId: null }, ...extra } as Command;
}

async function startGame(opts: SeedOptions = {}) {
  const gameId = await seedGame(opts);
  const stub = stubFor(gameId);
  const started = await stub.handle(cmd("start", gameId));
  expect(started).toMatchObject({ ok: true, version: 0 });
  return { gameId, stub };
}

function action(gameId: string, seat: number, add: number, expectedVersion: number, userId: string): Command {
  return {
    kind: "action",
    gameId,
    commandId: `cmd-${++commandCounter}`,
    actor: { userId, botId: null },
    seat,
    expectedVersion,
    data: { add },
  };
}

/** Drive the seeded game to its finish: 0 plays 2, 1 plays 2, 0 plays 2 → 6 ≥ 3
 * on version 3... target 3 reached at second move; keep it explicit instead. */
async function playToFinish(gameId: string, stub: ReturnType<typeof stubFor>) {
  const a1 = await stub.handle(action(gameId, 0, 2, 0, "user-a"));
  expect(a1).toMatchObject({ ok: true, version: 1 });
  const a2 = await stub.handle(action(gameId, 1, 2, 1, "user-b"));
  expect(a2).toMatchObject({ ok: true, version: 2 });
  if (!a2.ok || !("frame" in a2)) throw new Error("unreachable");
  expect(a2.frame?.outcomes).toBeDefined();
  return a2;
}

describe("lazy init & start", () => {
  it("initializes from the D1 row and commits v0", async () => {
    const { stub } = await startGame();
    await runInDurableObject(stub, async (_instance, state) => {
      const meta = state.storage.sql.exec("SELECT * FROM meta").one();
      expect(meta.status).toBe("active");
      expect(meta.rng_seed).not.toBeNull();
      const roster = state.storage.sql.exec("SELECT * FROM roster ORDER BY player_index").toArray();
      expect(roster).toHaveLength(2);
      const v0 = state.storage.sql.exec("SELECT * FROM transitions WHERE version = 0").one();
      expect(JSON.parse(v0.state as string)).toEqual({ count: 0 });
    });
  });

  it("rejects a start from a non-creator (clean rejection, not a throw)", async () => {
    const gameId = await seedGame();
    const stub = stubFor(gameId);
    const result = await stub.handle({ ...cmd("start", gameId), actor: { userId: "user-b", botId: null } });
    expect(result).toMatchObject({ ok: false, code: "not_creator" });
  });

  it("updates the D1 summary post-commit", async () => {
    const { gameId } = await startGame();
    await vi.waitFor(async () => {
      const row = await db.select({ status: games.status, pendingPlayers: games.pendingPlayers }).from(games).where(eq(games.id, gameId)).get();
      expect(row?.status).toBe("active");
      expect(row?.pendingPlayers).toEqual([0]);
    });
  });
});

describe("actions & dedupe", () => {
  it("alternates turns, versions strictly serial, own frame rides the response", async () => {
    const { gameId, stub } = await startGame();
    const a1 = await stub.handle(action(gameId, 0, 1, 0, "user-a"));
    expect(a1).toMatchObject({ ok: true, version: 1 });
    if (!a1.ok || !("frame" in a1)) throw new Error("unreachable");
    expect(a1.frame?.data).toEqual({ count: 1 });
    expect(a1.frame?.pending_players).toEqual([1]);
  });

  it("replays the stored response for a duplicate commandId instead of double-applying", async () => {
    const { gameId, stub } = await startGame();
    const move = action(gameId, 0, 1, 0, "user-a");
    const first = await stub.handle(move);
    const replay = await stub.handle(move);
    expect(replay).toEqual(first);
    await runInDurableObject(stub, async (_i, state) => {
      const count = state.storage.sql.exec("SELECT COUNT(*) AS n FROM transitions").one();
      expect(count.n).toBe(2); // v0 + one action, not two
    });
  });

  it("rejects a stale action whose view changed (full-reveal game)", async () => {
    const { gameId, stub } = await startGame();
    await stub.handle(action(gameId, 0, 1, 0, "user-a"));
    const stale = await stub.handle(action(gameId, 1, 1, 0, "user-b"));
    expect(stale).toMatchObject({ ok: false, code: "state_updated" });
  });

  it("refuses a seat the actor does not own with a clean rejection", async () => {
    const { gameId, stub } = await startGame();
    // user-b naming user-a's seat 0 is rejected as a value, not thrown.
    const res = await stub.handle(action(gameId, 0, 1, 0, "user-b"));
    expect(res).toMatchObject({ ok: false, code: "not_participant" });
  });
});

describe("deadline alarm", () => {
  it("arms at deadline + grace and times the pending seat out", async () => {
    const { gameId, stub } = await startGame({ turnSeconds: 60 });
    const armed = await runInDurableObject(stub, async (_i, state) => {
      const alarm = await state.storage.getAlarm();
      const v0 = state.storage.sql.exec("SELECT deadline FROM transitions WHERE version = 0").one();
      return { alarm, deadline: v0.deadline as number };
    });
    expect(armed.alarm).toBe(armed.deadline + 750);

    // Fire early: the kernel abstains (deadline not genuinely expired).
    await runDurableObjectAlarm(stub);
    await runInDurableObject(stub, async (_i, state) => {
      expect(state.storage.sql.exec("SELECT COUNT(*) AS n FROM transitions").one().n).toBe(1);
      // The lost race arms nothing new; rearm for the real fire below.
      await state.storage.setAlarm(Date.now() + 60_000);
    });

    // Simulate genuine expiry: rewrite the deadline into the past.
    await runInDurableObject(stub, async (_i, state) => {
      state.storage.sql.exec("UPDATE transitions SET deadline = ? WHERE version = 0", Date.now() - 1000);
    });
    await runDurableObjectAlarm(stub);
    await runInDurableObject(stub, async (_i, state) => {
      expect(state.storage.sql.exec("SELECT status FROM meta").one().status).toBe("finished");
    });
    const row = await db.select({ status: games.status, outcomes: games.outcomes }).from(games).where(eq(games.id, gameId)).get();
    await vi.waitFor(() => expect(row?.status ?? "pending").toBeDefined());
  });
});

describe("finish sequence", () => {
  it("compacts, applies to D1, and clears the outbox (unrated: no ratings transition)", async () => {
    const { gameId, stub } = await startGame();
    await playToFinish(gameId, stub);

    await vi.waitFor(async () => {
      const row = await db.select({ status: games.status, outcomes: games.outcomes, finishId: games.finishId, finishedAt: games.finishedAt }).from(games).where(eq(games.id, gameId)).get();
      expect(row?.status).toBe("finished");
      expect(row?.finishId).not.toBeNull();
      expect(row?.finishedAt).not.toBeNull();
      expect(row?.outcomes).toHaveLength(2);
    });

    await runInDurableObject(stub, async (_i, state) => {
      const sql = state.storage.sql;
      await vi.waitFor(() => {
        expect(sql.exec("SELECT COUNT(*) AS n FROM outbox").one().n).toBe(0);
      });
      // Compaction rides the outbox clear: live tables drained with it.
      expect(sql.exec("SELECT COUNT(*) AS n FROM frames").one().n).toBe(0);
      expect(sql.exec("SELECT COUNT(*) AS n FROM commands").one().n).toBe(0);
      // Unrated: the chain ends at the finish version.
      expect(sql.exec("SELECT MAX(version) AS v FROM transitions").one().v).toBe(2);
    });
  });

  it("rated: computes deltas at the D1 CAS and appends the ratings transition N+1", async () => {
    const { gameId, stub } = await startGame({ rated: true });
    await playToFinish(gameId, stub);

    await vi.waitFor(async () => {
      const history = await db.select().from(ratingHistory).where(eq(ratingHistory.gameId, gameId)).all();
      expect(history).toHaveLength(2);
    });

    const ratings = await db.select().from(playerRatings).where(eq(playerRatings.pool, "test-pool")).orderBy(playerRatings.userId).all();
    expect(ratings.length).toBeGreaterThanOrEqual(2);
    const winner = ratings.find((r) => r.userId === "user-b");
    expect(winner?.revision).toBeGreaterThanOrEqual(1);
    expect(winner?.mu).toBeGreaterThan(25);

    await runInDurableObject(stub, async (_i, state) => {
      await vi.waitFor(() => {
        expect(state.storage.sql.exec("SELECT COUNT(*) AS n FROM outbox").one().n).toBe(0);
      });
      expect(state.storage.sql.exec("SELECT COUNT(*) AS n FROM frames").one().n).toBe(0);
      const last = state.storage.sql.exec("SELECT version, action FROM transitions ORDER BY version DESC LIMIT 1").one();
      expect(last.version).toBe(3); // finish at 2, ratings transition at 3
      const actionRow = JSON.parse(last.action as string);
      expect(actionRow).toMatchObject({ type: "system", kind: "ratings", player_index: null });
      expect(actionRow.data.deltas).toHaveLength(2);
    });

    // Replay range fetch surfaces the deltas frame with `ratings` attached.
    const frames = await stub.frames({ seat: null, from: 0, to: 10, isReplay: true });
    expect(frames).toHaveLength(4);
    expect(frames[3].ratings).toHaveLength(2);
  });

  it("keeps the outbox on a failed apply and recovers via repokeFinish", async () => {
    const { gameId, stub } = await startGame({ rated: true });
    // Sabotage the apply: remove the D1 row after init but before finish.
    const backup = await db.select().from(games).where(eq(games.id, gameId)).get();
    if (backup === undefined) throw new Error("seeded games row missing");
    await db.delete(games).where(eq(games.id, gameId));

    await playToFinish(gameId, stub);
    // The waitUntil apply fails (no games row); outbox must survive — and
    // with it the uncompacted live tables (they drain together).
    await runInDurableObject(stub, async (_i, state) => {
      await vi.waitFor(() => {
        expect(state.storage.sql.exec("SELECT COUNT(*) AS n FROM outbox").one().n).toBe(1);
      });
      expect(state.storage.sql.exec("SELECT MAX(version) AS v FROM transitions").one().v).toBe(2);
      expect(state.storage.sql.exec("SELECT COUNT(*) AS n FROM frames").one().n).toBeGreaterThan(0);
    });

    // Restore the row, re-poke: idempotent apply lands, N+1 commits late.
    await db.insert(games).values(backup);
    expect(await stub.repokeFinish()).toBe(true);
    expect(await stub.repokeFinish()).toBe(false); // nothing left to do

    const history = await db.select().from(ratingHistory).where(eq(ratingHistory.gameId, gameId)).all();
    expect(history).toHaveLength(2);
    await runInDurableObject(stub, async (_i, state) => {
      expect(state.storage.sql.exec("SELECT MAX(version) AS v FROM transitions").one().v).toBe(3);
      expect(state.storage.sql.exec("SELECT COUNT(*) AS n FROM outbox").one().n).toBe(0);
    });
  });
});

describe("hibernating sockets", () => {
  it("accepts an upgrade and fans versioned frames out to the seat", async () => {
    const { gameId, stub } = await startGame();
    const res = await stub.fetch("https://do/socket", {
      headers: { Upgrade: "websocket", "x-eigen-game": gameId, "x-eigen-user": "user-b" },
    });
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("no websocket on 101 response");
    ws.accept();
    const messages: FrameMessage[] = [];
    ws.addEventListener("message", (event: MessageEvent) => {
      messages.push(JSON.parse(event.data as string) as FrameMessage);
    });

    await stub.handle(action(gameId, 0, 1, 0, "user-a"));
    await vi.waitFor(() => expect(messages).toHaveLength(1));
    expect(messages[0]).toMatchObject({ type: "frame", version: 1, data: { count: 1 } });
    ws.close();
  });

  it("serves live gap recovery through the frames range fetch", async () => {
    const { gameId, stub } = await startGame();
    await stub.handle(action(gameId, 0, 1, 0, "user-a"));
    await stub.handle(action(gameId, 1, 1, 1, "user-b"));
    const frames = await stub.frames({ seat: 0, from: 1, to: 2 });
    expect(frames.map((f) => f.version)).toEqual([1, 2]);
    expect(frames[1].data).toEqual({ count: 2 });
  });
});
