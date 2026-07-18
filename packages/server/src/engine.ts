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
 * hono + @hono/zod-openapi under `/api`; every route requires a verified
 * Firebase ID token (§6). Handlers return only their declared 200 shape —
 * every failure is an HttpError throw rendered by the app-level error
 * handler as `{ error, code? }`.
 */

import type { GameModule } from "@eigen/rules";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { ErrorHandler, MiddlewareHandler } from "hono";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { type AuthClaims, AuthError, createFirebaseVerifier, type TokenVerifier } from "./auth/firebase.js";
import { ensureUser, type UserRow } from "./auth/provision.js";
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
}

/** What the auth middleware resolves for every request. */
export interface Authed {
  claims: AuthClaims;
  user: UserRow;
}

export type AppEnv = { Bindings: object; Variables: { auth: Authed } };

function newApp() {
  return new OpenAPIHono<AppEnv>({
    // Request-validation failures share the engine error shape.
    defaultHook: (result, c) => {
      if (!result.success) {
        const detail = result.error.issues.map((issue) => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message)).join("; ");
        return c.json({ error: `Invalid request: ${detail}` }, 400);
      }
    },
  }).basePath("/api");
}

/** The engine's hono app type — what the route modules register against. */
export type EngineApp = ReturnType<typeof newApp>;

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

export function createApp(ctx: RouteContext): EngineApp {
  const app = newApp();
  app.onError(errorHandler);
  app.openAPIRegistry.registerComponent("securitySchemes", "firebase", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "A Firebase ID token.",
  });
  app.use("*", authMiddleware(ctx));
  registerReadRoutes(app, ctx);
  registerGameRoutes(app, ctx);
  return app;
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
  };
  const app = createApp(ctx);
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
  const app = createApp({ gameModule: { versions: {} }, d1: inert, stub: inert, verify: inert });
  return app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: {
      title: "Eigen Engine API",
      version: "1.0.0",
      description: "The server-authoritative game engine API. All routes require a Firebase ID token.",
    },
    security: [{ firebase: [] }],
  });
}
