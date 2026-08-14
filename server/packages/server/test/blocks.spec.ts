/**
 * Blocking's interaction and visibility effects: a blocked pair never sees each
 * other's games in the lobby or friends' games, and never gets seated in the
 * same game (join, join-by-code, either direction). All bidirectional (the
 * blocker and the blocked are affected the same way) and reversible by
 * unblocking.
 *
 * The seating refusal answers `unknownGame` on purpose: the lobby already
 * hides the game from the pair, so a direct attempt sees the same "no such
 * game" a genuine miss would, and never learns a block exists.
 */

import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { testBearer as bearer, testMutationHeaders as mutationHeaders, type TestTokenOptions } from "../src/testing.js";

const rnd = () => crypto.randomUUID().slice(0, 8);

async function api(opts: TestTokenOptions, method: string, path: string, body?: unknown): Promise<Response> {
  return await exports.default.fetch(`https://x/api/engine${path}`, {
    method,
    headers: method === "GET" ? { ...(await bearer(opts)), "content-type": "application/json" } : await mutationHeaders(opts),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return (await res.json()) as T;
}

async function user(tag: string): Promise<TestTokenOptions> {
  const opts: TestTokenOptions = { uid: `${tag}-${rnd()}`, email: `${tag}${rnd()}@e.com`, name: `${tag} Person` };
  expect((await api(opts, "GET", "/me")).status).toBe(200);
  return opts;
}

const createBody = { access: "public" as const, schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, rated: false };

interface Created {
  gameId: string;
  shortCode: string;
}

async function createGame(host: TestTokenOptions): Promise<Created> {
  return json<Created>(await api(host, "POST", "/games", createBody), 201);
}

async function lobbyIds(viewer: TestTokenOptions): Promise<string[]> {
  const { games } = await json<{ games: { id: string }[] }>(await api(viewer, "GET", "/lobby"));
  return games.map((g) => g.id);
}

async function block(blocker: TestTokenOptions, target: TestTokenOptions): Promise<void> {
  expect((await api(blocker, "POST", `/friends/${target.uid}/block`)).status).toBe(204);
}

describe("blocking: lobby visibility", () => {
  it("hides a blocked user's game from the lobby, both directions, and restores on unblock", async () => {
    const a = await user("a");
    const b = await user("b");
    const c = await user("c"); // uninvolved control
    const game = await createGame(a);

    // Visible to everyone before any block.
    expect(await lobbyIds(b)).toContain(game.gameId);

    await block(a, b); // A is the blocker; the effect is symmetric.

    // Hidden from B (blocked with the creator A); still visible to the
    // uninvolved C; A still sees their own game (not blocked with themselves).
    expect(await lobbyIds(b)).not.toContain(game.gameId);
    expect(await lobbyIds(c)).toContain(game.gameId);
    expect(await lobbyIds(a)).toContain(game.gameId);

    // Unblock restores visibility.
    expect((await api(a, "DELETE", `/friends/${b.uid}/block`)).status).toBe(204);
    expect(await lobbyIds(b)).toContain(game.gameId);
  });

  it("hides regardless of who initiated the block", async () => {
    const a = await user("a");
    const b = await user("b");
    const game = await createGame(a);
    await block(b, a); // B blocks A this time.
    // B still cannot see A's game; the effect does not depend on direction.
    expect(await lobbyIds(b)).not.toContain(game.gameId);
  });
});

describe("blocking: the seating boundary", () => {
  it("refuses a blocked user joining the game as unknownGame (by id and by code)", async () => {
    const a = await user("a");
    const b = await user("b");
    const game = await createGame(a);
    await block(a, b);

    const byId = await api(b, "POST", `/games/${game.gameId}/join`, { clientSchemaVersions: [1] });
    expect(byId.status).toBe(404);
    expect(((await byId.json()) as { code: string }).code).toBe("unknownGame");

    const byCode = await api(b, "POST", "/games/join-by-code", { shortCode: game.shortCode, clientSchemaVersions: [1] });
    expect(byCode.status).toBe(404);
    expect(((await byCode.json()) as { code: string }).code).toBe("unknownGame");
  });

  it("refuses in the other direction too: the blocker cannot join the blocked user's game", async () => {
    const a = await user("a");
    const b = await user("b");
    const game = await createGame(b); // B hosts.
    await block(a, b); // A blocks B, then A tries to join B's game.
    expect((await api(a, "POST", `/games/${game.gameId}/join`, { clientSchemaVersions: [1] })).status).toBe(404);
  });

  it("lets an unblocked third party join normally", async () => {
    const a = await user("a");
    const b = await user("b");
    const c = await user("c");
    const game = await createGame(a);
    await block(a, b);
    // C is blocked with nobody: the seat is open to them.
    const joined = await json<{ session: { players: unknown[] } }>(await api(c, "POST", `/games/${game.gameId}/join`, { clientSchemaVersions: [1] }));
    expect(joined.session.players.length).toBe(2);
  });
});

describe("blocking: friends' open games", () => {
  it("hides a friend's game once a blocked user takes a seat in it", async () => {
    const a = await user("a");
    const c = await user("c"); // A's friend, the host
    const b = await user("b"); // will be blocked by A, and joins C's game

    // A and C become friends.
    await api(a, "POST", "/friends/requests", { targetUserId: c.uid });
    expect((await api(c, "POST", `/friends/requests/${a.uid}/accept`)).status).toBe(204);

    const game = await createGame(c);
    // Before anyone is blocked, C's game shows in A's friends' games.
    const before = await json<{ games: { id: string }[] }>(await api(a, "GET", "/friends/games"));
    expect(before.games.map((g) => g.id)).toContain(game.gameId);

    // B joins C's game (B and C are not blocked), then A blocks B.
    expect((await api(b, "POST", `/games/${game.gameId}/join`, { clientSchemaVersions: [1] })).status).toBe(200);
    await block(a, b);

    // Now the game seats someone A blocked, so it drops out of A's friends' games.
    const after = await json<{ games: { id: string }[] }>(await api(a, "GET", "/friends/games"));
    expect(after.games.map((g) => g.id)).not.toContain(game.gameId);
  });
});
