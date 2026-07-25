/**
 * Account lifecycle — the caller deleting their own
 * account. Runs the shared {@link purgeUser} path: forfeit/cancel/leave the
 * caller's live games, delete the Firebase account, then purge D1.
 *
 * A Firebase-delete failure throws BEFORE the D1 purge (see purge.ts ordering),
 * so the account is left fully intact and retriable — we surface that to the
 * client as a 502 rather than half-deleting.
 */

import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { orm } from "../d1/orm.js";
import { users } from "../d1/schema.js";
import type { EngineApp, RouteContext } from "../engine.js";
import { HttpError } from "../http.js";
import { purgeUser } from "../lifecycle/purge.js";
import { invalidateAvatarCache } from "./avatars.js";
import { displayNameBody, errorShape, usernameBody } from "./wire.js";

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
      tags: ["Me"],
      request: { body: { content: { "application/json": { schema: usernameBody } }, required: true } },
      responses: {
        200: { content: { "application/json": { schema: z.object({ username: z.string() }).openapi("UsernameUpdated") } }, description: "The new username" },
        400: { content: { "application/json": { schema: errorShape } }, description: "Invalid username" },
        401: { content: { "application/json": { schema: errorShape } }, description: "Missing or invalid token" },
        409: { content: { "application/json": { schema: errorShape } }, description: "Username already taken" },
      },
    }),
    async (c) => {
      const username = c.req.valid("json").username.toLowerCase();
      if (!USERNAME_RE.test(username)) {
        throw new HttpError(400, "A username is 3–20 characters of lowercase letters, digits, '_' or '.'", "username_invalid");
      }
      const userId = c.var.auth.user.id;
      try {
        await orm(ctx.d1(c.env)).update(users).set({ username, updatedAt: Date.now() }).where(eq(users.id, userId));
      } catch (error) {
        if (isUsernameCollision(error)) throw new HttpError(409, "That username is taken", "username_taken");
        throw error;
      }
      return c.json({ username }, 200);
    },
  );

  // The caller changes their own display name — the free-form label shown
  // beside their moves, seeded from the identity provider at provisioning.
  // Unlike the username it is neither unique nor charset-constrained, so there
  // is no failure here beyond the length bound the schema already enforces.
  app.openapi(
    createRoute({
      method: "put",
      path: "/me/display-name",
      operationId: "updateDisplayName",
      tags: ["Me"],
      request: { body: { content: { "application/json": { schema: displayNameBody } }, required: true } },
      responses: {
        200: { content: { "application/json": { schema: z.object({ display_name: z.string() }).openapi("DisplayNameUpdated") } }, description: "The new display name" },
        400: { content: { "application/json": { schema: errorShape } }, description: "Invalid display name" },
        401: { content: { "application/json": { schema: errorShape } }, description: "Missing or invalid token" },
      },
    }),
    async (c) => {
      const displayName = c.req.valid("json").display_name.trim();
      await orm(ctx.d1(c.env)).update(users).set({ displayName, updatedAt: Date.now() }).where(eq(users.id, c.var.auth.user.id));
      return c.json({ display_name: displayName }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/me",
      operationId: "deleteAccount",
      tags: ["Me"],
      responses: {
        204: { description: "The account and its data were deleted" },
        401: { content: { "application/json": { schema: errorShape } }, description: "Missing or invalid token" },
        502: { content: { "application/json": { schema: errorShape } }, description: "Deletion failed — the account is intact; retry" },
      },
    }),
    async (c) => {
      const userId = c.var.auth.user.id;
      const avatarUrl = c.var.auth.user.avatarUrl;
      try {
        await purgeUser({ d1: ctx.d1(c.env), stub: (gameId) => ctx.stub(c.env, gameId), serviceAccount: ctx.serviceAccount(c.env), avatarBucket: ctx.avatars === null ? null : ctx.avatars.bucket(c.env) }, userId);
      } catch (error) {
        console.error(`delete-account for ${userId} failed`, error);
        throw new HttpError(502, "Account deletion failed — please try again");
      }
      // The R2 object is gone; drop any edge-cached copy so the (immutable)
      // versioned URL stops serving it. Awaited so deletion completes fully.
      if (ctx.avatars !== null) await invalidateAvatarCache(c.req.url, avatarUrl);
      return c.body(null, 204);
    },
  );
}
