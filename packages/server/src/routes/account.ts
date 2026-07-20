/**
 * Account lifecycle (engine_stack.md §4.7) — the caller deleting their own
 * account. Runs the shared {@link purgeUser} path: forfeit/cancel/leave the
 * caller's live games, delete the Firebase account, then purge D1.
 *
 * A Firebase-delete failure throws BEFORE the D1 purge (see purge.ts ordering),
 * so the account is left fully intact and retriable — we surface that to the
 * client as a 502 rather than half-deleting.
 */

import { createRoute, z } from "@hono/zod-openapi";
import type { EngineApp, RouteContext } from "../engine.js";
import { HttpError } from "../http.js";
import { purgeUser } from "../lifecycle/purge.js";

export function registerAccountRoutes(app: EngineApp, ctx: RouteContext): void {
  app.openapi(
    createRoute({
      method: "delete",
      path: "/me",
      operationId: "deleteAccount",
      responses: {
        200: { content: { "application/json": { schema: z.object({ ok: z.literal(true) }).openapi("AccountDeleted") } }, description: "The account and its data were deleted" },
        401: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Missing or invalid token" },
        502: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Deletion failed — the account is intact; retry" },
      },
    }),
    async (c) => {
      const userId = c.var.auth.user.id;
      try {
        await purgeUser({ d1: ctx.d1(c.env), stub: (gameId) => ctx.stub(c.env, gameId), serviceAccount: ctx.serviceAccount(c.env), avatarBucket: ctx.avatars === null ? null : ctx.avatars.bucket(c.env) }, userId);
      } catch (error) {
        console.error(`delete-account for ${userId} failed`, error);
        throw new HttpError(502, "Account deletion failed — please try again");
      }
      return c.json({ ok: true } as const, 200);
    },
  );
}
