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
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users } from "../d1/schema.js";
import type { EngineApp, RouteContext } from "../engine.js";
import { HttpError } from "../http.js";
import { purgeUser } from "../lifecycle/purge.js";
import { usernameBody } from "./wire.js";

/** The username charset — the same one provisioning sanitizes to: lowercase
 * letters, digits, underscore, and dot, 3–20 chars. */
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

function isUsernameCollision(error: unknown): boolean {
  // The only UNIQUE column this UPDATE can violate is `username`. Check the
  // message and any wrapped cause, since D1 nests the SQLite error.
  const parts: string[] = [];
  for (let e: unknown = error; e instanceof Error; e = e.cause) parts.push(e.message);
  return /UNIQUE constraint failed/i.test(parts.join(" "));
}

export function registerAccountRoutes(app: EngineApp, ctx: RouteContext): void {
  // The caller changes their own username (the stable handle; distinct from the
  // provider display name). Charset-validated for a precise error, and unique —
  // a clash is a clean 409.
  app.openapi(
    createRoute({
      method: "put",
      path: "/me/username",
      operationId: "updateUsername",
      request: { body: { content: { "application/json": { schema: usernameBody } }, required: true } },
      responses: {
        200: { content: { "application/json": { schema: z.object({ username: z.string() }).openapi("UsernameUpdated") } }, description: "The new username" },
        400: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Invalid username" },
        401: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Missing or invalid token" },
        409: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Username already taken" },
      },
    }),
    async (c) => {
      const username = c.req.valid("json").username.toLowerCase();
      if (!USERNAME_RE.test(username)) {
        throw new HttpError(400, "A username is 3–20 characters of lowercase letters, digits, '_' or '.'");
      }
      const userId = c.var.auth.user.id;
      try {
        await drizzle(ctx.d1(c.env)).update(users).set({ username, updatedAt: Date.now() }).where(eq(users.id, userId));
      } catch (error) {
        if (isUsernameCollision(error)) throw new HttpError(409, "That username is taken");
        throw error;
      }
      return c.json({ username }, 200);
    },
  );

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
