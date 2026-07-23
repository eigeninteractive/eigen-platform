/**
 * `createEngine` — the deployable API. An implementor
 * ships exactly:
 *
 * ```ts
 * import { BaseGameDO, createEngine } from '@eigen/server';
 * import { gameModule } from './rules';
 *
 * export class GameDO extends BaseGameDO<Env> {
 *   protected readonly gameModule = gameModule;
 *   protected d1(env: Env) { return env.MY_D1; }
 * }
 * export default createEngine({
 *   gameModule,
 *   d1: (env: Env) => env.MY_D1,
 *   gameDO: (env: Env) => env.GAME_DO,
 * });
 * ```
 *
 * hono + @hono/zod-openapi. Two route groups share the `/api` prefix but not
 * their auth: the client-facing engine group (`/api/engine/*`, every route
 * gated by a verified Firebase ID token) and the external-bot webhook
 * (`/api/bot/*`, self-authenticated by an HMAC signature). They are
 * separate sub-apps mounted on one `/api` root, so the engine's auth
 * middleware is scoped to the engine sub-app and never touches the bot group.
 * Handlers return only their declared 200 shape — every failure is an
 * HttpError throw rendered by the app-level error handler as `{ error, code? }`.
 */

import type { GameModule } from "@eigen/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { ErrorHandler, MiddlewareHandler } from "hono";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { type AuthClaims, AuthError, createFirebaseVerifier, type TokenVerifier } from "./auth/firebase.js";
import { ensureUser, type UserRow } from "./auth/provision.js";
import { registerBotRoutes } from "./bot/routes.js";
import type { BaseGameDO } from "./do/game-do.js";
import { readServiceAccount, type ServiceAccount } from "./google/oauth.js";
import { doHistoryStore, type HistoryStore } from "./history/store.js";
import { HttpError } from "./http.js";
import { type LifecycleOptions, runScheduled } from "./lifecycle/cron.js";
import type { EngineOps } from "./lifecycle/purge.js";
import type { GameStub } from "./protocol.js";
import { registerAccountRoutes } from "./routes/account.js";
import { registerAvatarServe, registerAvatarUpload } from "./routes/avatars.js";
import { registerDeviceRoutes } from "./routes/devices.js";
import { registerGameRoutes } from "./routes/games.js";
import { registerLinkRoutes } from "./routes/links.js";
import { registerReadRoutes } from "./routes/reads.js";
import { registerSiteRoutes } from "./routes/site.js";
import { registerSocialRoutes } from "./routes/social.js";
import type { ResolvedSite, SiteConfig } from "./site/config.js";
import { renderLegal } from "./site/legal/index.js";

// ── Public config ─────────────────────────────────────────────────────────────

/** Deep-linking. The worker generates the two `.well-known` files from
 * this and renders the `/join/:shortCode` share/landing page. Absent → none of
 * that group is mounted (the worker is API-only). Each platform block is
 * independent: supply only Android, only Apple, or both. */
export interface DeepLinkConfig {
  android?: {
    /** e.g. `com.eigen.rps`. */
    packageName: string;
    /** The signing certs' SHA-256 fingerprints (colon-hex), for App Links. */
    sha256CertFingerprints: string[];
    /** Play Store URL for the "not installed" fallback. */
    storeUrl?: string;
  };
  apple?: {
    /** `TEAMID.BUNDLEID` — the Universal Links `appID`. */
    appId: string;
    /** App Store URL for the "not installed" fallback. */
    storeUrl?: string;
  };
}

/** Opt-in avatar uploads. Absent → the upload/serve routes are not
 * mounted and no R2 binding is needed. Built and tested entirely under local
 * R2 simulation; a real bucket (and thus a card) enters only at deploy. */
