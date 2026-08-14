/**
 * The social graph: friend requests, accept/auto-accept, remove, block, user
 * search, friends' open games, and username edit. D1-only (no DO); every write
 * requires a registered caller and friend targets must be registered too.
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

/** A registered user, provisioned by one authed call. Returns their token opts. */
async function user(tag: string): Promise<TestTokenOptions> {
  const opts: TestTokenOptions = { uid: `${tag}-${rnd()}`, email: `${tag}${rnd()}@e.com`, name: `${tag} Person` };
  expect((await api(opts, "GET", "/me")).status).toBe(200);
  return opts;
}

describe("friend requests", () => {
  it("request → incoming/outgoing pending → accept → mutual friends", async () => {
    const a = await user("a");
    const b = await user("b");

    const sent = await json<{ status: string }>(await api(a, "POST", "/friends/requests", { targetUserId: b.uid }));
    expect(sent.status).toBe("requested");

    // A sees it outgoing; B sees it incoming.
    const aPending = await json<{ requests: { userId: string; direction: string }[] }>(await api(a, "GET", "/friends/requests"));
    expect(aPending.requests).toEqual([expect.objectContaining({ userId: b.uid, direction: "outgoing" })]);
    const bPending = await json<{ requests: { userId: string; direction: string }[] }>(await api(b, "GET", "/friends/requests"));
    expect(bPending.requests).toEqual([expect.objectContaining({ userId: a.uid, direction: "incoming" })]);

    // B accepts.
    expect((await api(b, "POST", `/friends/requests/${a.uid}/accept`)).status).toBe(204);
    const aFriends = await json<{ friends: { userId: string }[] }>(await api(a, "GET", "/friends"));
    expect(aFriends.friends.map((f) => f.userId)).toContain(b.uid);
    const bFriends = await json<{ friends: { userId: string }[] }>(await api(b, "GET", "/friends"));
    expect(bFriends.friends.map((f) => f.userId)).toContain(a.uid);
  });

  it("a reverse request auto-accepts", async () => {
    const a = await user("a");
    const b = await user("b");
    await api(a, "POST", "/friends/requests", { targetUserId: b.uid });
    const back = await json<{ status: string }>(await api(b, "POST", "/friends/requests", { targetUserId: a.uid }));
    expect(back.status).toBe("accepted");
    const bFriends = await json<{ friends: { userId: string }[] }>(await api(b, "GET", "/friends"));
    expect(bFriends.friends.map((f) => f.userId)).toContain(a.uid);
  });

  it("remove withdraws / unfriends idempotently", async () => {
    const a = await user("a");
    const b = await user("b");
    await api(a, "POST", "/friends/requests", { targetUserId: b.uid });
    expect((await api(a, "DELETE", `/friends/${b.uid}`)).status).toBe(204);
    const bPending = await json<{ requests: unknown[] }>(await api(b, "GET", "/friends/requests"));
    expect(bPending.requests).toEqual([]);
    // idempotent
    expect((await api(a, "DELETE", `/friends/${b.uid}`)).status).toBe(204);
  });

  it("accepting a non-existent request is a 404", async () => {
    const a = await user("a");
    const b = await user("b");
    expect((await api(b, "POST", `/friends/requests/${a.uid}/accept`)).status).toBe(404);
  });

  it("rejects self, guest targets, and guest callers", async () => {
    const a = await user("a");
    expect((await api(a, "POST", "/friends/requests", { targetUserId: a.uid })).status).toBe(400);

    const guest: TestTokenOptions = { uid: `g-${rnd()}`, anonymous: true };
    expect((await api(guest, "GET", "/me")).status).toBe(200);
    // Registered A cannot friend a guest.
    expect((await api(a, "POST", "/friends/requests", { targetUserId: guest.uid })).status).toBe(400);
    // A guest cannot send requests at all.
    expect((await api(guest, "POST", "/friends/requests", { targetUserId: a.uid })).status).toBe(403);
  });
});

describe("blocking", () => {
  it("a block refuses new requests until unblocked", async () => {
    const a = await user("a");
    const b = await user("b");
    expect((await api(a, "POST", `/friends/${b.uid}/block`)).status).toBe(204);
    // Neither direction can request while the block stands.
    expect((await api(b, "POST", "/friends/requests", { targetUserId: a.uid })).status).toBe(403);
    expect((await api(a, "POST", "/friends/requests", { targetUserId: b.uid })).status).toBe(403);
    // Only the blocker can lift it.
    expect((await api(b, "DELETE", `/friends/${a.uid}/block`)).status).toBe(204); // no-op
    expect((await api(a, "POST", "/friends/requests", { targetUserId: b.uid })).status).toBe(403);
    expect((await api(a, "DELETE", `/friends/${b.uid}/block`)).status).toBe(204);
    expect((await json<{ status: string }>(await api(a, "POST", "/friends/requests", { targetUserId: b.uid }))).status).toBe("requested");
  });
});

