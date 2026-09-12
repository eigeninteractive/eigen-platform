/**
 * Offline play, server half: the three import routes end to end over the
 * worker, plus the one new trust rule they rest on.
 *
 * The shape being asserted is that an imported game is an ORDINARY game. It is
 * created with the device's own id, seed and instant; its transitions are
 * committed by the same kernel path a live move takes, so the same guards
 * refuse the same things; it finishes into the same D1 row with the same
 * outcomes. What differs is scoped and tested here: it is never rated, nothing
 * is woken or pushed, the summary mirror is written once for a whole batch, and
 * the creator may act on their own bots' seats — but only with origin `local`,
 * only on a bot's seat, and only as the creator, so each of those three is
 * tested failing alone.
 */

import { runInDurableObject } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { orm } from "../src/d1/orm.js";
import { bots, games, playerRatings, ratingHistory } from "../src/d1/schema.js";
import { createGame } from "../src/index.js";
import { testBearer as bearer, testMutationHeaders as mutationHeaders } from "../src/testing.js";
import { LEAK_SENTINEL, pushLog } from "./worker.js";

const db = orm(env.DB);

/** A local bot (a brain that ships only in the client) and an engine bot (a
 * brain that ships in both languages, so one identity plays in either mode).
 * The engine bot is the sharper instrument here: the test game really does ship
 * a server brain for `test-engine-bot`, so if a local game ever dispatched a
 * wake, that brain would commit a move of its own and the version would move. */
const LOCAL = "local-brain-bot";
const ENGINE = "test-engine-bot";
const EXTERNAL = "hosted-elsewhere-bot";

/** The device's base seed: 128 bits of hex, exactly what `randomSeed()` makes. */
const SEED = "00112233445566778899aabbccddeeff";

let userCounter = 0;
function makeUsers() {
  const n = ++userCounter;
  return { a: `local-a-${n}-${crypto.randomUUID()}`, b: `local-b-${n}-${crypto.randomUUID()}` };
}

async function api(uid: string, method: string, path: string, body?: unknown): Promise<Response> {
  return await exports.default.fetch(`https://x/api/engine${path}`, {
    method,
    headers: method === "GET" ? await bearer({ uid }) : await mutationHeaders({ uid }),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return (await res.json()) as T;
}

async function codeOf(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { code?: string }).code;
}

interface Session {
  gameId: string;
  shortCode: string;
  origin: string;
  access: string;
  minPlayers: number;
  maxPlayers: number;
  rated: boolean;
  ratingPool: string | null;
  status: string;
  version: number | null;
  turnSeconds: number | null;
  players: { playerIndex: number; userId: string | null; botId: string | null; type: string }[];
  frame: { version: number; data: { count: number }; pendingPlayers: number[]; outcomes?: unknown[] } | null;
}
interface Started {
  session: Session;
}
interface Applied {
  applied: number;
  session: Session;
  rejection: { index: number; code: string; message: string } | null;
}
interface Transition {
  seat: number;
  kind: "game" | "lifecycle";
  data: unknown;
}

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    gameId: crypto.randomUUID(),
    schemaVersion: 1,
    config: { target: 3 },
    minPlayers: 2,
    maxPlayers: 2,
    botIds: [LOCAL],
    seed: SEED,
    // Deliberately in the past: the game was played on the device before it
    // was ever sent here.
    createdAt: Date.now() - 3_600_000,
    ...overrides,
  };
}

async function createLocal(uid: string, overrides: Record<string, unknown> = {}): Promise<Session> {
  const body = createBody(overrides);
  return (await json<Started>(await api(uid, "POST", "/games/local", body), 201)).session;
}

async function append(uid: string, gameId: string, fromVersion: number, transitions: Transition[]): Promise<Applied> {
  return await json<Applied>(await api(uid, "POST", `/games/${gameId}/local/transitions`, { fromVersion, transitions }));
}

const move = (seat: number, add: number): Transition => ({ seat, kind: "game", data: { add } });