export interface AvatarsConfig<TEnv> {
  /** The R2 bucket for avatar objects (key = uid). */
  bucket(env: TEnv): R2Bucket;
  /** Max upload size in bytes; defaults to 2 MiB. */
  maxBytes?: number;
  /** Public base URL for direct-from-bucket reads — a bucket custom domain
   * (`https://avatars.game.com`) or an r2.dev URL. Absent/empty → the worker
   * serves avatars at `/avatars/{uid}` (the zoneless default). Set it and
   * stored `avatar_url`s point straight at the bucket, so reads never invoke
   * the worker. An `env` accessor so dev (unset) and prod (a var) differ with
   * no code change — the "the flip stays a config change" seam. */
  publicBaseUrl?(env: TEnv): string | undefined;
}

/** The EngineConfig seam: the engine never assumes binding names — the
 * implementor picks bindings off their own Env. Annotate the accessors' `env`
 * parameter and both type arguments infer. */
export interface EngineConfig<TEnv, TDO extends BaseGameDO<TEnv>> {
  gameModule: GameModule;
  /** The whitelabel app's display name — the single source of truth for the
   * engine's own identity (the `/j` share/landing page title + OG tags today;
   * FCM titles and share copy later). Deliberately top-level, not nested under
   * `deepLink`, so there is one place to set it regardless of which optional
   * feature blocks are enabled. */
  appName: string;
  /** The engine's D1 database (engine-private). */
  d1(env: TEnv): D1Database;
  /** The GameDO namespace binding. */
  gameDO(env: TEnv): DurableObjectNamespace<TDO>;
  /** Firebase project id for token verification; defaults to the
   * `FIREBASE_PROJECT_ID` var (the only secret verification needs). */
  firebaseProjectId?(env: TEnv): string;
  /** Deep linking + share pages. Omit → not mounted. */
  deepLink?: DeepLinkConfig;
  /** Opt-in avatar uploads. Omit → not mounted. */
  avatars?: AvatarsConfig<TEnv>;
  /** The public web surface — landing page, legal documents, crawler files.
   * Omit → not mounted (the worker is API-only). */
  site?: SiteConfig;
  /** Cron-backstop tuning — guest-purge/reap windows and batch caps.
   * Omit for the defaults ({@link LIFECYCLE_DEFAULTS}); set any subset to
   * override just those. */
  lifecycle?: LifecycleOptions;
  /** Test seam only: replace the token verifier (tests mint their own RS256
   * tokens against a local JWKS). Leave unset in production. */
  auth?: TokenVerifier;
}

/** {@link AvatarsConfig} with the implementor's Env generic erased — what the
 * routes see. `maxBytes` is resolved to its default here. */
export interface ResolvedAvatars {
  bucket(env: unknown): R2Bucket;
  maxBytes: number;
  publicBaseUrl(env: unknown): string | undefined;
}

export type { LegalConfig, OperatorConfig, ResolvedSite, SiteConfig } from "./site/config.js";

// ── Internal route context (erases the implementor's Env generics) ────────────

export interface RouteContext {
  gameModule: GameModule;
  /** The whitelabel app name (see {@link EngineConfig.appName}) — read by the
   * `/j` landing page and any future engine-owned copy. */
  appName: string;
  d1(env: unknown): D1Database;
  stub(env: unknown, gameId: string): GameStub;
  verify(env: unknown, token: string): Promise<AuthClaims>;
  /** The engine bot-signing master secret, read from env by the
   * `BOT_SIGNING_SECRET` convention. Null when unset — the `/api/bot/action`
   * route then refuses every request (external bots are unsupported). */
  botSigningSecret(env: unknown): string | null;
  /** The Firebase service account (account deletion FCM), or null
   * when the `FIREBASE_*` service-account vars are unset. */
  serviceAccount(env: unknown): ServiceAccount | null;
  /** The finished-game replay backend (seam #2). V1 is DO-backed; the
   * cold tier swaps the implementation without touching the route. */
  history(env: unknown): HistoryStore;
  /** Deep-link config, or null when not configured — the well-known +
   * landing routes are then not mounted. */
  deepLink: DeepLinkConfig | null;
  /** Avatar config, or null when uploads are not enabled — the
   * upload/serve routes are then not mounted. */
  avatars: ResolvedAvatars | null;
  /** Site config, or null when the public web surface is not configured — the
   * landing/legal/crawler routes are then not mounted. */
  site: ResolvedSite | null;
}

