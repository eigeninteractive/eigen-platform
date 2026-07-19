/**
 * `createEngine` — the deployable API (engine_stack.md §2.3). An implementor
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
 * gated by a verified Firebase ID token — §6) and the external-bot webhook
 * (`/api/bot/*`, self-authenticated by an HMAC signature — §7). They are
 * separate sub-apps mounted on one `/api` root, so the engine's auth
 * middleware is scoped to the engine sub-app and never touches the bot group.
 * Handlers return only their declared 200 shape — every failure is an
 * HttpError throw rendered by the app-level error handler as `{ error, code? }`.
 */

import type { GameModule } from "@eigen/rules";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { ErrorHandler, MiddlewareHandler } from "hono";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { type AuthClaims, AuthError, createFirebaseVerifier, type TokenVerifier } from "./auth/firebase.js";
import { ensureUser, type UserRow } from "./auth/provision.js";
import { registerBotRoutes } from "./bot/routes.js";
import type { BaseGameDO } from "./do/game-do.js";
import { HttpError } from "./http.js";
import type { Command, CommandResult, FrameMessage } from "./protocol.js";
import { registerGameRoutes } from "./routes/games.js";
import { registerReadRoutes } from "./routes/reads.js";

// ── Public config ─────────────────────────────────────────────────────────────

/** The EngineConfig seam: the engine never assumes binding names — the
 * implementor picks bindings off their own Env. Annotate the accessors' `env`
 * parameter and both type arguments infer. */
export interface EngineConfig<TEnv, TDO extends BaseGameDO<TEnv>> {
  gameModule: GameModule;
  /** The engine's D1 database (engine-private — §5.2). */
  d1(env: TEnv): D1Database;
  /** The GameDO namespace binding. */
  gameDO(env: TEnv): DurableObjectNamespace<TDO>;
  /** Firebase project id for token verification; defaults to the
   * `FIREBASE_PROJECT_ID` var (§6 — the only secret verification needs). */
  firebaseProjectId?(env: TEnv): string;
  /** Test seam only: replace the token verifier (tests mint their own RS256
   * tokens against a local JWKS). Leave unset in production. */
  auth?: TokenVerifier;
}

// ── Internal route context (erases the implementor's Env generics) ────────────

/** The DO surface routes call — structurally the RPC stub of any
 * `BaseGameDO` subclass. */
export interface GameStub {
  handle(cmd: Command): Promise<CommandResult>;
  frames(args: { seat: number | null; from: number; to: number; isReplay?: boolean }): Promise<FrameMessage[]>;
  repokeFinish(): Promise<boolean>;
  fetch(request: Request): Promise<Response>;
}

export interface RouteContext {
  gameModule: GameModule;
  d1(env: unknown): D1Database;
  stub(env: unknown, gameId: string): GameStub;
  verify(env: unknown, token: string): Promise<AuthClaims>;
  /** The engine bot-signing master secret (§7), read from env by the
   * `BOT_SIGNING_SECRET` convention. Null when unset — the `/api/bot/action`
   * route then refuses every request (external bots are unsupported). */
  botSigningSecret(env: unknown): string | null;
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
    return c.json({ error: error.message, ...(error.code !== undefined ? { code: error.code } : {}) }, error.status);
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

/** Assemble the whole API: the Firebase-authed engine group and the
 * HMAC-authed external-bot group, mounted as two sub-apps on one `/api` root.
 *
 * The two groups share the `/api` prefix but are separate `OpenAPIHono`
 * instances, so the engine's `use("*", auth)` is scoped to the engine sub-app
 * (its matcher becomes `/api/engine/*` once mounted) and never runs for
 * `/api/bot/*` — the bot webhook carries no Firebase token and authenticates
 * itself. Mounting also merges each sub-app's OpenAPI operations into the
 * root's document, so a single spec describes both groups, each with its own
 * security scheme (`firebase` vs `botHmac`). */
export function buildApp(ctx: RouteContext) {
  const engine = newOpenApiApp();
  engine.onError(errorHandler);
  engine.use("*", authMiddleware(ctx));
  registerReadRoutes(engine, ctx);
  registerGameRoutes(engine, ctx);

  const bot = newOpenApiApp();
  bot.onError(errorHandler);
  registerBotRoutes(bot, ctx);

  const root = newOpenApiApp().basePath("/api");
  root.onError(errorHandler);
  root.openAPIRegistry.registerComponent("securitySchemes", "firebase", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "A Firebase ID token, sent as `Authorization: Bearer <token>` (or `?token=` on WebSocket upgrades).",
  });
  root.openAPIRegistry.registerComponent("securitySchemes", "botHmac", {
    type: "apiKey",
    in: "header",
    name: "Eigen-Signature",
    description: "An external bot's HMAC signature over the exact request body, bound to the `action` domain (§7). Scheme `v1,<base64>`; the per-bot key is `HMAC(BOT_SIGNING_SECRET, bot_id)`. The engine signs wakes with the same header in the other direction.",
  });
  root.route("/engine", engine);
  root.route("/bot", bot);
  return root;
}

// ── The factory ───────────────────────────────────────────────────────────────

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
  };
  const app = buildApp(ctx);
  return {
    fetch: (request, env, executionCtx) => app.fetch(request, env, executionCtx),
  };
}

// ── OpenAPI emission (§2.1: generated here, vendored into the Dart repo) ──────

/** Build the API document from an inert app — route handlers never run, so
 * the context can refuse everything. */
export function openApiDocument(): OpenAPIObject {
  const inert = (): never => {
    throw new Error("openApiDocument(): routes are not executable");
  };
  const app = buildApp({ gameModule: { versions: {} }, d1: inert, stub: inert, verify: inert, botSigningSecret: () => null });
  return app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: {
      title: "Eigen Engine API",
      version: "1.0.0",
      description: "The server-authoritative game engine API. Client routes (`/api/engine/*`) require a Firebase ID token; the external-bot webhook (`/api/bot/action`) is HMAC-authenticated (§7).",
    },
    // The default requirement is the client's Firebase token; the bot webhook
    // overrides it per-operation with `botHmac`.
    security: [{ firebase: [] }],
  });
}