beforeAll(async () => {
  await db
    .insert(bots)
    .values([
      { id: LOCAL, username: LOCAL, displayName: "Local Brain", avatarUrl: null, schemaVersion: 1, type: "local", webhookUrl: null, ratedEligible: false, config: {}, createdAt: Date.now() },
      { id: ENGINE, username: ENGINE, displayName: "Engine Bot", avatarUrl: null, schemaVersion: 1, type: "engine", webhookUrl: null, ratedEligible: true, config: {}, createdAt: Date.now() },
      { id: EXTERNAL, username: EXTERNAL, displayName: "Hosted Bot", avatarUrl: null, schemaVersion: 1, type: "external", webhookUrl: "https://wake.test/hook", ratedEligible: false, config: {}, createdAt: Date.now() },
    ])
    .onConflictDoNothing();
});

describe("create-local", () => {
  it("registers the device's game: private, unrated, untimed, running at v0", async () => {
    const u = makeUsers();
    const body = createBody();
    const session = (await json<Started>(await api(u.a, "POST", "/games/local", body), 201)).session;

    expect(session.gameId).toBe(body.gameId);
    expect(session).toMatchObject({ origin: "local", access: "private", rated: false, status: "active", version: 0, turnSeconds: null });
    // The pool is still recorded (the row says which pool this game WOULD have
    // been in), but `rated` is false, which is the whole anti-cheat story.
    expect(session.ratingPool).toBe("test-pool");
    expect(session.players).toEqual([
      { playerIndex: 0, userId: u.a, botId: null, type: "human" },
      { playerIndex: 1, userId: null, botId: LOCAL, type: "bot" },
    ]);
    expect(session.frame).toMatchObject({ version: 0, data: { count: 0 }, pendingPlayers: [0] });

    const detail = await json<{ origin: string; rated: boolean; createdAt: number }>(await api(u.a, "GET", `/games/${body.gameId}`));
    expect(detail.origin).toBe("local");
    expect(detail.rated).toBe(false);
    // Sorted by when it was played, not by when it reached the server.
    expect(detail.createdAt).toBe(body.createdAt);
  });

  it("clamps a device clock that runs ahead of the server", async () => {
    const u = makeUsers();
    const body = createBody({ createdAt: Date.now() + 7 * 24 * 3600_000 });
    const before = Date.now();
    await json<Started>(await api(u.a, "POST", "/games/local", body), 201);
    const detail = await json<{ createdAt: number }>(await api(u.a, "GET", `/games/${body.gameId}`));
    expect(detail.createdAt).toBeGreaterThanOrEqual(before);
    expect(detail.createdAt).toBeLessThan(body.createdAt);
  });

  it("answers a repeated create with the game that is already here", async () => {
    const u = makeUsers();
    const body = createBody();
    const first = (await json<Started>(await api(u.a, "POST", "/games/local", body), 201)).session;
    // The device re-runs this whenever a response was lost. It must not make a
    // second game, and must not disturb the one that exists.
    const again = (await json<Started>(await api(u.a, "POST", "/games/local", body), 201)).session;
    expect(again.gameId).toBe(first.gameId);
    expect(again.version).toBe(0);

    const mine = await json<{ games: { id: string }[] }>(await api(u.a, "GET", "/games/mine?bucket=active"));
    expect(mine.games.filter((g) => g.id === body.gameId)).toHaveLength(1);
  });

  it("answers a retry after the game has been played with where it actually is", async () => {
    const u = makeUsers();
    const body = createBody();
    await json<Started>(await api(u.a, "POST", "/games/local", body), 201);
    await append(u.a, body.gameId, 0, [move(0, 1)]);
    // A stale sync trigger re-creating a game that has moved on gets the truth,
    // not a refusal: the start is an idempotent lifecycle, so the kernel
    // abstains and the session is read back as it stands.
    const retried = (await json<Started>(await api(u.a, "POST", "/games/local", body), 201)).session;
    expect(retried.version).toBe(1);
  });

  it("never reveals another player's game behind the same id", async () => {
    const u = makeUsers();
    const body = createBody();
    await json<Started>(await api(u.b, "POST", "/games/local", body), 201);
    const stolen = await api(u.a, "POST", "/games/local", body);
    expect(stolen.status).toBe(403);
    expect(await codeOf(stolen)).toBe("notCreator");
  });

  it("refuses an externally hosted bot, which no device can run", async () => {
    const u = makeUsers();
    const res = await api(u.a, "POST", "/games/local", createBody({ botIds: [EXTERNAL] }));
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("notLocalBot");
  });

  it("refuses an unknown bot", async () => {
    const u = makeUsers();
    expect((await api(u.a, "POST", "/games/local", createBody({ botIds: ["no-such-bot"] }))).status).toBe(404);
  });

  it("accepts any installed schema version but not one this server never had", async () => {
    const u = makeUsers();
    // A local game was created on the device at the version that device shipped,
    // and has already been played; the latest-only gate an online create uses
    // would strand it. Only a version this deployment has never heard of is
    // refused, and it says so precisely.
    const ahead = await api(u.a, "POST", "/games/local", createBody({ schemaVersion: 99 }));
    expect(ahead.status).toBe(409);
    expect(await codeOf(ahead)).toBe("serverUpdateRequired");
  });

  it("refuses a seat range the rules cannot address", async () => {
    const u = makeUsers();
    expect((await api(u.a, "POST", "/games/local", createBody({ maxPlayers: 5 }))).status).toBe(422);
  });

  it("publishes each bot's dispatch type so a picker can choose an opponent", async () => {
    const u = makeUsers();
    const catalog = await json<{ bots: { id: string; type: string }[] }>(await api(u.a, "GET", "/bots"));
    expect(catalog.bots.find((b) => b.id === LOCAL)?.type).toBe("local");
    expect(catalog.bots.find((b) => b.id === EXTERNAL)?.type).toBe("external");
  });
});

