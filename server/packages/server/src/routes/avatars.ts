/**
 * Opt-in avatar uploads. Clients never write to R2 directly, because there is no
 * way to scope a bucket credential to one user, so uploads go through the
 * worker, which authenticates the caller and owns the key: a raw-binary
 * `PUT /api/engine/me/avatar` (authed) streams the image to R2 under key =
 * uid, and a public `GET /avatars/:uid` serves it with a long immutable cache.
 *
 * `avatarUrl` carries a `?v={ts}` cache-buster (the R2 key is overwritten on
 * re-upload, so the URL must change for clients to refetch). When
 * `avatars.publicBaseUrl` is set (a bucket custom domain, or r2.dev), the URL
 * points straight at the bucket and reads never touch the worker; unset → the
 * relative `/avatars/{uid}` worker route (the zoneless default). Both mounted
 * only when uploads are configured.
 */

import { eq } from "drizzle-orm";
import { orm } from "../d1/orm.js";
import { users } from "../d1/schema.js";
import type { EngineApp, ResolvedAvatars, RouteContext } from "../engine.js";
import { HttpError } from "../http.js";
import { enforceRateLimit } from "../rate-limit.js";

/** Content types we accept and store. */
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Build the stored `avatarUrl`: absolute (direct-to-bucket) when a public
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
  // spec, so, like the game socket, it is hand-written on the client rather
  // than generated. Clients PUT the image bytes directly with an image/*
  // content-type (never multipart) and read `{ avatarUrl }` off the 200.
  engine.put("/me/avatar", async (c) => {
    await enforceRateLimit(c.env, "avatar_upload", c.var.auth.user.id);
    const contentType = (c.req.header("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new HttpError(415, `Unsupported image type '${contentType}'. Use image/jpeg, image/png, or image/webp`, "unsupportedImageType");
    }
    const body = await c.req.arrayBuffer();
    if (body.byteLength === 0) throw new HttpError(400, "Empty upload");
    if (body.byteLength > avatars.maxBytes) throw new HttpError(413, `Image exceeds the ${avatars.maxBytes}-byte limit`, "imageTooLarge");

    const uid = c.var.auth.user.id;
    const now = Date.now();
    await avatars.bucket(c.env).put(uid, body, { httpMetadata: { contentType } });
    const url = avatarUrl(avatars.publicBaseUrl(c.env), uid, now);
    await orm(ctx.d1(c.env)).update(users).set({ avatarUrl: url, updatedAt: now }).where(eq(users.id, uid));
    return c.json({ avatarUrl: url }, 200);
  });
}

/**
 * Drop a served avatar from the Worker's edge cache so a cached 200 does not
 * outlive the object. The serve route below treats a versioned URL as immutable
 * (the `?v` only changes on re-upload, which mints a new key), so deletion,
 * which removes the bytes without changing the URL, is the one case the cache
 * must be told about. A no-op when the stored URL is absolute (a bucket custom
 * domain serves those reads, so the Worker never cached them) or absent.
 * Per-colo, like every Cache API write: it clears the colo that handled the
 * deletion; production serves avatars from the bucket domain, where R2 deletion
 * is authoritative and this path is unused.
 */
export async function invalidateAvatarCache(requestUrl: string, avatarUrl: string | null): Promise<void> {
  if (avatarUrl === null || avatarUrl === "" || /^https?:\/\//i.test(avatarUrl)) return;
  await caches.default.delete(new Request(new URL(avatarUrl, requestUrl).toString()));
}

export function registerAvatarServe(app: EngineApp, ctx: RouteContext): void {
  const avatars = ctx.avatars as ResolvedAvatars;
  // Public, unauthed, since avatars are world-readable. The `?v` query is a
  // client cache-buster; the object key is the uid alone.
  //
  // Fronted by the Worker's own edge cache (`caches.default`): a Worker
  // response is NOT edge-cached automatically; the immutable `Cache-Control`
  // below only reaches the device and any downstream CDN, so without this every
  // cold viewer would run the Worker and read R2. The full request URL is the
  // cache key, so the `?v={ts}` bumped on each upload makes a re-upload a
  // natural miss and ages old versions out; the stored object is overwritten in
  // place under the uid, so there is never a stale hit to invalidate. (When
  // `avatars.publicBaseUrl` points at a bucket custom domain, reads bypass the
  // Worker entirely and this route is unused: the production fast path.)
  app.get("/avatars/:uid", async (c) => {
    const cache = caches.default;
    // A GET Request over the exact URL: the cache key. `Request` defaults to GET.
    const cacheKey = new Request(c.req.url);
    const hit = await cache.match(cacheKey);
    if (hit !== undefined) return hit;

    const object = await avatars.bucket(c.env).get(c.req.param("uid"));
    if (object === null) return c.notFound(); // A miss is left uncached so a later upload appears.
    const response = new Response(object.body, {
      status: 200,
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: object.httpEtag,
      },
    });
    // Store a clone for the next viewer without blocking this response.
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  });
}
