/**
 * TEMPORARY unauthenticated dev harness — engine-owned so an example app
 * keeps its target shape (rules + a `BaseGameDO` subclass + one call; the
 * same seam discipline as the Supabase-era vendored `engine/index.ts`).
 *
 * It exists so the folded-in §14 Phase 0 spike can be exercised under
 * `wrangler dev` and a manual deploy (see docs/deploy_runbook.md): create a
 * game row, drive commands, open the socket, watch the finish sequence land
 * in D1. It is throwaway — the routes milestone replaces it with
 * `createEngine(...)` (hono + zod-openapi + Firebase auth), and nothing
 * under `/dev/*` survives that. Do not build on it.
 */

import type { JsonObject } from "@eigen/rules";
import { createGame } from "./d1/apply.js";
import type { BaseGameDO } from "./do/game-do.js";
import type { Command, CommandResult, FrameMessage } from "./protocol.js";

export interface DevHarnessConfig<TEnv, TDO extends BaseGameDO<TEnv>> {
  /** The engine's D1 database (same accessor the GameDO subclass uses). */
  d1(env: TEnv): D1Database;
  /** The GameDO namespace binding. The concrete class is inferred —
   * `DurableObjectNamespace<T>` is invariant, so it cannot widen to the
   * base class. */
  gameDO(env: TEnv): DurableObjectNamespace<TDO>;
  /** The `schema_version` dev games are created with. Default 1. */
  schemaVersion?: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** POST /dev/games — the §4.1 worker-direct create, dev-shaped: both seats
 * pre-joined (`dev-a` creator, `dev-b`), status ready, `config` passed
 * through opaquely to the game's rules. */
async function createDevGame<TEnv, TDO extends BaseGameDO<TEnv>>(cfg: DevHarnessConfig<TEnv, TDO>, request: Request, env: TEnv): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    config?: JsonObject;
    turnSeconds?: number;
    rated?: boolean;
  };
  const gameId = crypto.randomUUID();
  const shortCode = gameId.slice(0, 6);
  await createGame(cfg.d1(env), {
    gameId,
    createdBy: "dev-a",
    status: "ready",
    access: "public",
    schemaVersion: cfg.schemaVersion ?? 1,
    config: body.config ?? {},
    turnSeconds: body.turnSeconds ?? null,
    budgetSeconds: null,
    incrementSeconds: null,
    rated: body.rated ?? false,
    ratingPool: body.rated ? "standard" : null,
    minPlayers: 2,
    maxPlayers: 2,
    shortCode,
    seats: [
      { player_index: 0, user_id: "dev-a", bot_id: null, type: "human" },
      { player_index: 1, user_id: "dev-b", bot_id: null, type: "human" },
    ],
    now: Date.now(),
  });
  return json({ gameId, shortCode, seats: { "dev-a": 0, "dev-b": 1 } }, 201);
}

/** Build the dev worker: `export default createDevHarness({ ... })` —
 * annotate the accessors' `env` parameter and both type args infer. */
export function createDevHarness<TEnv, TDO extends BaseGameDO<TEnv>>(cfg: DevHarnessConfig<TEnv, TDO>): ExportedHandler<TEnv> {
  return {
    async fetch(request, env): Promise<Response> {
      const url = new URL(request.url);
      const match = url.pathname.match(/^\/dev\/games(?:\/([^/]+)(?:\/([^/]+))?)?$/);
      if (!match) {
        return new Response("eigen dev harness. POST /dev/games to begin.", { status: url.pathname === "/" ? 200 : 404 });
      }
      const [, gameId, tail] = match;

      if (gameId === undefined) {
        if (request.method !== "POST") return json({ error: "POST to create" }, 405);
        return await createDevGame(cfg, request, env);
      }
      const ns = cfg.gameDO(env);
      const stub = ns.get(ns.idFromName(gameId));

      switch (tail) {
        case "commands": {
          // Body: a Command minus gameId/commandId (harness fills those in).
          const body = (await request.json()) as Omit<Command, "gameId" | "commandId"> & { commandId?: string };
          const cmd = { ...body, gameId, commandId: body.commandId ?? crypto.randomUUID() } as Command;
          const result: CommandResult = await stub.handle(cmd);
          return json(result, result.ok ? 200 : 409);
        }
        case "frames": {
          const seat = url.searchParams.get("seat");
          const frames: FrameMessage[] = await stub.frames({
            seat: seat === null ? null : Number.parseInt(seat, 10),
            from: Number.parseInt(url.searchParams.get("from") ?? "0", 10),
            to: Number.parseInt(url.searchParams.get("to") ?? "1000000", 10),
            isReplay: url.searchParams.get("replay") === "1",
          });
          return json(frames);
        }
        case "socket": {
          // Forward the upgrade; in the real engine the worker authenticates
          // and stamps these headers itself.
          const headers = new Headers(request.headers);
          headers.set("x-eigen-game", gameId);
          const seat = url.searchParams.get("seat");
          if (seat !== null) headers.set("x-eigen-seat", seat);
          return await stub.fetch(new Request(request.url, { headers }));
        }
        case "repoke": {
          return json({ applied: await stub.repokeFinish() });
        }
        default:
          return json({ error: "unknown dev route" }, 404);
      }
    },
  };
}