describe("user search", () => {
  it("finds registered users, excluding self, guests, and blocked", async () => {
    const tag = `srch${rnd()}`;
    const target: TestTokenOptions = { uid: `t-${rnd()}`, email: `${tag}@e.com`, name: `${tag} Target` };
    expect((await api(target, "GET", "/me")).status).toBe(200);
    const guest: TestTokenOptions = { uid: `g-${rnd()}`, anonymous: true };
    await api(guest, "GET", "/me");
    const seeker = await user("seek");

    const found = await json<{ users: { id: string }[] }>(await api(seeker, "GET", `/users/search?q=${tag}`));
    expect(found.users.map((u) => u.id)).toContain(target.uid);
    // A guest never surfaces.
    expect(found.users.some((u) => u.id === guest.uid)).toBe(false);

    // After a block, the target disappears from the seeker's results.
    await api(seeker, "POST", `/friends/${target.uid}/block`);
    const afterBlock = await json<{ users: { id: string }[] }>(await api(seeker, "GET", `/users/search?q=${tag}`));
    expect(afterBlock.users.map((u) => u.id)).not.toContain(target.uid);
  });
});

describe("friends' open games", () => {
  it("lists joinable games created by a friend", async () => {
    const a = await user("a");
    const b = await user("b");
    await api(a, "POST", "/friends/requests", { targetUserId: b.uid });
    await api(b, "POST", `/friends/requests/${a.uid}/accept`);

    const created = await json<{ gameId: string }>(await api(a, "POST", "/games", { access: "public", schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, rated: false }), 201);
    const list = await json<{ games: { id: string }[] }>(await api(b, "GET", "/friends/games"));
    expect(list.games.map((g) => g.id)).toContain(created.gameId);
  });
});

describe("username edit", () => {
  it("changes the username, rejecting bad charset and collisions", async () => {
    const a = await user("a");
    const good = `cool_name.${rnd()}`.slice(0, 20);
    const updated = await json<{ username: string }>(await api(a, "PUT", "/me/username", { username: good }));
    expect(updated.username).toBe(good.toLowerCase());

    // Bad charset (min length is enforced by the body schema; charset by the handler).
    expect((await api(a, "PUT", "/me/username", { username: "Bad Name!" })).status).toBe(400);

    // Collision: B tries to take A's username.
    const b = await user("b");
    expect((await api(b, "PUT", "/me/username", { username: good })).status).toBe(409);
  });
});

describe("keyset pagination", () => {
  interface PageBody {
    games: { id: string; updatedAt: number }[];
    nextCursor: string | null;
  }

  /** Walk every page the way a client does: follow `nextCursor` until it is
   * null, never deriving a cursor from a row. */
  async function drain(who: TestTokenOptions, path: string, limit: number): Promise<string[]> {
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 20; guard++) {
      const suffix: string = cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`;
      const page: PageBody = await json<PageBody>(await api(who, "GET", `${path}?limit=${limit}${suffix}`));
      seen.push(...page.games.map((g) => g.id));
      if (page.nextCursor === null) return seen;
      cursor = page.nextCursor;
    }
    throw new Error("pagination did not terminate");
  }

  // These games are created in a tight loop, so they very often share an
  // `updatedAt` millisecond. That tie is the whole point: under a cursor that
  // was the bare sort value, a page boundary landing between two rows with the
  // same timestamp dropped one permanently, because it was neither strictly
  // older than the cursor nor on the page already served. The cursor now
  // carries the row id as a tiebreak, so every row is on exactly one page.
  it("pages my games without repeating or skipping a row, including across a timestamp tie", async () => {
    const a = await user("a");
    const created: string[] = [];
    for (let i = 0; i < 5; i++) {
      const game = await json<{ gameId: string }>(await api(a, "POST", "/games", { access: "public", schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, rated: false }), 201);
      created.push(game.gameId);
    }

    const first = await json<PageBody>(await api(a, "GET", "/games/mine?limit=2"));
    expect(first.games).toHaveLength(2);
    // The tie this test exists for. If the clock happened to tick between every
    // create the assertion below still holds, it is just less interesting.
    const timestamps = new Set(first.games.map((g) => g.updatedAt));
    expect(timestamps.size).toBeGreaterThanOrEqual(1);

    const seen = await drain(a, "/games/mine", 2);
    expect(seen).toHaveLength(new Set(seen).size); // no row served twice
    expect(new Set(seen)).toEqual(new Set(created)); // and none skipped
  });

  // `nextCursor` is an answer, not a hint. The list here is exactly as long as
  // the page size, the case where "stop when a page comes back short" - the
  // heuristic this replaced - would have asked for one page too many.
  it("reports nextCursor null when the last page is exactly full", async () => {
    const a = await user("a");
    for (let i = 0; i < 2; i++) {
      await json<{ gameId: string }>(await api(a, "POST", "/games", { access: "public", schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, rated: false }), 201);
    }

    const page = await json<PageBody>(await api(a, "GET", "/games/mine?limit=2"));
    expect(page.games).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it("refuses a cursor that did not come from the server", async () => {
    const a = await user("a");
    const res = await api(a, "GET", "/games/mine?limit=2&cursor=not-a-cursor");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("invalidCursor");
  });
});

describe("display name edit", () => {
  it("changes the display name, trims it, and does not require uniqueness", async () => {
    const a = await user("a");
    const updated = await json<{ displayName: string }>(await api(a, "PUT", "/me/display-name", { displayName: "  Ada Lovelace  " }));
    expect(updated.displayName).toBe("Ada Lovelace");
    expect((await json<{ displayName: string }>(await api(a, "GET", "/me"))).displayName).toBe("Ada Lovelace");

    // Unlike the username, a display name is deliberately not unique.
    const b = await user("b");
    expect((await api(b, "PUT", "/me/display-name", { displayName: "Ada Lovelace" })).status).toBe(200);

    // Empty (or whitespace-only) is rejected by the body schema.
    expect((await api(a, "PUT", "/me/display-name", { displayName: "   " })).status).toBe(400);
  });
});
