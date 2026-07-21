/**
 * The createEngine HTTP drive — the deployed shape end to end over SELF:
 * create (policy + short code) waiting room (join/leave/cancel/
 * add-bot/start, roster snapshots over the socket, D1 mirror) active
 * play (action with the own-frame ride-along, forfeit) frames, and the
 * read routes.
 */

import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { signForBot } from "../src/bot/bot-auth.js";
import { bots, participants } from "../src/d1/schema.js";
import { testBearer as bearer, mintTestToken as mintToken } from "../src/testing.js";

const BOT_SECRET = "test-bot-signing-secret";

const db = drizzle(env.DB);

let userCounter = 0;
/** Fresh identities per test — provisioning is exercised implicitly. */
function makeUsers() {
  const n = ++userCounter;
  return { a: `alice-${n}-${crypto.randomUUID()}`, b: `bob-${n}-${crypto.randomUUID()}`, c: `cesar-${n}-${crypto.randomUUID()}` };
}

async function api(uid: string, method: string, path: string, body?: unknown, anonymous = false): Promise<Response> {
  return await SELF.fetch(`https://x/api/engine${path}`, {
    method,
    headers: { ...(await bearer({ uid, anonymous })), "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return (await res.json()) as T;
}

interface Created {
  game_id: string;
  short_code: string;
}
interface LobbyOk {
  roster: { type: "roster"; status: string; players: { player_index: number; user_id: string | null; bot_id: string | null; type: string }[] };
}
interface CommandOk {
  version: number;
  frame: { version: number; data: Record<string, unknown>; pending_players: number[]; outcomes?: unknown[] } | null;
}

const createBody = { access: "public" as const, schema_version: 1, config: { target: 3 }, min_players: 2, max_players: 2 };

async function createGame(uid: string, overrides: Record<string, unknown> = {}): Promise<Created> {
  return await json<Created>(await api(uid, "POST", "/games", { ...createBody, ...overrides }), 201);
}

describe("create", () => {
  it("creates with creator seat 0 and a short code; detail reads back", async () => {
    const u = makeUsers();
    const created = await createGame(u.a, { rated: false });
    expect(created.short_code).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);

    const detail = await json<{ status: string; participants: { user_id: string | null }[]; rated: boolean }>(await api(u.a, "GET", `/games/${created.game_id}`));
    expect(detail.status).toBe("waiting");
    expect(detail.participants).toEqual([{ player_index: 0, user_id: u.a, bot_id: null, type: "human" }]);
    expect(detail.rated).toBe(false);
  });

  it("defaults to rated when the pool allows, and rejects a false assertion", async () => {
    const u = makeUsers();
    const rated = await createGame(u.a);
    const detail = await json<{ rated: boolean; rating_pool: string | null }>(await api(u.a, "GET", `/games/${rated.game_id}`));
    expect(detail).toMatchObject({ rated: true, rating_pool: "test-pool" });

    // A guest asserting rated is a mismatch (canBeRated is false for guests).
    const res = await api(u.b, "POST", "/games", { ...createBody, rated: true }, true);
    expect(res.status).toBe(422);
  });

  it("gates guests out of friends-access games and validates timing", async () => {
    const u = makeUsers();
    expect((await api(u.a, "POST", "/games", { ...createBody, access: "friends" }, true)).status).toBe(403);
    expect((await api(u.a, "POST", "/games", { ...createBody, turn_seconds: 30, budget_seconds: 300 })).status).toBe(400);
    expect((await api(u.a, "POST", "/games", { ...createBody, schema_version: 99 })).status).toBe(400);
  });
});

describe("waiting room", () => {
  it("join → ready; duplicate join and overflow reject cleanly", async () => {
    const u = makeUsers();
    const { game_id } = await createGame(u.a, { rated: false });

    const joined = await json<LobbyOk>(await api(u.b, "POST", `/games/${game_id}/join`, { client_schema_version: 1 }));
    expect(joined.roster.status).toBe("ready");
    expect(joined.roster.players.map((p) => p.user_id)).toEqual([u.a, u.b]);

    const dup = await api(u.b, "POST", `/games/${game_id}/join`, { client_schema_version: 1 });
    expect(dup.status).toBe(409);
    expect(((await dup.json()) as { code: string }).code).toBe("already_joined");

    const full = await api(u.c, "POST", `/games/${game_id}/join`, { client_schema_version: 1 });
    expect(((await full.json()) as { code: string }).code).toBe("game_full");
  });

  it("join-by-code resolves; the schema gate rejects an old client", async () => {
    const u = makeUsers();
    const { game_id, short_code } = await createGame(u.a, { rated: false });

    const old = await api(u.b, "POST", "/games/join-by-code", { short_code, client_schema_version: 0 });
    expect(old.status).toBe(409);
    expect(((await old.json()) as { code: string }).code).toBe("schema_unsupported");

    const joined = await json<LobbyOk>(await api(u.b, "POST", "/games/join-by-code", { short_code: short_code.toLowerCase(), client_schema_version: 1 }));
    expect(joined.roster.players).toHaveLength(2);
    expect((await db.select().from(participants).where(eq(participants.gameId, game_id)).all()).length).toBeGreaterThanOrEqual(1);
  });

  it("guests cannot join rated games", async () => {
    const u = makeUsers();
    const { game_id } = await createGame(u.a); // rated by default
    expect((await api(u.b, "POST", `/games/${game_id}/join`, { client_schema_version: 1 }, true)).status).toBe(403);
  });

  it("leave compacts and demotes below min_players; the creator cannot leave", async () => {
    const u = makeUsers();
    const { game_id } = await createGame(u.a, { rated: false });
    await json<LobbyOk>(await api(u.b, "POST", `/games/${game_id}/join`, { client_schema_version: 1 }));

    const creator = await api(u.a, "POST", `/games/${game_id}/leave`, {});
    expect(((await creator.json()) as { code: string }).code).toBe("creator_cannot_leave");

    const left = await json<LobbyOk>(await api(u.b, "POST", `/games/${game_id}/leave`, {}));
    expect(left.roster.status).toBe("waiting");
    expect(left.roster.players).toEqual([{ player_index: 0, user_id: u.a, bot_id: null, type: "human" }]);

    await vi.waitFor(async () => {
      const rows = await db.select().from(participants).where(eq(participants.gameId, game_id)).all();
      expect(rows).toHaveLength(1);
    });
  });

  it("cancel is creator-only, aborts the D1 row, and drops DO storage", async () => {
    const u = makeUsers();
    const { game_id } = await createGame(u.a, { rated: false });
    expect((await api(u.b, "POST", `/games/${game_id}/cancel`, {})).status).toBe(403);

    const cancelled = await json<LobbyOk>(await api(u.a, "POST", `/games/${game_id}/cancel`, {}));
    expect(cancelled.roster.status).toBe("aborted");

    const detail = await json<{ status: string; participants: unknown[] }>(await api(u.a, "GET", `/games/${game_id}`));
    expect(detail.status).toBe("aborted");
    expect(detail.participants).toEqual([]);

    // A late join fails cleanly at the DO (accepted staleness shape).
    const late = await api(u.b, "POST", `/games/${game_id}/join`, { client_schema_version: 1 });
    expect(late.status).toBe(409);
  });

  it("answers 404 for a command against a game that does not exist", async () => {
    const u = makeUsers();
    const res = await api(u.a, "POST", `/games/${crypto.randomUUID()}/action`, { seat: 0, data: { add: 1 }, expected_version: 0 });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe("unknown_game");
  });

  it("start is creator-only and needs ready", async () => {
    const u = makeUsers();
    const { game_id } = await createGame(u.a, { rated: false });
    const early = await api(u.a, "POST", `/games/${game_id}/start`, {});
    expect(early.status).toBe(409); // waiting, not ready

    await json<LobbyOk>(await api(u.b, "POST", `/games/${game_id}/join`, { client_schema_version: 1 }));
    expect((await api(u.b, "POST", `/games/${game_id}/start`, {})).status).toBe(403);

    const started = await json<CommandOk>(await api(u.a, "POST", `/games/${game_id}/start`, {}));
    expect(started.version).toBe(0);
  });
});

describe("active play & frames", () => {
  async function readyGame(u: ReturnType<typeof makeUsers>, overrides: Record<string, unknown> = {}) {
    const { game_id } = await createGame(u.a, overrides);
    await json<LobbyOk>(await api(u.b, "POST", `/games/${game_id}/join`, { client_schema_version: 1 }));
    // No mirror wait: the DO resolves seats from its own roster — the
    // joiner can act the moment the join response lands.
    await json<CommandOk>(await api(u.a, "POST", `/games/${game_id}/start`, {}));
    return game_id;
  }

  it("actions commit over HTTP with the own frame riding; non-participants 403", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u, { rated: false });

    const a1 = await json<CommandOk>(await api(u.a, "POST", `/games/${gameId}/action`, { seat: 0, data: { add: 1 }, expected_version: 0 }));
    expect(a1.version).toBe(1);
    expect(a1.frame?.data).toEqual({ count: 1 });

    // A non-participant naming a seat they don't hold is a clean 403.
    expect((await api(u.c, "POST", `/games/${gameId}/action`, { seat: 1, data: { add: 1 }, expected_version: 1 })).status).toBe(403);

    const illegal = await api(u.b, "POST", `/games/${gameId}/action`, { seat: 1, data: { add: 7 }, expected_version: 1 });
    expect(illegal.status).toBe(400);
  });

  it("plays to a rated finish; ratings land; frames replay for a viewer", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u);

    await json<CommandOk>(await api(u.a, "POST", `/games/${gameId}/action`, { seat: 0, data: { add: 2 }, expected_version: 0 }));
    const finish = await json<CommandOk>(await api(u.b, "POST", `/games/${gameId}/action`, { seat: 1, data: { add: 2 }, expected_version: 1 }));
    expect(finish.frame?.outcomes).toBeDefined();

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

    const history = await json<{ history: { pool: string; display_change: number }[] }>(await api(u.b, "GET", "/me/rating-history"));
    expect(history.history).toHaveLength(1);
    expect(history.history[0]?.pool).toBe("test-pool");
    const ratings = await json<{ ratings: { pool: string }[] }>(await api(u.b, "GET", "/me/ratings"));
    expect(ratings.ratings).toHaveLength(1);
  });

  it("forfeit resolves through the same command path", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u, { rated: false });
    const result = await json<CommandOk>(await api(u.b, "POST", `/games/${gameId}/forfeit`, { seat: 1 }));
    expect(result.frame?.outcomes).toBeDefined();
  });

  it("keeps frames private: a non-participant cannot read an active game", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u, { rated: false });
    expect((await api(u.c, "GET", `/games/${gameId}/frames?from=0&to=10`)).status).toBe(403);
  });
});

