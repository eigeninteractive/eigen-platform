/**
 * The createEngine HTTP drive: the deployed shape end to end over the worker:
 * create (policy + short code) waiting room (join/leave/cancel/
 * add-bot/start, roster snapshots over the socket, D1 mirror) active
 * play (action with the own-frame ride-along, forfeit) frames, and the
 * read routes.
 */

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deriveBotKey, signForBot } from "../src/bot/bot-auth.js";
import { orm } from "../src/d1/orm.js";
import { bots, participants } from "../src/d1/schema.js";
import { testBearer as bearer, mintTestToken as mintToken, testMutationHeaders as mutationHeaders } from "../src/testing.js";

const BOT_SECRET = "test-bot-signing-secret";

const db = orm(env.DB);

let userCounter = 0;
/** Fresh identities per test; provisioning is exercised implicitly. */
function makeUsers() {
  const n = ++userCounter;
  return { a: `alice-${n}-${crypto.randomUUID()}`, b: `bob-${n}-${crypto.randomUUID()}`, c: `cesar-${n}-${crypto.randomUUID()}` };
}

interface ApiOptions {
  body?: unknown;
  anonymous?: boolean;
  /** Reuse an exact `Idempotency-Key` to exercise a retry. Omitted, every
   * mutation gets a fresh one, which is what an honest new intent sends. */
  idempotencyKey?: string;
  /** Send no key at all, to exercise the required-header rejection. */
  omitIdempotencyKey?: boolean;
}