/** What the auth middleware resolves for every request. */
export interface Authed {
  claims: AuthClaims;
  user: UserRow;
}

export type AppEnv = { Bindings: object; Variables: { auth: Authed } };

/** A fresh @hono/zod-openapi app with the engine's shared validation-error
 * shape. No basePath — callers mount it under a prefix (`/api/engine`,
 * `/api/bot`) so a validation failure reads the same everywhere. */
function newOpenApiApp() {
  return new OpenAPIHono<AppEnv>({
    // Request-validation failures share the engine error shape.
    defaultHook: (result, c) => {
      if (!result.success) {
        const detail = result.error.issues.map((issue) => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message)).join("; ");
        return c.json({ error: `Invalid request: ${detail}` }, 400);
      }
    },
  });
}

/** The engine's hono app type — what the route modules register against. Both
 * the Firebase-authed engine group and the HMAC bot group are this shape (a
 * bare @hono/zod-openapi app); the auth difference is per-group middleware, not
 * a different app type. */
export type EngineApp = ReturnType<typeof newOpenApiApp>;

const errorHandler: ErrorHandler<AppEnv> = (error, c) => {
  if (error instanceof HttpError) {
    const headers = error.retryAfterSeconds !== undefined ? { "Retry-After": String(error.retryAfterSeconds) } : undefined;
    return c.json({ error: error.message, ...(error.code !== undefined ? { code: error.code } : {}) }, error.status, headers);
  }
  if (error instanceof AuthError) {
    return c.json({ error: error.message }, 401);
  }
  // GameBugError, DO integrity throws, storage failures: server faults.
  console.error("unhandled engine error", error);
  return c.json({ error: "Internal server error" }, 500);
};

function authMiddleware(ctx: RouteContext): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header("authorization");
    // The query fallback exists for WebSocket upgrades — browsers cannot set
    // headers on those. Everything else sends the Authorization header.
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : c.req.query("token");
    if (token === undefined || token.length === 0) {
      throw new HttpError(401, "Missing bearer token");
    }
    const claims = await ctx.verify(c.env, token);
    const user = await ensureUser(ctx.d1(c.env), claims, Date.now());
    c.set("auth", { claims, user });
    await next();
  };
}

/** Assemble the whole worker: the Firebase-authed engine group
 * (`/api/engine/*`), the HMAC-authed external-bot group (`/api/bot/*`), and the
 * unauthed public web surface (`/health`, `/.well-known/*`, `/join/:code`,
 * `/avatars/:uid`), all on one outer app.
 *
 * The engine and bot groups are separate `OpenAPIHono` instances, so the
 * engine's `use("*", auth)` is scoped to it and never runs for `/api/bot/*` or
 * the web routes — those authenticate themselves (HMAC) or are public.
 * Mounting merges each group's OpenAPI operations into the outer document, so a
 * single spec describes both API groups, each with its own security scheme
 * (`firebase` vs `botHmac`). The web routes are plain (non-OpenAPI) handlers
 * and mounted only when their config block is present. */
