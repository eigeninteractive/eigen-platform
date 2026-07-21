/**
 * The social graph — friend requests, accept/auto-accept, remove, block, user
 * search, friends' open games, and username edit. D1-only (no DO); every write
 * requires a registered caller and friend targets must be registered too.
 */

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { testBearer as bearer, type TestTokenOptions } from "../src/testing.js";

const rnd = () => crypto.randomUUID().slice(0, 8);

async function api(opts: TestTokenOptions, method: string, path: string, body?: unknown): Promise<Response> {
  return await SELF.fetch(`https://x/api/engine${path}`, {
    method,
    headers: { ...(await bearer(opts)), "content-type": "application/json" },
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

    const sent = await json<{ status: string }>(await api(a, "POST", "/friends/requests", { target_user_id: b.uid }));
    expect(sent.status).toBe("requested");

    // A sees it outgoing; B sees it incoming.
    const aPending = await json<{ requests: { user_id: string; direction: string }[] }>(await api(a, "GET", "/friends/requests"));
    expect(aPending.requests).toEqual([expect.objectContaining({ user_id: b.uid, direction: "outgoing" })]);
    const bPending = await json<{ requests: { user_id: string; direction: string }[] }>(await api(b, "GET", "/friends/requests"));
    expect(bPending.requests).toEqual([expect.objectContaining({ user_id: a.uid, direction: "incoming" })]);

    // B accepts.
    expect((await api(b, "POST", `/friends/requests/${a.uid}/accept`)).status).toBe(204);
    const aFriends = await json<{ friends: { user_id: string }[] }>(await api(a, "GET", "/friends"));
    expect(aFriends.friends.map((f) => f.user_id)).toContain(b.uid);
    const bFriends = await json<{ friends: { user_id: string }[] }>(await api(b, "GET", "/friends"));
    expect(bFriends.friends.map((f) => f.user_id)).toContain(a.uid);
  });

  it("a reverse request auto-accepts", async () => {
    const a = await user("a");
    const b = await user("b");
    await api(a, "POST", "/friends/requests", { target_user_id: b.uid });
    const back = await json<{ status: string }>(await api(b, "POST", "/friends/requests", { target_user_id: a.uid }));
    expect(back.status).toBe("accepted");
    const bFriends = await json<{ friends: { user_id: string }[] }>(await api(b, "GET", "/friends"));
    expect(bFriends.friends.map((f) => f.user_id)).toContain(a.uid);
  });

  it("remove withdraws / unfriends idempotently", async () => {
    const a = await user("a");
    const b = await user("b");
    await api(a, "POST", "/friends/requests", { target_user_id: b.uid });
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
    expect((await api(a, "POST", "/friends/requests", { target_user_id: a.uid })).status).toBe(400);

    const guest: TestTokenOptions = { uid: `g-${rnd()}`, anonymous: true };
    expect((await api(guest, "GET", "/me")).status).toBe(200);
    // Registered A cannot friend a guest.
    expect((await api(a, "POST", "/friends/requests", { target_user_id: guest.uid })).status).toBe(400);
    // A guest cannot send requests at all.
    expect((await api(guest, "POST", "/friends/requests", { target_user_id: a.uid })).status).toBe(403);
  });
});

describe("blocking", () => {
  it("a block refuses new requests until unblocked", async () => {
    const a = await user("a");
    const b = await user("b");
    expect((await api(a, "POST", `/friends/${b.uid}/block`)).status).toBe(204);
    // Neither direction can request while the block stands.
    expect((await api(b, "POST", "/friends/requests", { target_user_id: a.uid })).status).toBe(403);
    expect((await api(a, "POST", "/friends/requests", { target_user_id: b.uid })).status).toBe(403);
    // Only the blocker can lift it.
    expect((await api(b, "DELETE", `/friends/${a.uid}/block`)).status).toBe(204); // no-op
    expect((await api(a, "POST", "/friends/requests", { target_user_id: b.uid })).status).toBe(403);
    expect((await api(a, "DELETE", `/friends/${b.uid}/block`)).status).toBe(204);
    expect((await json<{ status: string }>(await api(a, "POST", "/friends/requests", { target_user_id: b.uid }))).status).toBe("requested");
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
    await api(a, "POST", "/friends/requests", { target_user_id: b.uid });
    await api(b, "POST", `/friends/requests/${a.uid}/accept`);

    const created = await json<{ game_id: string }>(await api(a, "POST", "/games", { access: "public", schema_version: 1, config: { target: 3 }, min_players: 2, max_players: 2, rated: false }), 201);
    const list = await json<{ games: { id: string }[] }>(await api(b, "GET", "/friends/games"));
    expect(list.games.map((g) => g.id)).toContain(created.game_id);
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