async function api(uid: string, method: string, path: string, body?: unknown, anonymous = false, opts: ApiOptions = {}): Promise<Response> {
  const mutating = method !== "GET";
  const key = opts.idempotencyKey ?? crypto.randomUUID();
  return await exports.default.fetch(`https://x/api/engine${path}`, {
    method,
    headers: mutating && opts.omitIdempotencyKey !== true ? await mutationHeaders({ uid, anonymous, idempotencyKey: key }) : { ...(await bearer({ uid, anonymous })), "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return (await res.json()) as T;
}

interface Created {
  gameId: string;
  shortCode: string;
}
interface Session {
  type: "session";
  seq: number;
  gameId: string;
  status: string;
  version: number | null;
  players: { playerIndex: number; userId: string | null; botId: string | null; type: string }[];
  shortCode: string;
  frame: { version: number; data: Record<string, unknown>; pendingPlayers: number[]; outcomes?: unknown[]; ratings?: unknown[] } | null;
}
/** Every accepted command answers with the caller's own session, so the lobby
 * and the play paths share one alias where they used to need two. */
interface CommandOk {
  session: Session;
}

const createBody = { access: "public" as const, schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2 };

async function createGame(uid: string, overrides: Record<string, unknown> = {}): Promise<Created> {
  return await json<Created>(await api(uid, "POST", "/games", { ...createBody, ...overrides }), 201);
}

describe("create", () => {
  it("creates with creator seat 0 and a short code; detail reads back", async () => {
    const u = makeUsers();
    const created = await createGame(u.a, { rated: false });
    expect(created.shortCode).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);

    const detail = await json<{ status: string; participants: { userId: string | null }[]; rated: boolean }>(await api(u.a, "GET", `/games/${created.gameId}`));
    expect(detail.status).toBe("waiting");
    expect(detail.participants).toEqual([{ playerIndex: 0, userId: u.a, botId: null, type: "human" }]);
    expect(detail.rated).toBe(false);
  });

  // The short-code retry loop. Codes are random and 31^6 wide, so a natural
  // collision is never observed in a test run; it has to be forced. This is
  // the only coverage of `isShortCodeCollision`, which classifies the SQLite
  // UNIQUE failure; if it stops matching (a physical column rename, or a
  // change in how `createGame` issues the statement that re-wraps the error),
  // the loop silently stops retrying and a collision surfaces as a 500.
  it("retries a short-code collision and creates with a fresh code", async () => {
    const u = makeUsers();
    const first = await createGame(u.a, { rated: false });

    // `generateShortCode` maps random bytes through this alphabet; inverting it
    // makes the next generated code exactly `first.shortCode`.
    const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    const real = crypto.getRandomValues.bind(crypto);
    let forceOnce = true;
    const spy = vi.spyOn(crypto, "getRandomValues").mockImplementation(((array: ArrayBufferView) => {
      if (forceOnce && array instanceof Uint8Array && array.length === 6) {
        forceOnce = false;
        for (let i = 0; i < 6; i++) array[i] = CODE_ALPHABET.indexOf(first.shortCode[i] as string);
        return array;
      }
      return real(array as Uint8Array);
    }) as typeof crypto.getRandomValues);

    try {
      const second = await createGame(u.b, { rated: false });
      // The forced first attempt collided; the loop retried and landed a
      // different code rather than throwing.
      expect(forceOnce).toBe(false);
      expect(second.shortCode).not.toBe(first.shortCode);
      expect(second.shortCode).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
      expect(second.gameId).not.toBe(first.gameId);
    } finally {
      spy.mockRestore();
    }
  });

  it("defaults to rated when the pool allows, and rejects a false assertion", async () => {
    const u = makeUsers();
    const rated = await createGame(u.a);
    const detail = await json<{ rated: boolean; ratingPool: string | null }>(await api(u.a, "GET", `/games/${rated.gameId}`));
    expect(detail).toMatchObject({ rated: true, ratingPool: "test-pool" });

    // A guest asserting rated is a mismatch (canBeRated is false for guests).
    const res = await api(u.b, "POST", "/games", { ...createBody, rated: true }, true);
    expect(res.status).toBe(422);
  });

  it("gates guests out of friends-access games and validates timing", async () => {
    const u = makeUsers();
    expect((await api(u.a, "POST", "/games", { ...createBody, access: "friends" }, true)).status).toBe(403);
    expect((await api(u.a, "POST", "/games", { ...createBody, turnSeconds: 30, budgetSeconds: 300 })).status).toBe(400);
    expect((await api(u.a, "POST", "/games", { ...createBody, schemaVersion: 99 })).status).toBe(400);
  });
});

describe("waiting room", () => {
  it("join → ready; duplicate join and overflow reject cleanly", async () => {
    const u = makeUsers();
    const { gameId } = await createGame(u.a, { rated: false });

    const joined = await json<CommandOk>(await api(u.b, "POST", `/games/${gameId}/join`, { clientSchemaVersion: 1 }));
    expect(joined.session.status).toBe("ready");
    expect(joined.session.players.map((p) => p.userId)).toEqual([u.a, u.b]);
    expect(joined.session.version).toBeNull();

    const dup = await api(u.b, "POST", `/games/${gameId}/join`, { clientSchemaVersion: 1 });
    expect(dup.status).toBe(409);
    expect(((await dup.json()) as { code: string }).code).toBe("alreadyJoined");

    const full = await api(u.c, "POST", `/games/${gameId}/join`, { clientSchemaVersion: 1 });
    expect(((await full.json()) as { code: string }).code).toBe("gameFull");
  });

  it("join-by-code resolves; the schema gate rejects an old client", async () => {
    const u = makeUsers();
    const { gameId, shortCode } = await createGame(u.a, { rated: false });

    const old = await api(u.b, "POST", "/games/join-by-code", { shortCode, clientSchemaVersion: 0 });
    expect(old.status).toBe(409);
    expect(((await old.json()) as { code: string }).code).toBe("schemaUnsupported");

    const joined = await json<CommandOk>(await api(u.b, "POST", "/games/join-by-code", { shortCode: shortCode.toLowerCase(), clientSchemaVersion: 1 }));
    expect(joined.session.players).toHaveLength(2);
    expect((await db.select().from(participants).where(eq(participants.gameId, gameId)).all()).length).toBeGreaterThanOrEqual(1);
  });

  it("guests cannot join rated games", async () => {
    const u = makeUsers();
    const { gameId } = await createGame(u.a); // rated by default
    expect((await api(u.b, "POST", `/games/${gameId}/join`, { clientSchemaVersion: 1 }, true)).status).toBe(403);
  });

  it("leave compacts and demotes below minPlayers; the creator cannot leave", async () => {
    const u = makeUsers();
    const { gameId } = await createGame(u.a, { rated: false });
    await json<CommandOk>(await api(u.b, "POST", `/games/${gameId}/join`, { clientSchemaVersion: 1 }));

    const creator = await api(u.a, "POST", `/games/${gameId}/leave`, {});
    expect(((await creator.json()) as { code: string }).code).toBe("creatorCannotLeave");

    const left = await json<CommandOk>(await api(u.b, "POST", `/games/${gameId}/leave`, {}));
    expect(left.session.status).toBe("waiting");
    expect(left.session.players).toEqual([{ playerIndex: 0, userId: u.a, botId: null, type: "human" }]);

    await vi.waitFor(async () => {
      const rows = await db.select().from(participants).where(eq(participants.gameId, gameId)).all();
      expect(rows).toHaveLength(1);
    });
  });

  it("cancel is creator-only, aborts the D1 row, and compacts DO game data", async () => {
    const u = makeUsers();
    const { gameId } = await createGame(u.a, { rated: false });
    expect((await api(u.b, "POST", `/games/${gameId}/cancel`, {})).status).toBe(403);

    const cancelled = await json<CommandOk>(await api(u.a, "POST", `/games/${gameId}/cancel`, {}));
    expect(cancelled.session.status).toBe("aborted");

    const detail = await json<{ status: string; participants: unknown[] }>(await api(u.a, "GET", `/games/${gameId}`));
    expect(detail.status).toBe("aborted");
    expect(detail.participants).toEqual([]);

    // A late join fails cleanly at the DO (accepted staleness shape).
    const late = await api(u.b, "POST", `/games/${gameId}/join`, { clientSchemaVersion: 1 });
    expect(late.status).toBe(409);
  });

  it("answers 404 for a command against a game that does not exist", async () => {
    const u = makeUsers();
    const res = await api(u.a, "POST", `/games/${crypto.randomUUID()}/action`, { seat: 0, data: { add: 1 }, expectedVersion: 0 });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe("unknownGame");
  });

  it("start is creator-only and needs ready", async () => {
    const u = makeUsers();
    const { gameId } = await createGame(u.a, { rated: false });
    const early = await api(u.a, "POST", `/games/${gameId}/start`, {});
    expect(early.status).toBe(409); // waiting, not ready

    await json<CommandOk>(await api(u.b, "POST", `/games/${gameId}/join`, { clientSchemaVersion: 1 }));
    expect((await api(u.b, "POST", `/games/${gameId}/start`, {})).status).toBe(403);

    const started = await json<CommandOk>(await api(u.a, "POST", `/games/${gameId}/start`, {}));
    expect(started.session.version).toBe(0);
    expect(started.session.status).toBe("active");
  });
});

describe("active play & frames", () => {
  async function readyGame(u: ReturnType<typeof makeUsers>, overrides: Record<string, unknown> = {}) {
    const { gameId } = await createGame(u.a, overrides);
    await json<CommandOk>(await api(u.b, "POST", `/games/${gameId}/join`, { clientSchemaVersion: 1 }));
    // No mirror wait: the DO resolves seats from its own roster, so the
    // joiner can act the moment the join response lands.
    await json<CommandOk>(await api(u.a, "POST", `/games/${gameId}/start`, {}));
    return gameId;
  }

  it("actions commit over HTTP with the own frame riding; non-participants 403", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u, { rated: false });

    const a1 = await json<CommandOk>(await api(u.a, "POST", `/games/${gameId}/action`, { seat: 0, data: { add: 1 }, expectedVersion: 0 }));
    expect(a1.session.version).toBe(1);
    expect(a1.session.frame?.data).toEqual({ count: 1 });

    // A non-participant naming a seat they don't hold is a clean 403.
    expect((await api(u.c, "POST", `/games/${gameId}/action`, { seat: 1, data: { add: 1 }, expectedVersion: 1 })).status).toBe(403);

    const illegal = await api(u.b, "POST", `/games/${gameId}/action`, { seat: 1, data: { add: 7 }, expectedVersion: 1 });
    expect(illegal.status).toBe(400);
  });

  it("replays a retry and refuses the same Idempotency-Key for a different move", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u, { rated: false });
    const key = crypto.randomUUID();
    const move = { seat: 0, data: { add: 1 }, expectedVersion: 0 };
    const retry = { idempotencyKey: key };

    const first = await json<CommandOk>(await api(u.a, "POST", `/games/${gameId}/action`, move, false, retry));
    // Same key, different move: 422 per the Idempotency-Key specification, and
    // deliberately not 409, which in this API means "resync and retry" — the one
    // thing a caller must not do here.
    const conflict = await api(u.a, "POST", `/games/${gameId}/action`, { ...move, data: { add: 2 } }, false, retry);
    expect(conflict.status).toBe(422);
    expect(await conflict.json()).toMatchObject({ code: "commandConflict" });

    // Same key, same move: the committed result, exactly once.
    const replay = await json<CommandOk>(await api(u.a, "POST", `/games/${gameId}/action`, move, false, retry));
    expect(replay).toEqual(first);
  });

  it("requires an Idempotency-Key on every mutation", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u, { rated: false });
    const res = await api(u.a, "POST", `/games/${gameId}/action`, { seat: 0, data: { add: 1 }, expectedVersion: 0 }, false, { omitIdempotencyKey: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "idempotencyKeyInvalid" });
  });

  it("plays to a rated finish; ratings land; frames replay for a viewer", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u);

    await json<CommandOk>(await api(u.a, "POST", `/games/${gameId}/action`, { seat: 0, data: { add: 2 }, expectedVersion: 0 }));
    const finish = await json<CommandOk>(await api(u.b, "POST", `/games/${gameId}/action`, { seat: 1, data: { add: 2 }, expectedVersion: 1 }));
    expect(finish.session.frame?.outcomes).toBeDefined();
    expect(finish.session.status).toBe("finished");

    await vi.waitFor(async () => {
      const detail = await json<{ status: string; outcomes: unknown[] | null }>(await api(u.a, "GET", `/games/${gameId}`));
      expect(detail.status).toBe("finished");
      expect(detail.outcomes).toHaveLength(2);
    });

    // Participant frames: live path.
    const mine = await json<{ frames: { version: number }[] }>(await api(u.a, "GET", `/games/${gameId}/frames?from=0&to=10`));
    expect(mine.frames.length).toBeGreaterThanOrEqual(3);

    // A non-participant can replay a finished PUBLIC game as viewer.
    const viewer = await json<{ frames: { version: number; ratings?: unknown[] }[] }>(await api(u.c, "GET", `/games/${gameId}/frames?from=0&to=10`));
    expect(viewer.frames.map((f) => f.version)).toEqual([0, 1, 2, 3]);
    expect(viewer.frames[3]?.ratings).toHaveLength(2);

    const history = await json<{ history: { pool: string; displayChange: number }[] }>(await api(u.b, "GET", "/me/rating-history"));
    expect(history.history).toHaveLength(1);
    expect(history.history[0]?.pool).toBe("test-pool");
    const ratings = await json<{ ratings: { pool: string }[] }>(await api(u.b, "GET", "/me/ratings"));
    expect(ratings.ratings).toHaveLength(1);

    // The two parameters that used to fail silently on an empty value: `?pool=`
    // became `WHERE pool = ''` and matched nothing, and `?to=` became `to: 0`,
    // which clamped the replay to a single frame. Both are now refused outright
    // rather than answered with a plausible, wrong 200.
    expect((await api(u.b, "GET", "/me/rating-history?pool=")).status).toBe(400);
    expect((await api(u.c, "GET", `/games/${gameId}/frames?from=0&to=`)).status).toBe(400);
    // And the range still works when it is actually given.
    const ranged = await json<{ frames: { version: number }[] }>(await api(u.c, "GET", `/games/${gameId}/frames?from=0&to=10`));
    expect(ranged.frames.map((f) => f.version)).toEqual([0, 1, 2, 3]);

    // The summary carries every identity's delta, so a history list needs no
    // second read to annotate a row, and the same projection is correct when
    // viewing someone else's games, since this is per-game not per-viewer.
    const summary = await json<{ ratings?: { identity: { userId: string | null }; displayChange: number }[] }>(await api(u.c, "GET", `/games/${gameId}`));
    expect((summary.ratings ?? []).map((r) => r.identity.userId).sort()).toEqual([u.a, u.b].sort());
  });

  it("forfeit resolves through the same command path", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u, { rated: false });
    const result = await json<CommandOk>(await api(u.b, "POST", `/games/${gameId}/forfeit`, { seat: 1 }));
    expect(result.session.frame?.outcomes).toBeDefined();
  });

  it("keeps frames private: a non-participant cannot read an active game", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u, { rated: false });
    expect((await api(u.c, "GET", `/games/${gameId}/frames?from=0&to=10`)).status).toBe(403);
  });
});

