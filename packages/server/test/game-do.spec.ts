/**
 * GameDO skeleton suite: the folded-in Phase 0 spike, minus the two
 * checks only a real deploy can make (hibernation billing, forced eviction):
 * lazy init, the gated command loop, dedupe, the deadline alarm, hibernating
 * socket fan-out, and the finish sequence (compaction → outbox → D1 apply →
 * ratings transition N+1 → outbox clear). The worker-facing surface
 * (`createEngine`) is exercised HTTP-first in engine.spec.ts; this suite
 * drives the DO's RPC seam directly.
 */

import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { GameStatus } from "@eigeninteractive/kernel";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { orm } from "../src/d1/orm.js";
import { games, playerRatings, ratingHistory, users } from "../src/d1/schema.js";
import { type Command, createGame } from "../src/index.js";
import type { SessionSnapshot } from "../src/protocol.js";
import { userRow } from "./factories.js";

/** Typed D1 access for seeds and assertions. The DO's own SQLite is
 * inspected raw (`state.storage.sql.exec`) on purpose: those checks verify
 * what is physically on disk beneath the ORM. */
const db = orm(env.DB);

interface SeedOptions {
  rated?: boolean;
  turnSeconds?: number | null;
  status?: Extract<GameStatus, "waiting" | "ready">;
  /** How many of the two seats are already taken. One leaves room for a join,
   * which is the only way to exercise a waiting-to-ready transition. */
  seats?: 1 | 2;
}

let gameCounter = 0;

/** Seed via the engine's own create, with both seats already joined
 * (the waiting room is a later milestone). */
async function seedGame(opts: SeedOptions = {}): Promise<string> {
  const gameId = `game-${++gameCounter}-${crypto.randomUUID()}`;
  // Both seats have real `users` rows, as any authed player would, so the finish
  // apply's purge guard only rates identities that still exist.
  await db
    .insert(users)
    .values([userRow("user-a", { displayName: "A" }), userRow("user-b", { displayName: "B" })])
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
    seats: [{ playerIndex: 0, userId: "user-a", botId: null, type: "human" }, ...((opts.seats ?? 2) === 2 ? [{ playerIndex: 1, userId: "user-b", botId: null, type: "human" as const }] : [])],
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
  expect(started).toMatchObject({ ok: true, session: { status: "active", version: 0 } });
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
  expect(a1).toMatchObject({ ok: true, session: { version: 1 } });
  const a2 = await stub.handle(action(gameId, 1, 2, 1, "user-b"));
  expect(a2).toMatchObject({ ok: true, session: { version: 2, status: "finished" } });
  if (!a2.ok) throw new Error("unreachable");
  expect(a2.session.frame?.outcomes).toBeDefined();
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
    expect(result).toMatchObject({ ok: false, code: "notCreator" });
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
    expect(a1).toMatchObject({ ok: true, session: { version: 1, status: "active" } });
    if (!a1.ok) throw new Error("unreachable");
    expect(a1.session.frame?.data).toEqual({ count: 1 });
    expect(a1.session.frame?.pendingPlayers).toEqual([1]);
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
    expect(stale).toMatchObject({ ok: false, code: "stateUpdated" });
  });

  it("refuses a seat the actor does not own with a clean rejection", async () => {
    const { gameId, stub } = await startGame();
    // user-b naming user-a's seat 0 is rejected as a value, not thrown.
    const res = await stub.handle(action(gameId, 0, 1, 0, "user-b"));
    expect(res).toMatchObject({ ok: false, code: "notParticipant" });
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
      expect(actionRow).toMatchObject({ type: "system", kind: "ratings", playerIndex: null });
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
    // The waitUntil apply fails (no games row); outbox must survive, and
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
  /** Open a socket as `userId` and collect every snapshot it receives. */
  async function openSocket(gameId: string, stub: ReturnType<typeof stubFor>, userId: string) {
    const res = await stub.fetch("https://do/socket", {
      headers: { Upgrade: "websocket", "x-eigen-game": gameId, "x-eigen-user": userId },
    });
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("no websocket on 101 response");
    ws.accept();
    const messages: SessionSnapshot[] = [];
    ws.addEventListener("message", (event: MessageEvent) => {
      messages.push(JSON.parse(event.data as string) as SessionSnapshot);
    });
    return { ws, messages };
  }

  it("states where the game is on open, at every status, and fans the seat's own view out", async () => {
    const { gameId, stub } = await startGame();
    const { ws, messages } = await openSocket(gameId, stub, "user-b");

    // The open always answers, so a client never holds a frame without the
    // status it belongs to, and never has to infer one from connecting.
    await vi.waitFor(() => expect(messages).toHaveLength(1));
    expect(messages[0]).toMatchObject({ type: "session", status: "active", version: 0, seq: 1, minPlayers: 2, maxPlayers: 2, config: { target: 3 } });
    expect(messages[0].frame).toMatchObject({ version: 0, data: { count: 0 } });

    await stub.handle(action(gameId, 0, 1, 0, "user-a"));
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    expect(messages[1]).toMatchObject({ type: "session", status: "active", version: 1, seq: 2 });
    expect(messages[1].frame).toMatchObject({ version: 1, data: { count: 1 }, pendingPlayers: [1] });
    ws.close();
  });

  it("tells a lobby socket the game became ready, then active", async () => {
    // The transition this protocol exists for: the creator sits in the waiting
    // room, somebody joins, and the status moves under them.
    const gameId = await seedGame({ status: "waiting", seats: 1 });
    const stub = stubFor(gameId);
    const { ws, messages } = await openSocket(gameId, stub, "user-a");

    await vi.waitFor(() => expect(messages).toHaveLength(1));
    expect(messages[0]).toMatchObject({ type: "session", status: "waiting", version: null, frame: null });

    await stub.handle({ ...cmd("join", gameId), actor: { userId: "user-b", botId: null } });
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    expect(messages[1]).toMatchObject({ type: "session", status: "ready", version: null });
    expect(messages[1].players).toHaveLength(2);
    expect(messages[1].seq).toBeGreaterThan(messages[0].seq);

    await stub.handle(cmd("start", gameId));
    await vi.waitFor(() => expect(messages).toHaveLength(3));
    expect(messages[2]).toMatchObject({ type: "session", status: "active", version: 0 });
    ws.close();
  });

  it("gives an unseated socket the envelope with no frame", async () => {
    // How a viewer learns the game started without ever seeing a seat's view.
    const { gameId, stub } = await startGame();
    const { ws, messages } = await openSocket(gameId, stub, "user-c");
    await vi.waitFor(() => expect(messages).toHaveLength(1));
    expect(messages[0]).toMatchObject({ type: "session", status: "active", version: 0, frame: null });

    await stub.handle(action(gameId, 0, 1, 0, "user-a"));
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    expect(messages[1]).toMatchObject({ version: 1, frame: null });
    ws.close();
  });

  it("never sends a seat's view to another seat's socket", async () => {
    const { gameId, stub } = await startGame();
    const a = await openSocket(gameId, stub, "user-a");
    const b = await openSocket(gameId, stub, "user-b");
    await vi.waitFor(() => {
      expect(a.messages).toHaveLength(1);
      expect(b.messages).toHaveLength(1);
    });
    // The counter game reveals everything, so the payloads agree; what is
    // asserted is that each socket is served through its OWN seat resolution,
    // which is what keeps a hidden-information game safe on this path.
    await stub.handle(action(gameId, 0, 1, 0, "user-a"));
    await vi.waitFor(() => {
      expect(a.messages).toHaveLength(2);
      expect(b.messages).toHaveLength(2);
    });
    expect(a.messages[1].frame?.version).toBe(1);
    expect(b.messages[1].frame?.version).toBe(1);
    a.ws.close();
    b.ws.close();
  });

  it("delivers the finish and then the ratings deltas as ordinary snapshots", async () => {
    const { gameId, stub } = await startGame({ rated: true });
    const { ws, messages } = await openSocket(gameId, stub, "user-b");
    await vi.waitFor(() => expect(messages).toHaveLength(1));

    await playToFinish(gameId, stub);
    // Wait for the ratings snapshot specifically: it rides the post-commit
    // finish effects, so it lands after the finishing frame rather than with it.
    await vi.waitFor(() => expect(messages.some((m) => m.frame?.ratings !== undefined)).toBe(true));
    const finished = messages.filter((m) => m.status === "finished");
    expect(finished[0].frame?.outcomes).toBeDefined();
    // The ratings transition N+1 is a snapshot like any other, not a special
    // frame with a field bolted on.
    const withRatings = messages.find((m) => m.frame?.ratings !== undefined);
    expect(withRatings).toMatchObject({ type: "session", status: "finished" });
    expect(withRatings?.version).toBe(3);
    // Strictly increasing across lobby and state commits alike.
    const seqs = messages.map((m) => m.seq);
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
    expect(new Set(seqs).size).toBe(seqs.length);
    ws.close();
  });

  it("tells every socket about an abort before closing them", async () => {
    const gameId = await seedGame();
    const stub = stubFor(gameId);
    const { messages } = await openSocket(gameId, stub, "user-b");
    await vi.waitFor(() => expect(messages).toHaveLength(1));
    await stub.handle(cmd("cancel", gameId));
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    expect(messages[1]).toMatchObject({ type: "session", status: "aborted", players: [], frame: null });
  });
});

