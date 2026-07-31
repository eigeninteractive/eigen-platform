/**
 * `createEngine` — the deployable API. An implementor
 * ships exactly:
 *
 * ```ts
 * import { BaseGameDO, createEngine } from '@eigeninteractive/server';
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

import type { GameModule } from "@eigeninteractive/rules";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { ErrorHandler, MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { type AuthClaims, AuthError, createFirebaseVerifier, type TokenVerifier } from "./auth/firebase.js";
import { ensureUser, type UserRow } from "./auth/provision.js";
import { registerBotRoutes } from "./bot/routes.js";
import type { BaseGameDO } from "./do/game-do.js";
import { FirebaseAdminConfigurationError, type FirebaseAdminEffects, firebaseAdminFromEnv } from "./firebase/admin-effects.js";
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
import { registerDownloadRoute, registerSiteRoutes } from "./routes/site.js";
import { registerSocialRoutes } from "./routes/social.js";
import type { ResolvedSite, SiteConfig } from "./site/config.js";
import { renderLegal } from "./site/legal/index.js";

// ── Public config ─────────────────────────────────────────────────────────────

/** Native deep linking. The Worker generates the two `.well-known` files and
 * store links from this configuration. Browser `/join` and `/game` routes also
 * work without it when Flutter is bound as `ASSETS`. Each platform block is
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
   * stored `avatarUrl`s point straight at the bucket, so reads never invoke
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
   * engine's own identity (share metadata and public-page titles today;
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
  /** Browser origins allowed to call the engine from a different origin.
   *
   * Same-origin requests always work. When omitted, the engine trusts the
   * exact origin from the conventional `WEB_APP_ORIGIN` var when it is set.
   * Supply this option to replace that default for multiple or otherwise
   * non-standard browser origins. Paths and wildcards are intentionally
   * unsupported. The list also protects browser WebSocket upgrades, whose
   * `Origin` header is not governed by CORS.
   *
   * Set an empty list to disable the `WEB_APP_ORIGIN` default. */
  clientOrigins?: readonly string[] | ((env: TEnv) => readonly string[]);
  /** Native deep-link verification and store links. Omit for web-only. */
  deepLink?: DeepLinkConfig;
  /** Opt-in avatar uploads. Omit → not mounted. */
  avatars?: AvatarsConfig<TEnv>;
  /** The public web surface — download page, legal documents, crawler files.
   * Omit → not mounted (the worker is API-only). */
  site?: SiteConfig;
  /** Cron-backstop tuning — guest-purge/reap windows and batch caps.
   * Omit for the defaults (`LIFECYCLE_DEFAULTS`); set any subset to
   * override just those. */
  lifecycle?: LifecycleOptions;
  /** Explicit test-only replacements for Firebase verification and Admin
   * effects. Supplying them together prevents a fake verifier from
   * accidentally turning missing production credentials into a nullable
   * runtime path. Leave unset in production. */
  testing?: {
    auth: TokenVerifier;
    firebaseAdmin(env: TEnv): FirebaseAdminEffects;
  };
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
  /** Cross-origin browser clients trusted by this deployment. */
  clientOrigins(env: unknown): readonly string[];
  /** Flutter web assets exposed through Cloudflare's conventional `ASSETS`
   * binding. Null keeps native-only deployments working without web output. */
  webAssets(env: unknown): Fetcher | null;
  /** The engine bot-signing master secret, read from env by the
   * `BOT_SIGNING_SECRET` convention. Null when unset — the `/api/bot/action`
   * route then refuses every request (external bots are unsupported). */
  botSigningSecret(env: unknown): string | null;
  /** Required Firebase Admin effects used by FCM and account deletion. */
  firebaseAdmin(env: unknown): FirebaseAdminEffects;
  /** The finished-game replay backend (seam #2). V1 is DO-backed; the
   * cold tier swaps the implementation without touching the route. */
  history(env: unknown): HistoryStore;
  /** Native deep-link verification and store config, or null when the
   * deployment serves web only. Browser `/join` and `/game` routes can still
   * use the Flutter asset binding. */
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
  if (error instanceof FirebaseAdminConfigurationError) {
    return c.json({ error: error.message }, 500);
  }
  // GameBugError, DO integrity throws, storage failures: server faults.
  console.error("unhandled engine error", error);
  return c.json({ error: "Internal server error" }, 500);
};

function authMiddleware(ctx: RouteContext): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    // Auth and notifications use the same Firebase project. Validate the
    // server-side half at the authenticated boundary so a broken deployment
    // fails clearly instead of silently running without push (or leaving a
    // Firebase account behind during account deletion). Public `/health`
    // remains a configuration-free liveness probe.
    ctx.firebaseAdmin(c.env);
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

function isAllowedClientOrigin(ctx: RouteContext, env: unknown, requestUrl: string, origin: string): boolean {
  return origin === new URL(requestUrl).origin || ctx.clientOrigins(env).includes(origin);
}