export function buildApp(ctx: RouteContext) {
  const engine = newOpenApiApp();
  engine.onError(errorHandler);
  engine.use("*", authMiddleware(ctx));
  registerReadRoutes(engine, ctx);
  registerGameRoutes(engine, ctx);
  registerAccountRoutes(engine, ctx);
  registerDeviceRoutes(engine, ctx);
  registerSocialRoutes(engine, ctx);
  if (ctx.avatars !== null) registerAvatarUpload(engine, ctx);

  const bot = newOpenApiApp();
  bot.onError(errorHandler);
  registerBotRoutes(bot, ctx);

  const app = newOpenApiApp();
  app.onError(errorHandler);
  app.openAPIRegistry.registerComponent("securitySchemes", "firebase", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "A Firebase ID token, sent as `Authorization: Bearer <token>` (or `?token=` on WebSocket upgrades).",
  });
  app.openAPIRegistry.registerComponent("securitySchemes", "botHmac", {
    type: "apiKey",
    in: "header",
    name: "Eigen-Signature",
    description: "An external bot's HMAC signature over the exact request body, bound to the `action` domain. Scheme `v1,<base64>`; the per-bot key is `HMAC(BOT_SIGNING_SECRET, bot_id)`. The engine signs wakes with the same header in the other direction.",
  });
  // Liveness. Unconditional, unauthed, and deliberately does NO I/O — no D1,
  // no DO, no config disclosure. That is what makes it safe to leave open: it
  // costs exactly one worker invocation, the same as the 404 every unknown
  // path already returns, so it adds no amplification surface and needs no
  // rate limiting. A check that touched D1 would be both a cost multiplier and
  // a config leak, and belongs behind a secret instead.
  //
  // In the OpenAPI document (unlike the rest of the public surface) so the
  // generated client can reach it: it is the one call that distinguishes "the
  // device is offline" from "the server is unreachable", which is a real
  // thing for an app to show. `security: []` opts it out of the document-wide
  // bearer requirement.
  //
  // `no-store` matters — a cached 200 at the edge would keep reporting healthy
  // after the worker stopped being able to serve.
  app.openapi(
    createRoute({
      method: "get",
      path: "/health",
      operationId: "getHealth",
      tags: ["Health"],
      security: [],
      summary: "Liveness probe",
      description:
        "Public, unauthenticated liveness check. Performs no I/O and reads no configuration, so a 200 means only that the worker is deployed and routable — it does **not** imply that D1, the game Durable Objects, or auth are correctly configured. Served `no-store`. Safe to call without a token; a bad token is ignored rather than rejected.",
      responses: {
        200: {
          // `status` is a plain string, NOT a literal/enum. A single-member
          // enum would generate a closed Dart enum, and closed enums are a
          // breaking change to extend — so a later "degraded" would need a
          // schema-version bump and a coordinated client release. The status
          // of a liveness probe is exactly the kind of field that grows, and
          // clients should treat the 200 itself as the signal anyway.
          content: { "application/json": { schema: z.object({ status: z.string() }).openapi("Health") } },
          description: "The worker is deployed and serving",
        },
      },
    }),
    (c) => c.json({ status: "ok" }, 200, { "Cache-Control": "no-store" }),
  );

  // Public web surface: outside /api, unauthed, mounted only when
  // configured. A distinct path space from /api, so mount order is immaterial.
  if (ctx.deepLink !== null) registerLinkRoutes(app, ctx);
  if (ctx.avatars !== null) registerAvatarServe(app, ctx);
  if (ctx.site !== null) registerSiteRoutes(app, ctx);
  app.route("/api/engine", engine);
  app.route("/api/bot", bot);
  return app;
}

// ── The factory ───────────────────────────────────────────────────────────────

/** Apply {@link SiteConfig} defaults and render the legal documents once, at
 * startup. Rendering here rather than per-request keeps prose off the request
 * path entirely. */
function resolveSite(cfg: SiteConfig, appName: string): ResolvedSite {
  const name = cfg.name ?? appName;
  const ogImage = cfg.ogImage ?? "/og-image.png";
  return {
    name,
    tagline: cfg.tagline,
    description: cfg.description ?? cfg.tagline,
    primaryColor: cfg.primaryColor,
    canonicalOrigin: cfg.canonicalOrigin.replace(/\/+$/, ""),
    screenshots: cfg.screenshots ?? [],
    ogImage: ogImage.startsWith("/") ? ogImage : `/${ogImage}`,
    operator: cfg.operator,
    legal: renderLegal(cfg.legal, { appName: name, operator: cfg.operator }),
  };
}