describe("socket (session snapshots)", () => {
  it("accepts the configured browser origin and rejects an unknown one", async () => {
    const u = makeUsers();
    const { gameId } = await createGame(u.a, { rated: false });
    const token = await mintToken({ uid: u.a });
    const url = `https://x/api/engine/games/${gameId}/socket?token=${token}`;

    const denied = await exports.default.fetch(url, {
      headers: {
        Upgrade: "websocket",
        Origin: "https://evil.example",
      },
    });
    expect(denied.status).toBe(403);

    const allowed = await exports.default.fetch(url, {
      headers: {
        Upgrade: "websocket",
        Origin: "https://app.example",
      },
    });
    expect(allowed.status).toBe(101);
    allowed.webSocket?.accept();
    allowed.webSocket?.close();
  });

  it("serves one socket across the lobby → active transition", async () => {
    const u = makeUsers();
    const { gameId } = await createGame(u.a, { rated: false });

    const token = await mintToken({ uid: u.b });
    const res = await exports.default.fetch(`https://x/api/engine/games/${gameId}/socket?token=${token}`, { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("no websocket on the 101 response");
    const messages: Session[] = [];
    ws.addEventListener("message", (event: MessageEvent) => {
      messages.push(JSON.parse(event.data as string));
    });
    ws.accept();

    // Pre-join, pre-start: the current snapshot rides the open.
    await vi.waitFor(() => expect(messages).toHaveLength(1));
    expect(messages[0]).toMatchObject({ type: "session", status: "waiting", version: null, frame: null });
    expect(messages[0]?.players).toHaveLength(1);

    // Joining pushes the new snapshot to every socket, including this one,
    // whose principal just became seat 1.
    await json<CommandOk>(await api(u.b, "POST", `/games/${gameId}/join`, { clientSchemaVersion: 1 }));
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    expect(messages[1]).toMatchObject({ type: "session", status: "ready" });

    // Start: v0 fan-out reaches the seat through the SAME socket.
    await json<CommandOk>(await api(u.a, "POST", `/games/${gameId}/start`, {}));
    await vi.waitFor(() => expect(messages).toHaveLength(3));
    // The status and the opening frame arrive as one value, which is what makes
    // a waiting room that never learns the game started impossible.
    expect(messages[2]).toMatchObject({ type: "session", status: "active", version: 0 });
    expect(messages[2]?.frame).toMatchObject({ version: 0 });
    ws.close();
  });
});

describe("bots", () => {
  // Fixed registry rows: engine brains are keyed by username, so the engine
  // bot's username must match the test game's `botActions`. Seeded once
  // (idempotent); bots are global registry data, seatable across games.
  const ENGINE = "test-engine-bot";
  const EXTERNAL = "test-external-bot";
  const LOCAL = "test-local-bot";
  // The external bot's wake target. Intercepted below so the DO's fire-and-forget
  // wake resolves instantly (202) instead of making a real outbound fetch to an
  // unresolvable host, because that call fails nondeterministically slowly under load,
  // and until it settles the bot's follow-up `bot/action` command queues behind
  // it on the same DO, so the move sometimes doesn't land before `vi.waitFor`
  // gives up. This version of vitest-pool-workers dropped the `fetchMock`
  // MockAgent, so we wrap `globalThis.fetch` exactly as the pool itself does for
  // MSW. The test and the DO share one workerd isolate, so the DO's `fetch`
  // picks up the override.
  const WAKE_ORIGIN = "https://wake.test";
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(WAKE_ORIGIN)) return new Response("", { status: 202 });
      return realFetch(input, init);
    }) as typeof fetch;

    await db
      .insert(bots)
      .values([
        { id: ENGINE, username: ENGINE, displayName: "Engine Bot", avatarUrl: null, schemaVersion: 1, type: "engine", webhookUrl: null, ratedEligible: false, config: {}, createdAt: Date.now() },
        { id: EXTERNAL, username: EXTERNAL, displayName: "External Bot", avatarUrl: null, schemaVersion: 1, type: "external", webhookUrl: `${WAKE_ORIGIN}/wake`, ratedEligible: false, config: {}, createdAt: Date.now() },
        { id: LOCAL, username: LOCAL, displayName: "Local Bot", avatarUrl: null, schemaVersion: 1, type: "local", webhookUrl: null, ratedEligible: false, config: {}, createdAt: Date.now() },
      ])
      .onConflictDoNothing();
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  const soloBody = (botId: string) => ({ schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, turnSeconds: 60, rated: false, botIds: [botId] });

  it("plays a human-vs-bot solo game through the in-DO brain", async () => {
    const u = makeUsers();
    const solo = await json<CommandOk>(await api(u.a, "POST", "/games/solo", soloBody(ENGINE)), 201);
    expect(solo.session.version).toBe(0);
    expect(solo.session.status).toBe("active");
    expect(solo.session.frame?.data.count).toBe(0);

    // The human opens (v1); the bot answers via its in-DO brain (add 1),
    // committing v2 with no second client involved.
    await json<CommandOk>(await api(u.a, "POST", `/games/${solo.session.gameId}/action`, { seat: 0, data: { add: 1 }, expectedVersion: 0 }));
    await vi.waitFor(async () => {
      const frames = await json<{ frames: { version: number; data: { count: number } }[] }>(await api(u.a, "GET", `/games/${solo.session.gameId}/frames?from=0&to=10`));
      expect(frames.frames.find((f) => f.version === 2)?.data.count).toBe(2);
    });
  });

  it("rejects seating a bot in an untimed game (bots ⇒ timed)", async () => {
    const u = makeUsers();
    // The default game is untimed; add-bot must refuse it.
    const { gameId } = await createGame(u.a, { rated: false });
    const res = await api(u.a, "POST", `/games/${gameId}/add-bot`, { botId: ENGINE });
    expect(res.status).toBe(400);
  });

  it("rejects seating a local bot online (reserved for offline import)", async () => {
    const u = makeUsers();
    const res = await api(u.a, "POST", "/games/solo", soloBody(LOCAL));
    expect(res.status).toBe(400);
  });

  it("guests may create a solo bot game (unrated)", async () => {
    const u = makeUsers();
    const solo = await api(u.a, "POST", "/games/solo", soloBody(ENGINE), true);
    expect(solo.status).toBe(201);
  });

  it("accepts an external bot's HMAC-signed move on bot/action; rejects a forged one", async () => {
    const u = makeUsers();
    // An external bot: its webhook_url means the DO wakes it instead of running
    // an in-DO brain. The wake is intercepted (202) in beforeAll; the move
    // arrives here on bot/action.
    const solo = await json<CommandOk>(await api(u.a, "POST", "/games/solo", soloBody(EXTERNAL)), 201);
    // Human opens (v1); now seat 1 (the external bot) is due.
    await json<CommandOk>(await api(u.a, "POST", `/games/${solo.session.gameId}/action`, { seat: 0, data: { add: 1 }, expectedVersion: 0 }));

    // The bot signs the EXACT body bytes it sends and carries the signature in
    // the Eigen-Signature header, bound to the `action` domain.
    const body = JSON.stringify({ botId: EXTERNAL, gameId: solo.session.gameId, playerIndex: 1, version: 1, data: { add: 1 } });
    const good = await exports.default.fetch("https://x/api/bot/action", {
      method: "POST",
      headers: { "content-type": "application/json", "eigen-signature": await signForBot(BOT_SECRET, EXTERNAL, "action", body) },
      body,
    });
    expect(good.status).toBe(204);
    await vi.waitFor(async () => {
      const frames = await json<{ frames: { version: number; data: { count: number } }[] }>(await api(u.a, "GET", `/games/${solo.session.gameId}/frames?from=0&to=10`));
      expect(frames.frames.find((f) => f.version === 2)?.data.count).toBe(2);
    });

    // A forged signature (wrong secret) is rejected before the claim is trusted.
    const forged = await exports.default.fetch("https://x/api/bot/action", {
      method: "POST",
      headers: { "content-type": "application/json", "eigen-signature": await signForBot("wrong-secret", EXTERNAL, "action", body) },
      body,
    });
    expect(forged.status).toBe(401);
  });

  it("deriveBotKey yields exactly the key a bot owner signs with", async () => {
    // The operator utility: what you hand a bot's owner at registration. This
    // asserts the contract from the OWNER's side: sign with nothing but the
    // derived key, using plain WebCrypto the way their own code would, and the
    // engine must accept it. If this passes, the documented onboarding works.
    const derived = await deriveBotKey(BOT_SECRET, EXTERNAL);

    // It is HMAC-SHA256(master, botId), base64: the same bytes the documented
    // `openssl dgst -sha256 -hmac` one-liner produces.
    const master = await crypto.subtle.importKey("raw", new TextEncoder().encode(BOT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", master, new TextEncoder().encode(EXTERNAL))).toBase64();
    expect(derived).toBe(expected);

    // Sign a body with the derived key alone, no master secret in sight.
    const u = makeUsers();
    const solo = await json<CommandOk>(await api(u.a, "POST", "/games/solo", soloBody(EXTERNAL)), 201);
    await json<CommandOk>(await api(u.a, "POST", `/games/${solo.session.gameId}/action`, { seat: 0, data: { add: 1 }, expectedVersion: 0 }));

    const body = JSON.stringify({ botId: EXTERNAL, gameId: solo.session.gameId, playerIndex: 1, version: 1, data: { add: 1 } });
    const ownerKey = await crypto.subtle.importKey("raw", Uint8Array.fromBase64(derived) as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", ownerKey, new TextEncoder().encode(`action:${body}`))).toBase64();

    const res = await exports.default.fetch("https://x/api/bot/action", {
      method: "POST",
      headers: { "content-type": "application/json", "eigen-signature": `v1,${sig}` },
      body,
    });
    expect(res.status).toBe(204);
  });
});

describe("reads", () => {
  it("lobby lists public joinable games; my-games buckets by participants", async () => {
    const u = makeUsers();
    const { gameId } = await createGame(u.a, { rated: false });

    const lobby = await json<{ games: { id: string }[] }>(await api(u.c, "GET", "/lobby?limit=50"));
    expect(lobby.games.some((g) => g.id === gameId)).toBe(true);

    const mine = await json<{ games: { id: string }[] }>(await api(u.a, "GET", "/games/mine?bucket=active"));
    expect(mine.games.some((g) => g.id === gameId)).toBe(true);
    const notMine = await json<{ games: { id: string }[] }>(await api(u.b, "GET", "/games/mine?bucket=active"));
    expect(notMine.games.some((g) => g.id === gameId)).toBe(false);
  });

  // Absent is the first page. Empty is a MALFORMED request, and the difference
  // between those two is the whole story of this bug: `Number("")` is 0, so an
  // empty cursor used to parse as a real cursor of zero, which is older than
  // every timestamp there has ever been. The lobby, both my-games buckets and
  // the friends list all returned 200 with an empty list. Nothing coerces now,
  // so the same request is a 400 that names itself.
  it("serves the first page when a cursor is absent", async () => {
    const u = makeUsers();
    const { gameId } = await createGame(u.a, { rated: false });

    const lobby = await json<{ games: { id: string }[] }>(await api(u.c, "GET", "/lobby"));
    expect(lobby.games.some((g) => g.id === gameId)).toBe(true);
    const mine = await json<{ games: { id: string }[] }>(await api(u.a, "GET", "/games/mine?bucket=active"));
    expect(mine.games.some((g) => g.id === gameId)).toBe(true);
  });

  it.each(["/lobby?cursor=", "/lobby?limit=", "/games/mine?cursor=", "/games/mine?bucket=active&cursor=", "/me/rating-history?pool=", "/players/x/games?cursor="])("refuses an empty query value rather than reading it as zero (%s)", async (path) => {
    const u = makeUsers();
    expect((await api(u.a, "GET", path)).status).toBe(400);
  });

  // The other half of the same rule: a cursor that is actually sent still pages.
  // Without this, "ignore the cursor entirely" would pass the test above.
  it("a server-issued cursor excludes everything on the page it came from", async () => {
    const u = makeUsers();
    const older = await createGame(u.a, { rated: false });
    const newer = await createGame(u.a, { rated: false });

    const page = await json<{ games: { id: string }[]; nextCursor: string | null }>(await api(u.a, "GET", "/games/mine?bucket=active&limit=1"));
    expect(page.games).toHaveLength(1);
    expect(page.nextCursor).not.toBeNull();

    const next = await json<{ games: { id: string }[]; nextCursor: string | null }>(await api(u.a, "GET", `/games/mine?bucket=active&limit=1&cursor=${encodeURIComponent(page.nextCursor ?? "")}`));
    expect(next.games).toHaveLength(1);
    expect(next.games[0].id).not.toBe(page.games[0].id);
    // The two pages together are the two games, each exactly once.
    expect(new Set([page.games[0].id, next.games[0].id])).toEqual(new Set([older.gameId, newer.gameId]));
    expect(next.nextCursor).toBeNull();
  });

  it("players batch endpoint returns public identity only", async () => {
    const u = makeUsers();
    await api(u.a, "GET", "/me");
    await api(u.b, "GET", "/me");
    const res = await json<{ players: Record<string, unknown>[] }>(await api(u.c, "GET", `/players?ids=${u.a},${u.b},unknown-uid`));
    expect(res.players).toHaveLength(2);
    for (const p of res.players) {
      expect(Object.keys(p).sort()).toEqual(["avatarUrl", "displayName", "id", "isAnonymous", "username"]);
    }
  });
});