function browserCors(ctx: RouteContext): MiddlewareHandler<AppEnv> {
  return cors({
    origin: (origin, c) => (isAllowedClientOrigin(ctx, c.env, c.req.url, origin) ? origin : null),
    allowMethods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 86400,
  });
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
  // CORS belongs on the outer app, before the authenticated sub-app is
  // mounted. That lets an OPTIONS preflight finish without a Firebase token.
  // The public health/avatar reads use the same allowlist because CanvasKit
  // and generated clients may fetch them rather than creating an HTML image.
  app.use("/health", browserCors(ctx));
  app.use("/avatars/*", browserCors(ctx));
  app.use("/api/engine/*", browserCors(ctx));
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
    description: "An external bot's HMAC signature over the exact request body, bound to the `action` domain. Scheme `v1,<base64>`; the per-bot key is `HMAC(BOT_SIGNING_SECRET, botId)`. The engine signs wakes with the same header in the other direction.",
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

  // Public web surface: outside /api and unauthed. Link routes are always
  // registered because a web deployment is discovered per request from the
  // conventional ASSETS binding; without ASSETS or native deep-link config
  // they return the normal 404.
  registerLinkRoutes(app, ctx);
  registerDownloadRoute(app, ctx);
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
    screenshots: cfg.screenshots ?? [],
    ogImage: ogImage.startsWith("/") ? ogImage : `/${ogImage}`,
    operator: cfg.operator,
    legal: renderLegal(cfg.legal, { appName: name, operator: cfg.operator }),
  };
}

/**
 * Creates the complete Cloudflare Worker for one game deployment.
 *
 * Call this once from the default export of `src/index.ts`. The returned
 * handler mounts the authenticated game API, WebSocket upgrades, scheduled
 * lifecycle work, and any configured public/deep-link routes. Game
 * implementors provide only {@link EngineConfig.gameModule} and binding
 * accessors; routes, persistence, migrations, authentication, and session
 * dispatch stay engine-owned.
 *
 * @example
 * ```ts
 * export default createEngine({
 *   gameModule,
 *   appName: "My Game",
 *   d1: (env: Env) => env.GAME_DB,
 *   gameDO: (env: Env) => env.GAME_DO,
 * });
 * ```
 */
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
    verify: (env, token) => (cfg.testing?.auth ?? createFirebaseVerifier(projectId(env as TEnv))).verify(token),
    clientOrigins: (env) => {
      const configured = cfg.clientOrigins;
      if (configured !== undefined) {
        return typeof configured === "function" ? configured(env as TEnv) : configured;
      }
      const webAppOrigin = (env as Record<string, unknown>).WEB_APP_ORIGIN;
      return typeof webAppOrigin === "string" && webAppOrigin.length > 0 ? [new URL(webAppOrigin).origin] : [];
    },
    webAssets: (env) => {
      const assets = (env as Record<string, unknown>).ASSETS;
      return assets !== null && typeof assets === "object" && "fetch" in assets ? (assets as Fetcher) : null;
    },
    botSigningSecret: (env) => {
      const secret = (env as Record<string, unknown>).BOT_SIGNING_SECRET;
      return typeof secret === "string" && secret.length > 0 ? secret : null;
    },
    firebaseAdmin: (env) => cfg.testing?.firebaseAdmin(env as TEnv) ?? firebaseAdminFromEnv(env),
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
    firebaseAdmin: ctx.firebaseAdmin(env),
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
 * with `deepLink: null` the landing route (its only reader) is never mounted.
 *
 * `version` is an argument rather than a constant in here because it has
 * exactly one correct value — `@eigeninteractive/server`'s own — and changesets
 * owns that value. Baked in as a literal it silently disagrees with the package
 * on the first release: nothing reads it back, and the CI drift check only
 * compares this file against itself, so the lie survives every check. The Dart
 * client's pubspec is stamped from the same source for the same reason. */
export function openApiDocument(version: string): OpenAPIObject {
  const inert = (): never => {
    throw new Error("openApiDocument(): routes are not executable");
  };
  const app = buildApp({
    gameModule: { versions: {} },
    appName: "<unused>",
    d1: inert,
    stub: inert,
    verify: inert,
    clientOrigins: () => [],
    webAssets: () => null,
    botSigningSecret: () => null,
    firebaseAdmin: inert,
    history: inert,
    deepLink: null,
    avatars: null,
    site: null,
  });
  return app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: {
      title: "Eigen Engine API",
      version,
      description: "The server-authoritative game engine API. Client routes (`/api/engine/*`) require a Firebase ID token; the external-bot webhook (`/api/bot/action`) is HMAC-authenticated.",
    },
    // Every operation carries a tag; declaring them at the top level gives
    // each one a description, and fixes their order in generated reference
    // documentation (otherwise they appear in first-route-seen order).
    tags: [
      { name: "Games", description: "Create, join, start, play and finish games. The heart of the API: every move is a proposal the server validates against authoritative state." },
      { name: "Me", description: "The signed-in player — profile, username, ratings, rating history and registered devices." },
      { name: "Players", description: "Other players: their public profile, their finished games and their ratings." },
      { name: "Social", description: "Friends, friend requests, blocking and user search." },
      { name: "Bots", description: "The bots this deployment offers as opponents." },
      { name: "BotWebhook", description: "The HMAC-authenticated callback an external bot answers on. Not for clients." },
      { name: "Health", description: "Liveness probe." },
    ],
    // The default requirement is the client's Firebase token; the bot webhook
    // overrides it per-operation with `botHmac`.
    security: [{ firebase: [] }],
  });
}
