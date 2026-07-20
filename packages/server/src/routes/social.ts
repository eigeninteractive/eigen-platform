/**
 * The social routes — the friend graph, user search, and the "friends' open
 * games" lobby. Cross-game and D1-only (no Durable Object); policy lives here
 * (registered caller, self-target, guest target), the data effects live in
 * `d1/social.ts`, and friend-event FCM pushes are fired from here.
 *
 * All writes require a registered (non-guest) caller: a guest is a throwaway
 * identity that cannot hold a stable friend graph. Friend-event pushes go out
 * through the shared push path when a service account is configured; they ride
 * `executionCtx.waitUntil` so a slow FCM call never delays the response (a
 * stateless Worker, unlike the DO, needs waitUntil to keep background work
 * alive past the response).
 */

import { createRoute, z } from "@hono/zod-openapi";
import { readPlayers } from "../d1/reads.js";
import { acceptFriendRequest, blockUser, friendsOpenGames, listFriends, listPendingRequests, removeRelationship, searchUsers, sendFriendRequest, unblockUser } from "../d1/social.js";
import type { Authed, EngineApp, RouteContext } from "../engine.js";
import { HttpError } from "../http.js";
import { friendAcceptedPush, friendRequestPush, pushToUser } from "../notify/push.js";
import { friendTargetBody, gameSummaryOf, gameSummaryShape, playerShape, relationshipShape } from "./wire.js";

function okResponse<T extends z.ZodType>(schema: T, description: string) {
  const err = (what: string) => ({ content: { "application/json": { schema: z.object({ error: z.string(), code: z.string().optional() }) } }, description: what });
  return {
    200: { content: { "application/json": { schema } }, description },
    400: err("Invalid request"),
    401: err("Missing or invalid token"),
    403: err("Not allowed"),
    404: err("Not found"),
  } as const;
}

const okShape = z.object({ ok: z.literal(true) });
const userIdParam = z.object({ userId: z.string().min(1) });

/** Friend writes are for registered accounts only. */
function requireRegistered(auth: Authed): void {
  if (auth.claims.isAnonymous) throw new HttpError(403, "This action requires a registered account");
}

/** Best-effort friend-event push, off the response path. `waitUntil` keeps the
 * background send alive past the response (a stateless Worker needs it, unlike
 * the DO). */
function pushFriendEvent(ctx: RouteContext, env: unknown, waitUntil: (p: Promise<unknown>) => void, userId: string, message: ReturnType<typeof friendRequestPush>): void {
  const sa = ctx.serviceAccount(env);
  if (sa === null) return;
  waitUntil(pushToUser(ctx.d1(env), sa, userId, message));
}