describe("importing the device's log", () => {
  it("replays a whole transcript to a finish, unrated, with the bot's moves logged as a bot's", async () => {
    const pushesBefore = pushLog.length;
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);

    // The device's log verbatim: the human opened, its on-device bot answered,
    // the human closed it out at the target.
    const applied = await append(u.a, gameId, 0, [move(0, 1), move(1, 1), move(0, 1)]);
    expect(applied.applied).toBe(3);
    expect(applied.rejection).toBeNull();
    expect(applied.session).toMatchObject({ status: "finished", version: 3 });
    expect(applied.session.frame?.outcomes).toHaveLength(2);

    // Every transition is in the permanent log, projected like any other game's.
    const frames = await json<{ frames: { version: number; data: { count: number } }[] }>(await api(u.a, "GET", `/games/${gameId}/frames?from=0&to=10`));
    expect(frames.frames.map((f) => f.version)).toEqual([0, 1, 2, 3]);
    expect(frames.frames.at(-1)?.data.count).toBe(3);

    await vi.waitFor(async () => {
      const detail = await json<{ status: string; outcomes: unknown[] | null }>(await api(u.a, "GET", `/games/${gameId}`));
      expect(detail.status).toBe("finished");
      expect(detail.outcomes).toHaveLength(2);
    });

    // Unrated end to end: no delta row and no rating for the player, so a local
    // game can never move a ladder however it was played.
    expect(await db.select().from(ratingHistory).where(eq(ratingHistory.gameId, gameId)).all()).toEqual([]);
    expect(await db.select().from(playerRatings).where(eq(playerRatings.userId, u.a)).all()).toEqual([]);
    // No turn push, no finish push: the only human is holding the device.
    expect(pushLog.length).toBe(pushesBefore);

    // The creator's principal carried seat 1's move, but the SEAT decides how it
    // is logged, so replay classifies it exactly like a server bot's.
    const record = await json<{ transitions: { version: number; action: { type: string; playerIndex: number | null } | null }[] }>(await api(u.a, "GET", `/games/${gameId}/local`));
    expect(record.transitions.map((t) => t.action?.type ?? null)).toEqual([null, "user", "bot", "user"]);
    expect(record.transitions[2]?.action?.playerIndex).toBe(1);
  });

  it("imports a forfeit", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);
    const applied = await append(u.a, gameId, 0, [move(0, 1), { seat: 1, kind: "lifecycle", data: { type: "forfeit", playerIndex: 1 } }]);
    expect(applied.applied).toBe(2);
    expect(applied.session.status).toBe("finished");
    expect(applied.session.frame?.outcomes).toHaveLength(2);
  });

  it("refuses any lifecycle but a forfeit of the acting seat", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);
    // An untimed game cannot time out, and auto-forfeit belongs to the account
    // purge, so neither is something a device may claim happened.
    expect((await api(u.a, "POST", `/games/${gameId}/local/transitions`, { fromVersion: 0, transitions: [{ seat: 0, kind: "lifecycle", data: { type: "timeout" } }] })).status).toBe(400);
    expect((await api(u.a, "POST", `/games/${gameId}/local/transitions`, { fromVersion: 0, transitions: [{ seat: 0, kind: "lifecycle", data: { type: "forfeit", playerIndex: 1 } }] })).status).toBe(400);
  });

  it("stops at the first refused transition, keeps what came before, and says where", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);

    // The second move is seat 0 again, which the board does not allow: the
    // device's rules and the server's disagreed. Everything before it stands.
    const applied = await append(u.a, gameId, 0, [move(0, 1), move(0, 1), move(1, 1)]);
    expect(applied.applied).toBe(1);
    expect(applied.rejection).toMatchObject({ index: 1, code: "notPending" });
    expect(applied.session.version).toBe(1);

    // One summary mirror for the batch, written at the end from the settled
    // state rather than once per transition.
    await vi.waitFor(async () => {
      const row = await db.select({ pendingPlayers: games.pendingPlayers, status: games.status }).from(games).where(eq(games.id, gameId)).get();
      expect(row?.status).toBe("active");
      expect(row?.pendingPlayers).toEqual([1]);
    });
  });

  it("answers with the caller's own seat, whatever seat the batch ended on", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);

    // Ends on the bot's move. The commit that produced it answers with the
    // ACTING seat's view, which is the bot's; what the caller gets back has to
    // be their own, or a client would render its board from a bot's eyes.
    const applied = await append(u.a, gameId, 0, [move(0, 1), move(1, 1)]);
    expect(applied.session.frame).toMatchObject({ version: 2, pendingPlayers: [0] });

    // And when nothing commits at all, the answer is still where the game is.
    const refused = await append(u.a, gameId, 2, [move(1, 1)]);
    expect(refused.applied).toBe(0);
    expect(refused.rejection).toMatchObject({ index: 0, code: "notPending" });
    expect(refused.session.frame).toMatchObject({ version: 2, data: { count: 2 } });
  });

  it("refuses a whole batch that another device already moved past", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);
    await append(u.a, gameId, 0, [move(0, 1)]);

    const stale = await api(u.a, "POST", `/games/${gameId}/local/transitions`, { fromVersion: 0, transitions: [move(0, 1)] });
    expect(stale.status).toBe(409);
    expect(await codeOf(stale)).toBe("stateUpdated");
  });

  it("is creator-only, and only for a game played on a device", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);
    const stranger = await api(u.b, "POST", `/games/${gameId}/local/transitions`, { fromVersion: 0, transitions: [move(0, 1)] });
    expect(stranger.status).toBe(403);
    expect(await codeOf(stranger)).toBe("notCreator");

    const online = await json<{ gameId: string }>(await api(u.a, "POST", "/games", { access: "private", schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, rated: false }), 201);
    const wrongOrigin = await api(u.a, "POST", `/games/${online.gameId}/local/transitions`, { fromVersion: 0, transitions: [move(0, 1)] });
    expect(wrongOrigin.status).toBe(403);
    expect(await codeOf(wrongOrigin)).toBe("localOnly");
  });

  it("never wakes a bot and never pushes", async () => {
    const pushesBefore = pushLog.length;
    const u = makeUsers();
    // Seated with the ENGINE bot, whose brain really does ship on this server:
    // a dispatched wake would run it and commit a move of its own.
    const { gameId } = await createLocal(u.a, { botIds: [ENGINE] });
    const applied = await append(u.a, gameId, 0, [move(0, 1)]);
    expect(applied.session.frame?.pendingPlayers).toEqual([1]);

    // Two more round trips through the same object give any dispatched brain
    // every chance to land before we look.
    await api(u.a, "GET", `/games/${gameId}/frames?from=0&to=10`);
    const frames = await json<{ frames: { version: number }[] }>(await api(u.a, "GET", `/games/${gameId}/frames?from=0&to=10`));
    expect(frames.frames.map((f) => f.version)).toEqual([0, 1]);
    expect(pushLog.length).toBe(pushesBefore);
  });
});

