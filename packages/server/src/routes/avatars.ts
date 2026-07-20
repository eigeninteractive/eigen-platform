/**
 * Opt-in avatar uploads. R2 has no RLS and no
 * client-direct writes, so uploads go through the worker: a raw-binary
 * `PUT /api/engine/me/avatar` (authed) streams the image to R2 under key =
 * uid, and a public `GET /avatars/:uid` serves it with a long immutable cache.
 *
 * `avatar_url` carries a `?v={ts}` cache-buster (the R2 key is overwritten on
 * re-upload, so the URL must change for clients to refetch). When
 * `avatars.publicBaseUrl` is set (a bucket custom domain, or r2.dev), the URL
 * points straight at the bucket and reads never touch the worker; unset → the
 * relative `/avatars/{uid}` worker route (the zoneless default). Both mounted
 * only when uploads are configured.
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users } from "../d1/schema.js";
import type { EngineApp, ResolvedAvatars, RouteContext } from "../engine.js";
import { HttpError } from "../http.js";

/** Content types we accept and store. */
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Build the stored `avatar_url`: absolute (direct-to-bucket) when a public
 * base URL is configured, else the relative worker route. `?v` busts caches on
 * re-upload. */
function avatarUrl(publicBase: string | undefined, uid: string, version: number): string {
  const path = `/${uid}?v=${version}`;
  if (publicBase !== undefined && publicBase !== "") return `${publicBase.replace(/\/$/, "")}${path}`;
  return `/avatars${path}`;
}

export function registerAvatarUpload(engine: EngineApp, ctx: RouteContext): void {
  const avatars = ctx.avatars as ResolvedAvatars;
  // Plain route (not OpenAPI): a raw binary body doesn't model cleanly in the
  // spec. Documented in client_changes.md alongside the socket.
  engine.put("/me/avatar", async (c) => {
    const contentType = (c.req.header("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new HttpError(415, `Unsupported image type '${contentType}' — use image/jpeg, image/png, or image/webp`);
    }
    const body = await c.req.arrayBuffer();
    if (body.byteLength === 0) throw new HttpError(400, "Empty upload");
    if (body.byteLength > avatars.maxBytes) throw new HttpError(413, `Image exceeds the ${avatars.maxBytes}-byte limit`);

    const uid = c.var.auth.user.id;
    const now = Date.now();
    await avatars.bucket(c.env).put(uid, body, { httpMetadata: { contentType } });
    const url = avatarUrl(avatars.publicBaseUrl(c.env), uid, now);
    await drizzle(ctx.d1(c.env)).update(users).set({ avatarUrl: url, updatedAt: now }).where(eq(users.id, uid));
    return c.json({ avatar_url: url }, 200);
  });
}

export function registerAvatarServe(app: EngineApp, ctx: RouteContext): void {
  const avatars = ctx.avatars as ResolvedAvatars;
  // Public, unauthed — avatars are world-readable. The `?v` query is a
  // client cache-buster; the object key is the uid alone.
  app.get("/avatars/:uid", async (c) => {
    const object = await avatars.bucket(c.env).get(c.req.param("uid"));
    if (object === null) return c.notFound();
    return c.body(object.body, 200, {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
    });
  });
}