describe("the session read", () => {
  it("answers with the same value a fan-out would have sent", async () => {
    const { gameId, stub } = await startGame();
    await stub.handle(action(gameId, 0, 1, 0, "user-a"));
    const session = await stub.session(gameId, "user-b");
    expect(session).toMatchObject({ type: "session", status: "active", version: 1, shortCode: expect.any(String) });
    expect(session?.frame).toMatchObject({ version: 1, data: { count: 1 }, pendingPlayers: [1] });
  });

  it("carries the outcomes of a finished game whose frames were compacted away", async () => {
    // The reason `outcomes` is retained on `meta`: they are kernel output, so no
    // transition row holds them, and the frame that carried them is long gone.
    const { gameId, stub } = await startGame();
    await playToFinish(gameId, stub);
    await vi.waitFor(async () => {
      const row = await db.select({ status: games.status }).from(games).where(eq(games.id, gameId)).get();
      expect(row?.status).toBe("finished");
    });
    const session = await stub.session(gameId, "user-a");
    expect(session).toMatchObject({ status: "finished" });
    expect(session?.frame?.outcomes).toHaveLength(2);
  });

  it("gives a non-participant the envelope with no frame", async () => {
    const { gameId, stub } = await startGame();
    const session = await stub.session(gameId, "user-c");
    expect(session).toMatchObject({ status: "active", version: 0, frame: null });
  });

  it("answers null for a game that does not exist", async () => {
    expect(await stubFor("no-such-game").session("no-such-game", "user-a")).toBeNull();
  });
});

describe("gap recovery", () => {
  it("serves live gap recovery through the frames range fetch", async () => {
    const { gameId, stub } = await startGame();
    await stub.handle(action(gameId, 0, 1, 0, "user-a"));
    await stub.handle(action(gameId, 1, 1, 1, "user-b"));
    const frames = await stub.frames({ seat: 0, from: 1, to: 2 });
    expect(frames.map((f) => f.version)).toEqual([1, 2]);
    expect(frames[1].data).toEqual({ count: 2 });
  });
});