describe("the bot-seat trust rule", () => {
  it("lets the creator act on their own bot's seat through the ordinary action route", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);
    await json(await api(u.a, "POST", `/games/${gameId}/action`, { seat: 0, data: { add: 1 }, expectedVersion: 0 }));
    const botMove = await json<{ session: Session }>(await api(u.a, "POST", `/games/${gameId}/action`, { seat: 1, data: { add: 1 }, expectedVersion: 1 }));
    expect(botMove.session.version).toBe(2);
  });

  // The rule is scoped three ways and needs all three. Each of the next three
  // breaks exactly one of them, so none of them is load-bearing by accident.

  it("refuses it when the game is not local (an online creator cannot play their bot)", async () => {
    const u = makeUsers();
    const solo = await json<{ session: Session }>(await api(u.a, "POST", "/games/solo", { schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, turnSeconds: 60, rated: false, botIds: [ENGINE] }), 201);
    const res = await api(u.a, "POST", `/games/${solo.session.gameId}/action`, { seat: 1, data: { add: 1 }, expectedVersion: 0 });
    expect(res.status).toBe(403);
    expect(await codeOf(res)).toBe("notParticipant");
  });

  it("refuses it when the seat is another human's, local origin or not", async () => {
    const u = makeUsers();
    // Seeded directly, because no route will make a local game with a second
    // human in it — which is exactly why the seat check must not be assumed.
    const gameId = crypto.randomUUID();
    const now = Date.now();
    await createGame(env.DB, {
      gameId,
      createdBy: u.a,
      status: "ready",
      access: "private",
      origin: "local",
      schemaVersion: 1,
      config: { target: 3 },
      turnSeconds: null,
      budgetSeconds: null,
      incrementSeconds: null,
      rated: false,
      ratingPool: null,
      minPlayers: 2,
      maxPlayers: 2,
      shortCode: `LC${`${++userCounter}`.padStart(4, "0")}`,
      seats: [
        { playerIndex: 0, userId: u.a, botId: null, type: "human" },
        { playerIndex: 1, userId: u.b, botId: null, type: "human" },
      ],
      createdAt: now,
      now,
    });
    await json<{ session: Session }>(await api(u.a, "POST", `/games/${gameId}/start`, {}));
    const res = await api(u.a, "POST", `/games/${gameId}/action`, { seat: 1, data: { add: 1 }, expectedVersion: 0 });
    expect(res.status).toBe(403);
    expect(await codeOf(res)).toBe("notParticipant");
  });

  it("refuses it when the caller is not the creator", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);
    const res = await api(u.b, "POST", `/games/${gameId}/action`, { seat: 1, data: { add: 1 }, expectedVersion: 0 });
    expect(res.status).toBe(403);
    expect(await codeOf(res)).toBe("notParticipant");
  });
});