export function createEngine<TEnv extends object, TDO extends BaseGameDO<TEnv>>(cfg: EngineConfig<TEnv, TDO>): ExportedHandler<TEnv> {
  const projectId = (env: TEnv): string => {
    if (cfg.firebaseProjectId !== undefined) return cfg.firebaseProjectId(env);
    const id = (env as Record<string, unknown>).FIREBASE_PROJECT_ID;
    if (typeof id !== "string" || id.length === 0) {
      throw new HttpError(500, "FIREBASE_PROJECT_ID is not configured");
    }
    return id;
  };
  const ctx: RouteContext = {
    gameModule: cfg.gameModule,
    appName: cfg.appName,
    d1: (env) => cfg.d1(env as TEnv),
    stub: (env, gameId) => {
      const ns = cfg.gameDO(env as TEnv);
      return ns.get(ns.idFromName(gameId));
    },
    verify: (env, token) => (cfg.auth ?? createFirebaseVerifier(projectId(env as TEnv))).verify(token),
    botSigningSecret: (env) => {
      const secret = (env as Record<string, unknown>).BOT_SIGNING_SECRET;
      return typeof secret === "string" && secret.length > 0 ? secret : null;
    },
    serviceAccount: (env) => readServiceAccount(env),
    history: (env) => doHistoryStore((gameId) => ctx.stub(env, gameId)),
    deepLink: cfg.deepLink ?? null,
    avatars:
      cfg.avatars === undefined
        ? null
        : {
            bucket: (env) => (cfg.avatars as AvatarsConfig<TEnv>).bucket(env as TEnv),
            maxBytes: cfg.avatars.maxBytes ?? 2 * 1024 * 1024,
            publicBaseUrl: (env) => (cfg.avatars as AvatarsConfig<TEnv>).publicBaseUrl?.(env as TEnv),
          },
    site: cfg.site === undefined ? null : resolveSite(cfg.site, cfg.appName),
  };
  const app = buildApp(ctx);
  const ops = (env: TEnv): EngineOps => ({
    d1: ctx.d1(env),
    stub: (gameId) => ctx.stub(env, gameId),
    serviceAccount: ctx.serviceAccount(env),
    avatarBucket: ctx.avatars === null ? null : ctx.avatars.bucket(env),
  });
  return {
    fetch: (request, env, executionCtx) => app.fetch(request, env, executionCtx),
    // The cron backstop: stale-guest purge + abandoned-game reap. No
    // timeout sweep — the DO deadline alarm owns every turn deadline. Runs
    // in-band; the platform keeps the invocation alive while the promise
    // pends, so no waitUntil is needed.
    scheduled: (_controller, env) => runScheduled(ops(env), cfg.lifecycle),
  };
}

// ── OpenAPI emission (generated here, vendored into the Dart repo) ──────

/** Build the API document from an inert app — route handlers never run, so
 * the context can refuse everything. `appName` is an unused placeholder here:
 * with `deepLink: null` the landing route (its only reader) is never mounted. */
export function openApiDocument(): OpenAPIObject {
  const inert = (): never => {
    throw new Error("openApiDocument(): routes are not executable");
  };
  const app = buildApp({ gameModule: { versions: {} }, appName: "<unused>", d1: inert, stub: inert, verify: inert, botSigningSecret: () => null, serviceAccount: () => null, history: inert, deepLink: null, avatars: null, site: null });
  return app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: {
      title: "Eigen Engine API",
      version: "1.0.0",
      description: "The server-authoritative game engine API. Client routes (`/api/engine/*`) require a Firebase ID token; the external-bot webhook (`/api/bot/action`) is HMAC-authenticated.",
    },
    // The default requirement is the client's Firebase token; the bot webhook
    // overrides it per-operation with `botHmac`.
    security: [{ firebase: [] }],
  });
}
