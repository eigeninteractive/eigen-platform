/**
 * Read-model reconciliation and the operator surface.
 *
 * D1's game rows are a read model the Durable Object writes off the response
 * path, because a commit whose truth is already durable must never fail on a
 * display copy. The cost of that choice is that a lost mirror write leaves D1
 * quietly stale, and a failed finish apply leaves a game's rating deltas
 * unwritten. `reconcile` is the repair; the cron sweep finds candidates without
 * being told, and `/api/ops` lets an operator run it on a specific game.
 *
 * Divergence is created here by writing to D1 behind the DO's back, which is
 * exactly what a lost mirror write looks like from D1's side.
 */

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { orm } from "../src/d1/orm.js";
import { games, participants } from "../src/d1/schema.js";
import { testBearer as bearer, testMutationHeaders as mutationHeaders } from "../src/testing.js";
import worker from "./worker.js";

const db = orm(env.DB);
const uid = (tag: string) => `${tag}-${crypto.randomUUID()}`;
const DAY_MS = 24 * 60 * 60 * 1000;

async function api(id: string, method: string, path: string, body?: unknown): Promise<Response> {
  return await exports.default.fetch(`https://x/api/engine${path}`, {
    method,
    headers: method === "GET" ? { ...(await bearer({ uid: id })), "content-type": "application/json" } : await mutationHeaders({ uid: id }),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** The operator surface authenticates with its own secret, never a player token. */
async function ops(method: string, path: string, token: string | null = "test-ops-token"): Promise<Response> {
  return await exports.default.fetch(`https://x/api/ops${path}`, {
    method,
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
  });
}

async function runCron(): Promise<void> {
  await worker.scheduled?.({ scheduledTime: Date.now(), cron: "0 3 * * *", noRetry() {} } as ScheduledController, env, {} as ExecutionContext);
}

/** A lobby with one seat, whose DO has committed its own meta row. */
async function seededGame(): Promise<{ gameId: string; host: string }> {
  const host = uid("rec-host");
  const res = await api(host, "POST", "/games", { access: "public", schemaVersion: 1, config: { target: 3 }, rated: false });
  expect(res.status).toBe(201);
  const { gameId } = (await res.json()) as { gameId: string };
  // Touch the DO so it lazy-inits and holds committed state of its own; without
  // this, D1's row is the only truth and there is nothing to reconcile against.
  expect((await api(host, "GET", `/games/${gameId}/session`)).status).toBe(200);
  return { gameId, host };
}

/**
 * Corrupt D1 the way a lost mirror write would: wrong status, missing seats.
 *
 * `turnDeadline` is a parameter because it decides which of the sweep's two
 * signals sees the row. Null is the harder case: an active game with no deadline
 * is indistinguishable from a correspondence game whose player is thinking, so
 * only staleness can find it.
 */
async function loseMirrorWrite(gameId: string, updatedAt: number, turnDeadline: number | null = null): Promise<void> {
  await db
    .update(games)
    .set({ status: "active", pendingPlayers: [7], turnDeadline, updatedAt })
    .where(eq(games.id, gameId))
    .run();
  await db.delete(participants).where(eq(participants.gameId, gameId)).run();
}

describe("reconcile", () => {
  it("rewrites D1's status and roster from the authoritative object", async () => {
    const { gameId } = await seededGame();
    await loseMirrorWrite(gameId, Date.now());

    const res = await ops("POST", `/games/${gameId}/reconcile`);
    expect(await res.json()).toMatchObject({ initialized: true, status: "waiting", mirrorRewritten: true, finishRepoked: false });

    const row = await db.select().from(games).where(eq(games.id, gameId)).get();
    expect(row?.status).toBe("waiting");
    const seats = await db.select().from(participants).where(eq(participants.gameId, gameId)).all();
    expect(seats).toHaveLength(1);
  });

  it("reports an object with no committed state instead of writing D1 back over itself", async () => {
    // A game created but never touched: lazy init reads the games row FROM D1, so
    // an object with no meta has nothing more authoritative than the row it would
    // be repairing. Reconciling it must not read the stale copy and write it back
    // while reporting success.
    const host = uid("rec-cold");
    const created = await api(host, "POST", "/games", { access: "public", schemaVersion: 1, config: { target: 3 }, rated: false });
    const { gameId } = (await created.json()) as { gameId: string };
    await db.update(games).set({ status: "active" }).where(eq(games.id, gameId)).run();

    const body = (await (await ops("POST", `/games/${gameId}/reconcile`)).json()) as { initialized: boolean; status: string | null; note?: string };
    expect(body.initialized).toBe(false);
    expect(body.status).toBeNull();
    expect(body.note).toMatch(/no committed Durable Object state/);
    // Untouched, not "repaired" to the value it already held.
    expect((await db.select().from(games).where(eq(games.id, gameId)).get())?.status).toBe("active");
  });

  it("is idempotent, so a sweep may run it on a healthy game", async () => {
    const { gameId } = await seededGame();
    const first = (await (await ops("POST", `/games/${gameId}/reconcile`)).json()) as { status: string };
    const second = (await (await ops("POST", `/games/${gameId}/reconcile`)).json()) as { status: string };
    expect(second).toMatchObject({ status: first.status, finishRepoked: false, alarmRearmed: false });
    expect(await db.select().from(participants).where(eq(participants.gameId, gameId)).all()).toHaveLength(1);
  });
});

describe("cron: read-model reconciliation", () => {
  it("finds a game D1 has stopped hearing from and repairs it", async () => {
    const { gameId } = await seededGame();
    // Stale beyond mirrorStaleMs (7 days), which is the only signal that finds a
    // game with no deadline to be late for.
    await loseMirrorWrite(gameId, Date.now() - 8 * DAY_MS);

    await runCron();

    const row = await db.select().from(games).where(eq(games.id, gameId)).get();
    expect(row?.status).toBe("waiting");
    expect(await db.select().from(participants).where(eq(participants.gameId, gameId)).all()).toHaveLength(1);
  });

  it("finds an active game long past its committed deadline, however fresh the row", async () => {
    const { gameId } = await seededGame();
    // The other signal: a timed game's alarm fires within its deadline plus grace
    // and that fire writes to D1, so a deadline this old means the alarm or the
    // write was lost — provable without waiting for staleness.
    await loseMirrorWrite(gameId, Date.now(), Date.now() - 2 * DAY_MS);

    await runCron();

    expect((await db.select().from(games).where(eq(games.id, gameId)).get())?.status).toBe("waiting");
  });

  it("leaves a recently updated game with no deadline alone", async () => {
    const { gameId } = await seededGame();
    // Neither signal fires: this is what a correspondence game mid-turn looks
    // like, and waking every live object daily is not a repair strategy.
    await loseMirrorWrite(gameId, Date.now());

    await runCron();

    expect((await db.select().from(games).where(eq(games.id, gameId)).get())?.status).toBe("active");
  });
});

describe("the operator surface", () => {
  it("shows the two copies side by side without any hidden game state", async () => {
    const { gameId } = await seededGame();
    const body = (await (await ops("GET", `/games/${gameId}`)).json()) as { d1: { status: string; seats: unknown[] }; durableObject: { status: string; seats: unknown[] } };
    expect(body.d1.status).toBe("waiting");
    expect(body.durableObject.status).toBe("waiting");
    expect(body.durableObject.seats).toHaveLength(1);
    // The unseated view: no observation data can reach an operator, so this can
    // never become a cheating channel for a live game.
    expect(JSON.stringify(body)).not.toContain("observation");
  });

  it("refuses a missing, wrong, or player-supplied credential", async () => {
    const { gameId, host } = await seededGame();
    expect((await ops("GET", `/games/${gameId}`, null)).status).toBe(401);
    expect((await ops("GET", `/games/${gameId}`, "not-the-secret")).status).toBe(401);
    // A player's Firebase token is not an operator credential, and the ops group
    // never runs the auth middleware that would understand it.
    const playerToken = (await bearer({ uid: host })).authorization.replace(/^Bearer /, "");
    expect((await ops("GET", `/games/${gameId}`, playerToken)).status).toBe(401);
  });

  it("answers 404 for every route when no operator secret is set", async () => {
    const { gameId } = await seededGame();
    const configured = (env as unknown as { OPS_TOKEN?: string }).OPS_TOKEN;
    delete (env as unknown as { OPS_TOKEN?: string }).OPS_TOKEN;
    try {
      // A deployment that never configures an operator secret has no surface to
      // probe rather than a guarded one.
      expect((await ops("GET", `/games/${gameId}`)).status).toBe(404);
      expect((await ops("POST", `/games/${gameId}/reconcile`)).status).toBe(404);
    } finally {
      (env as unknown as { OPS_TOKEN?: string }).OPS_TOKEN = configured;
    }
  });

  it("404s an unknown game", async () => {
    expect((await ops("GET", `/games/${crypto.randomUUID()}`)).status).toBe(404);
  });
});