describe("nothing runs on a local game's behalf between batches", () => {
  it("arms no alarm, even for a deadline a rules envelope asked for", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);
    await append(u.a, gameId, 0, [move(0, 1)]);

    const stub = env.GAME_DO.get(env.GAME_DO.idFromName(gameId));
    // A version whose `applyAction` returns an envelope `turnSeconds` commits a
    // deadline even in an untimed game: `computeNextDeadline` honours that
    // override ahead of the untimed branch. The Dart `Envelope` carries no such
    // field, so the device can never produce one and would know nothing about
    // the timeout an alarm would commit. Writing the deadline directly is the
    // same state such a version would leave behind.
    await runInDurableObject(stub, async (_i, state) => {
      state.storage.sql.exec("UPDATE transitions SET deadline = ? WHERE version = 1", Date.now() + 30_000);
    });
    // A refused append reconciles the alarm too, and commits nothing, so the
    // transition carrying the deadline stays the latest one. Appending a valid
    // batch instead would commit an untimed version on top and clear the
    // deadline by itself, proving nothing.
    await api(u.a, "POST", `/games/${gameId}/local/transitions`, { fromVersion: 0, transitions: [move(1, 1)] });

    await runInDurableObject(stub, async (_i, state) => {
      expect(await state.storage.getAlarm()).toBeNull();
    });
  });
});

