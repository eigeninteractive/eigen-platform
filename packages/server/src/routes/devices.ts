/**
 * Device registration — the ingress that makes FCM pushes
 * deliverable. A client upserts its Firebase Installation ID (FID) here so the
 * turn/finish pushes (`notify/push.ts`) have somewhere to go, and deletes it on
 * sign-out. The send side reads and prunes this table; these two routes are the
 * only writers.
 *
 * Keyed on the FID (one row per app install): signing in on a device reassigns
 * that FID from any prior user, so a FID always maps to exactly one user and no
 * stale association lingers. Mirrors the Supabase-era
 * `app_upsert_device_installation` / `app_delete_device_installation` RPCs,
 * moved to worker routes because the new stack has no client-direct DB access.
 */

import { createRoute, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { orm } from "../d1/orm.js";
import { deviceInstallations } from "../d1/schema.js";
import type { EngineApp, RouteContext } from "../engine.js";
import { errorShape } from "./wire.js";

const deviceBody = z
  .object({
    /** The Firebase Installation ID for this app install (the FCM target). */
    fid: z.string().min(1).max(256),
    platform: z.enum(["ios", "android", "web"]),
  })
  .openapi("DeviceRegistration");

export function registerDeviceRoutes(app: EngineApp, ctx: RouteContext): void {
  app.openapi(
    createRoute({
      method: "put",
      path: "/me/devices",
      operationId: "registerDevice",
      tags: ["Me"],
      request: { body: { content: { "application/json": { schema: deviceBody } }, required: true } },
      responses: {
        204: { description: "Registered — the caller's pushes will reach this install" },
        400: { content: { "application/json": { schema: errorShape } }, description: "Invalid request" },
        401: { content: { "application/json": { schema: errorShape } }, description: "Missing or invalid token" },
      },
    }),
    async (c) => {
      const { fid, platform } = c.req.valid("json");
      const userId = c.var.auth.user.id;
      const now = Date.now();
      // Upsert on the FID: a device previously signed in as another user is
      // reassigned to this caller (one FID → one user).
      await orm(ctx.d1(c.env))
        .insert(deviceInstallations)
        .values({ fid, userId, platform, updatedAt: now })
        .onConflictDoUpdate({ target: deviceInstallations.fid, set: { userId, platform, updatedAt: now } });
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/me/devices/{fid}",
      operationId: "unregisterDevice",
      tags: ["Me"],
      request: { params: z.object({ fid: z.string().min(1) }) },
      responses: {
        204: { description: "Deregistered (idempotent)" },
        401: { content: { "application/json": { schema: errorShape } }, description: "Missing or invalid token" },
      },
    }),
    async (c) => {
      const userId = c.var.auth.user.id;
      // Scoped to the caller: a FID already reassigned to another account is
      // left untouched, so a late sign-out can't unregister the new owner.
      await orm(ctx.d1(c.env))
        .delete(deviceInstallations)
        .where(and(eq(deviceInstallations.fid, c.req.param("fid")), eq(deviceInstallations.userId, userId)));
      return c.body(null, 204);
    },
  );
}