describe("socket (roster snapshots → frames)", () => {
  it("serves one socket across the lobby → active transition", async () => {
    const u = makeUsers();
    const { game_id } = await createGame(u.a, { rated: false });

    const token = await mintToken({ uid: u.b });
    const res = await SELF.fetch(`https://x/api/engine/games/${game_id}/socket?token=${token}`, { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("no websocket on the 101 response");
    const messages: { type: string; status?: string; players?: unknown[]; version?: number }[] = [];
    ws.addEventListener("message", (event: MessageEvent) => {
      messages.push(JSON.parse(event.data as string));
    });
    ws.accept();

    // Pre-join, pre-start: the current snapshot rides the open.
    await vi.waitFor(() => expect(messages).toHaveLength(1));
    expect(messages[0]).toMatchObject({ type: "roster", status: "waiting" });
    expect(messages[0]?.players).toHaveLength(1);

    // Joining pushes the new snapshot to every socket — including this one,
    // whose principal just became seat 1.
    await json<LobbyOk>(await api(u.b, "POST", `/games/${game_id}/join`, { client_schema_version: 1 }));
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    expect(messages[1]).toMatchObject({ type: "roster", status: "ready" });

    // Start: v0 fan-out reaches the seat through the SAME socket.
    await json<CommandOk>(await api(u.a, "POST", `/games/${game_id}/start`, {}));
    await vi.waitFor(() => expect(messages).toHaveLength(3));
    expect(messages[2]).toMatchObject({ type: "frame", version: 0 });
    ws.close();
  });
});

describe("bots", () => {
  // Fixed registry rows: engine brains are keyed by username, so the engine
  // bot's username must match the test game's `botActions`. Seeded once
  // (idempotent) — bots are global registry data, seatable across games.
  const ENGINE = "test-engine-bot";
  const EXTERNAL = "test-external-bot";
  const LOCAL = "test-local-bot";
  // The external bot's wake target. Intercepted below so the DO's fire-and-forget
  // wake resolves instantly (202) instead of making a real outbound fetch to an
  // unresolvable host — that call fails nondeterministically slowly under load,
  // and until it settles the bot's follow-up `bot/action` command queues behind
  // it on the same DO, so the move sometimes doesn't land before `vi.waitFor`
  // gives up. This version of vitest-pool-workers dropped the `fetchMock`
  // MockAgent, so we wrap `globalThis.fetch` exactly as the pool itself does for
  // MSW — the test and the DO share one workerd isolate, so the DO's `fetch`
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

  const soloBody = (botId: string) => ({ schema_version: 1, config: { target: 3 }, min_players: 2, max_players: 2, turn_seconds: 60, rated: false, bot_ids: [botId] });

  it("plays a human-vs-bot solo game through the in-DO brain", async () => {
    const u = makeUsers();
    const solo = await json<{ game_id: string; version: number; frame: { data: { count: number } } | null }>(await api(u.a, "POST", "/games/solo", soloBody(ENGINE)), 201);
    expect(solo.version).toBe(0);
    expect(solo.frame?.data.count).toBe(0);

    // The human opens (v1); the bot answers via its in-DO brain (add 1),
    // committing v2 with no second client involved.
    await json<CommandOk>(await api(u.a, "POST", `/games/${solo.game_id}/action`, { seat: 0, data: { add: 1 }, expected_version: 0 }));
    await vi.waitFor(async () => {
      const frames = await json<{ frames: { version: number; data: { count: number } }[] }>(await api(u.a, "GET", `/games/${solo.game_id}/frames?from=0&to=10`));
      expect(frames.frames.find((f) => f.version === 2)?.data.count).toBe(2);
    });
  });

  it("rejects seating a bot in an untimed game (bots ⇒ timed)", async () => {
    const u = makeUsers();
    // The default game is untimed; add-bot must refuse it.
    const { game_id } = await createGame(u.a, { rated: false });
    const res = await api(u.a, "POST", `/games/${game_id}/add-bot`, { bot_id: ENGINE });
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
    const solo = await json<{ game_id: string }>(await api(u.a, "POST", "/games/solo", soloBody(EXTERNAL)), 201);
    // Human opens (v1); now seat 1 (the external bot) is due.
    await json<CommandOk>(await api(u.a, "POST", `/games/${solo.game_id}/action`, { seat: 0, data: { add: 1 }, expected_version: 0 }));

    // The bot signs the EXACT body bytes it sends and carries the signature in
    // the Eigen-Signature header, bound to the `action` domain.
    const body = JSON.stringify({ bot_id: EXTERNAL, game_id: solo.game_id, player_index: 1, version: 1, data: { add: 1 } });
    const good = await SELF.fetch("https://x/api/bot/action", {
      method: "POST",
      headers: { "content-type": "application/json", "eigen-signature": await signForBot(BOT_SECRET, EXTERNAL, "action", body) },
      body,
    });
    expect(good.status).toBe(204);
    await vi.waitFor(async () => {
      const frames = await json<{ frames: { version: number; data: { count: number } }[] }>(await api(u.a, "GET", `/games/${solo.game_id}/frames?from=0&to=10`));
      expect(frames.frames.find((f) => f.version === 2)?.data.count).toBe(2);
    });

    // A forged signature (wrong secret) is rejected before the claim is trusted.
    const forged = await SELF.fetch("https://x/api/bot/action", {
      method: "POST",
      headers: { "content-type": "application/json", "eigen-signature": await signForBot("wrong-secret", EXTERNAL, "action", body) },
      body,
    });
    expect(forged.status).toBe(401);
  });
});

describe("reads", () => {
  it("lobby lists public joinable games; my-games buckets by participants", async () => {
    const u = makeUsers();
    const { game_id } = await createGame(u.a, { rated: false });

    const lobby = await json<{ games: { id: string }[] }>(await api(u.c, "GET", "/lobby?limit=50"));
    expect(lobby.games.some((g) => g.id === game_id)).toBe(true);

    const mine = await json<{ games: { id: string }[] }>(await api(u.a, "GET", "/games/mine?bucket=active"));
    expect(mine.games.some((g) => g.id === game_id)).toBe(true);
    const notMine = await json<{ games: { id: string }[] }>(await api(u.b, "GET", "/games/mine?bucket=active"));
    expect(notMine.games.some((g) => g.id === game_id)).toBe(false);
  });

  it("players batch endpoint returns public identity only", async () => {
    const u = makeUsers();
    await api(u.a, "GET", "/me");
    await api(u.b, "GET", "/me");
    const res = await json<{ players: Record<string, unknown>[] }>(await api(u.c, "GET", `/players?ids=${u.a},${u.b},unknown-uid`));
    expect(res.players).toHaveLength(2);
    for (const p of res.players) {
      expect(Object.keys(p).sort()).toEqual(["avatar_url", "display_name", "id", "is_anonymous", "username"]);
    }
  });
});