describe("nobody else can get into a local game", () => {
  it("refuses a join by game id, so a lost start cannot leave one open", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);
    const joined = await api(u.b, "POST", `/games/${gameId}/join`, { clientSchemaVersion: 1 });
    expect(joined.status).toBe(403);
    expect(await codeOf(joined)).toBe("localOnly");
  });

  it("refuses a join by short code, which is the reachable way in", async () => {
    const u = makeUsers();
    const session = await createLocal(u.a);
    // The row carries one because every game does; it must not seat anybody.
    expect(session.shortCode).toBeTruthy();
    const joined = await api(u.b, "POST", "/games/join-by-code", { shortCode: session.shortCode, clientSchemaVersion: 1 });
    expect(joined.status).toBe(403);
    expect(await codeOf(joined)).toBe("localOnly");
  });

  it("records the roster as the game's whole seat range", async () => {
    const u = makeUsers();
    const session = await createLocal(u.a);
    // The rules' range is what the seating had to satisfy; what the row says is
    // the game that was played, and it is what the device's own `localSession`
    // reports for the same game.
    expect(session.players).toHaveLength(2);
    expect(session.minPlayers).toBe(2);
    expect(session.maxPlayers).toBe(2);
  });
});

describe("the local record", () => {
  it("hands the creator the seed and the raw state, which is this route's whole point", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);
    await append(u.a, gameId, 0, [move(0, 1), move(1, 1)]);

    const record = await json<{ seed: string; createdAt: number; finishedAt: number | null; session: Session; transitions: { version: number; state: Record<string, unknown>; pending: number[] }[] }>(await api(u.a, "GET", `/games/${gameId}/local`));
    expect(record.seed).toBe(SEED);
    expect(record.session).toMatchObject({ gameId, origin: "local", version: 2 });
    // The record is everything a second device needs, so it carries the two
    // instants the session does not: a pulled game has to sort into the same
    // lists as one this device played.
    expect(record.createdAt).toBeGreaterThan(0);
    expect(record.finishedAt).toBeNull();
    expect(record.transitions.map((t) => t.version)).toEqual([0, 1, 2]);
    expect(record.transitions.at(-1)?.pending).toEqual([0]);
    // Raw state, hidden fields and all. Every other route projects this away;
    // here the caller is the game's only human and already holds it on the
    // device that played it.
    expect(record.transitions.at(-1)?.state).toEqual({ count: 2, secret: LEAK_SENTINEL });
  });

  it("pages like the frame range", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);
    await append(u.a, gameId, 0, [move(0, 1), move(1, 1)]);
    const page = await json<{ transitions: { version: number }[] }>(await api(u.a, "GET", `/games/${gameId}/local?from=1&to=1`));
    expect(page.transitions.map((t) => t.version)).toEqual([1]);
  });

  it("is creator-only, and only for a game played on a device", async () => {
    const u = makeUsers();
    const { gameId } = await createLocal(u.a);
    const stranger = await api(u.b, "GET", `/games/${gameId}/local`);
    expect(stranger.status).toBe(403);
    expect(await codeOf(stranger)).toBe("notCreator");

    const online = await json<{ gameId: string }>(await api(u.a, "POST", "/games", { access: "private", schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, rated: false }), 201);
    const wrongOrigin = await api(u.a, "GET", `/games/${online.gameId}/local`);
    expect(wrongOrigin.status).toBe(403);
    expect(await codeOf(wrongOrigin)).toBe("localOnly");
  });
});