export function registerSocialRoutes(app: EngineApp, ctx: RouteContext): void {
  // ── Lists ──────────────────────────────────────────────────────────────────
  app.openapi(createRoute({ method: "get", path: "/friends", operationId: "listFriends", responses: okResponse(z.object({ friends: z.array(relationshipShape) }).openapi("Friends"), "The caller's accepted friends") }), async (c) => c.json({ friends: await listFriends(ctx.d1(c.env), c.var.auth.user.id) }, 200));

  app.openapi(createRoute({ method: "get", path: "/friends/requests", operationId: "listFriendRequests", responses: okResponse(z.object({ requests: z.array(relationshipShape) }).openapi("FriendRequests"), "Pending requests, incoming and outgoing") }), async (c) =>
    c.json({ requests: await listPendingRequests(ctx.d1(c.env), c.var.auth.user.id) }, 200),
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/friends/games",
      operationId: "getFriendsGames",
      request: { query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }) },
      responses: okResponse(z.object({ games: z.array(gameSummaryShape) }).openapi("FriendsGames"), "Joinable games created by the caller's friends"),
    }),
    async (c) => {
      const rows = await friendsOpenGames(ctx.d1(c.env), c.var.auth.user.id, c.req.valid("query").limit);
      return c.json({ games: rows.map(gameSummaryOf) }, 200);
    },
  );

  // ── User search ──────────────────────────────────────────────────────────────
  app.openapi(
    createRoute({
      method: "get",
      path: "/users/search",
      operationId: "searchUsers",
      request: { query: z.object({ q: z.string().min(1), limit: z.coerce.number().int().min(1).max(50).default(20) }) },
      responses: okResponse(z.object({ users: z.array(playerShape) }).openapi("UserSearch"), "Matching registered users, best match first"),
    }),
    async (c) => {
      requireRegistered(c.var.auth);
      const { q, limit } = c.req.valid("query");
      const rows = await searchUsers(ctx.d1(c.env), c.var.auth.user.id, q, limit);
      return c.json({ users: rows.map((r) => ({ id: r.user_id, username: r.username, display_name: r.display_name, avatar_url: r.avatar_url, is_anonymous: r.is_anonymous })) }, 200);
    },
  );

  // ── Requests ───────────────────────────────────────────────────────────────
  app.openapi(
    createRoute({
      method: "post",
      path: "/friends/requests",
      operationId: "sendFriendRequest",
      request: { body: { content: { "application/json": { schema: friendTargetBody } }, required: true } },
      responses: okResponse(z.object({ status: z.enum(["requested", "accepted"]) }).openapi("FriendRequestResult"), "Request sent, or auto-accepted"),
    }),
    async (c) => {
      requireRegistered(c.var.auth);
      const caller = c.var.auth.user;
      const target = c.req.valid("json").target_user_id;
      if (target === caller.id) throw new HttpError(400, "You cannot friend yourself");
      const [targetRow] = await readPlayers(ctx.d1(c.env), [target]);
      if (targetRow === undefined) throw new HttpError(404, "No such user");
      if (targetRow.isAnonymous) throw new HttpError(400, "You cannot friend a guest");

      const res = await sendFriendRequest(ctx.d1(c.env), caller.id, target);
      switch (res.outcome) {
        case "blocked":
          throw new HttpError(403, "This user is unavailable");
        case "requested":
          pushFriendEvent(ctx, c.env, (p) => c.executionCtx.waitUntil(p), res.notifyUserId, friendRequestPush(caller.displayName));
          return c.json({ status: "requested" as const }, 200);
        case "accepted":
          pushFriendEvent(ctx, c.env, (p) => c.executionCtx.waitUntil(p), res.notifyUserId, friendAcceptedPush(caller.displayName));
          return c.json({ status: "accepted" as const }, 200);
        case "already_pending":
          return c.json({ status: "requested" as const }, 200);
        case "already_friends":
          return c.json({ status: "accepted" as const }, 200);
      }
    },
  );

  app.openapi(createRoute({ method: "post", path: "/friends/requests/{userId}/accept", operationId: "acceptFriendRequest", request: { params: userIdParam }, responses: okResponse(okShape.openapi("FriendRequestAccepted"), "The request was accepted") }), async (c) => {
    requireRegistered(c.var.auth);
    const caller = c.var.auth.user;
    const requester = c.req.valid("param").userId;
    const accepted = await acceptFriendRequest(ctx.d1(c.env), caller.id, requester);
    if (!accepted) throw new HttpError(404, "No pending request from this user");
    pushFriendEvent(ctx, c.env, (p) => c.executionCtx.waitUntil(p), requester, friendAcceptedPush(caller.displayName));
    return c.json({ ok: true } as const, 200);
  });

  // ── Remove / block ───────────────────────────────────────────────────────────
  app.openapi(createRoute({ method: "delete", path: "/friends/{userId}", operationId: "removeFriend", request: { params: userIdParam }, responses: okResponse(okShape.openapi("FriendRemoved"), "Unfriended / request withdrawn / declined (idempotent)") }), async (c) => {
    // No registered gate: removing/declining is always allowed, and a
    // relationship can only exist if it was created by a registered caller.
    await removeRelationship(ctx.d1(c.env), c.var.auth.user.id, c.req.valid("param").userId);
    return c.json({ ok: true } as const, 200);
  });

  app.openapi(createRoute({ method: "post", path: "/friends/{userId}/block", operationId: "blockUser", request: { params: userIdParam }, responses: okResponse(okShape.openapi("UserBlocked"), "Blocked (idempotent)") }), async (c) => {
    requireRegistered(c.var.auth);
    const target = c.req.valid("param").userId;
    if (target === c.var.auth.user.id) throw new HttpError(400, "You cannot block yourself");
    await blockUser(ctx.d1(c.env), c.var.auth.user.id, target);
    return c.json({ ok: true } as const, 200);
  });

  app.openapi(createRoute({ method: "delete", path: "/friends/{userId}/block", operationId: "unblockUser", request: { params: userIdParam }, responses: okResponse(okShape.openapi("UserUnblocked"), "Unblocked (idempotent)") }), async (c) => {
    await unblockUser(ctx.d1(c.env), c.var.auth.user.id, c.req.valid("param").userId);
    return c.json({ ok: true } as const, 200);
  });
}
