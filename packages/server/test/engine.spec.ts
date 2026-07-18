/**
 * The createEngine HTTP drive — the deployed shape end to end over SELF:
 * §4.1 create (policy + short code), §4.2 waiting room (join/leave/cancel/
 * add-bot/start, roster snapshots over the socket, D1 mirror), §4.3 active
 * play (action with the own-frame ride-along, forfeit), §4.6 frames, and the
 * §5.2 read routes.
 */

import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it, vi } from "vitest";
import { participants } from "../src/d1/schema.js";
import { testBearer as bearer, mintTestToken as mintToken } from "../src/testing.js";

const db = drizzle(env.DB);

let userCounter = 0;
/** Fresh identities per test — provisioning is exercised implicitly. */
function makeUsers() {
  const n = ++userCounter;
  return { a: `alice-${n}-${crypto.randomUUID()}`, b: `bob-${n}-${crypto.randomUUID()}`, c: `cesar-${n}-${crypto.randomUUID()}` };
}

async function api(uid: string, method: string, path: string, body?: unknown, anonymous = false): Promise<Response> {
  return await SELF.fetch(`https://x/api${path}`, {
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
  ok: true;
  roster: { type: "roster"; status: string; players: { player_index: number; user_id: string | null; bot_id: string | null; type: string }[] };
}
interface CommandOk {
  ok: true;
  version: number;
  frame: { version: number; data: Record<string, unknown>; pending_players: number[]; outcomes?: unknown[] } | null;
}

const createBody = { schema_version: 1, config: { target: 3 }, min_players: 2, max_players: 2 };

async function createGame(uid: string, overrides: Record<string, unknown> = {}): Promise<Created> {
  return await json<Created>(await api(uid, "POST", "/games", { ...createBody, ...overrides }));
}

describe("create (§4.1)", () => {
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

describe("waiting room (§4.2)", () => {
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

    // A late join fails cleanly at the DO (§4.2 accepted staleness shape).
    const late = await api(u.b, "POST", `/games/${game_id}/join`, { client_schema_version: 1 });
    expect(late.status).toBe(409);
  });

  it("answers 404 for a command against a game that does not exist", async () => {
    const u = makeUsers();
    const res = await api(u.a, "POST", `/games/${crypto.randomUUID()}/action`, { data: { add: 1 }, expected_version: 0 });
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

describe("active play (§4.3) & frames (§4.6)", () => {
  async function readyGame(u: ReturnType<typeof makeUsers>, overrides: Record<string, unknown> = {}) {
    const { game_id } = await createGame(u.a, overrides);
    await json<LobbyOk>(await api(u.b, "POST", `/games/${game_id}/join`, { client_schema_version: 1 }));
    // No mirror wait: the DO resolves seats from its own roster (§4.2) — the
    // joiner can act the moment the join response lands.
    await json<CommandOk>(await api(u.a, "POST", `/games/${game_id}/start`, {}));
    return game_id;
  }

  it("actions commit over HTTP with the own frame riding; non-participants 403", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u, { rated: false });

    const a1 = await json<CommandOk>(await api(u.a, "POST", `/games/${gameId}/action`, { data: { add: 1 }, expected_version: 0 }));
    expect(a1.version).toBe(1);
    expect(a1.frame?.data).toEqual({ count: 1 });

    expect((await api(u.c, "POST", `/games/${gameId}/action`, { data: { add: 1 }, expected_version: 1 })).status).toBe(403);

    const illegal = await api(u.b, "POST", `/games/${gameId}/action`, { data: { add: 7 }, expected_version: 1 });
    expect(illegal.status).toBe(400);
  });

  it("plays to a rated finish; ratings land; frames replay for a viewer", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u);

    await json<CommandOk>(await api(u.a, "POST", `/games/${gameId}/action`, { data: { add: 2 }, expected_version: 0 }));
    const finish = await json<CommandOk>(await api(u.b, "POST", `/games/${gameId}/action`, { data: { add: 2 }, expected_version: 1 }));
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
    const result = await json<CommandOk>(await api(u.b, "POST", `/games/${gameId}/forfeit`, {}));
    expect(result.frame?.outcomes).toBeDefined();
  });

  it("keeps frames private: a non-participant cannot read an active game", async () => {
    const u = makeUsers();
    const gameId = await readyGame(u, { rated: false });
    expect((await api(u.c, "GET", `/games/${gameId}/frames?from=0&to=10`)).status).toBe(403);
  });
});

describe("socket (§4.2 roster snapshots → §4.3 frames)", () => {
  it("serves one socket across the lobby → active transition", async () => {
    const u = makeUsers();
    const { game_id } = await createGame(u.a, { rated: false });

    const token = await mintToken({ uid: u.b });
    const res = await SELF.fetch(`https://x/api/games/${game_id}/socket?token=${token}`, { headers: { Upgrade: "websocket" } });
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

describe("reads (§5.2)", () => {
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
