/**
 * The read routes: worker → D1, never a DO — lobby,
 * my-games (through the participants index), the game summary, the batch
 * players endpoint, the bot catalog, and the caller's profile + ratings.
 */

import { createRoute, z } from "@hono/zod-openapi";
import { clampIds, readBots, readGame, readLobby, readMyGames, readPlayers, readRatingHistory, readRatings } from "../d1/reads.js";
import type { EngineApp, RouteContext } from "../engine.js";
import { HttpError } from "../http.js";
import { botShape, errorShape, gameSummaryOf, gameSummaryShape, playerOf, playerShape, profileShape } from "./wire.js";

function okResponse<T extends z.ZodType>(schema: T, description: string) {
  const error = (what: string) => ({ content: { "application/json": { schema: errorShape } }, description: what });
  return {
    200: { content: { "application/json": { schema } }, description },
    400: error("Invalid request"),
    401: error("Missing or invalid token"),
    403: error("Not allowed"),
    404: error("Not found"),
  } as const;
}

const limitQuery = z.coerce.number().int().min(1).max(50).default(20);

export function registerReadRoutes(app: EngineApp, ctx: RouteContext): void {
  app.openapi(
    createRoute({
      method: "get",
      path: "/lobby",
      operationId: "getLobby",
      request: { query: z.object({ limit: limitQuery }) },
      responses: okResponse(z.object({ games: z.array(gameSummaryShape) }).openapi("Lobby"), "Public joinable games, newest first"),
    }),
    async (c) => {
      const { limit } = c.req.valid("query");
      const games = await readLobby(ctx.d1(c.env), limit);
      return c.json({ games: games.map(gameSummaryOf) }, 200);
    },
  );

  // Registered before /games/{gameId} so "mine" never resolves as an id.
  app.openapi(
    createRoute({
      method: "get",
      path: "/games/mine",
      operationId: "getMyGames",
      request: { query: z.object({ bucket: z.enum(["active", "finished"]).default("active"), limit: limitQuery }) },
      responses: okResponse(z.object({ games: z.array(gameSummaryShape) }).openapi("MyGames"), "The caller's games in the requested bucket"),
    }),
    async (c) => {
      const { bucket, limit } = c.req.valid("query");
      const games = await readMyGames(ctx.d1(c.env), c.var.auth.user.id, bucket, limit);
      return c.json({ games: games.map(gameSummaryOf) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/games/{gameId}",
      operationId: "getGame",
      request: { params: z.object({ gameId: z.string().min(1) }) },
      responses: okResponse(gameSummaryShape, "The game summary — never state"),
    }),
    async (c) => {
      const game = await readGame(ctx.d1(c.env), c.req.valid("param").gameId);
      if (game === undefined) throw new HttpError(404, "Unknown game");
      return c.json(gameSummaryOf(game), 200);
    },
  );

  // The batch identity endpoint — the decided alternative to denormalizing
  // identity onto games rows; the client's persisted cache keeps it warm.
  app.openapi(
    createRoute({
      method: "get",
      path: "/players",
      operationId: "getPlayers",
      request: { query: z.object({ ids: z.string().min(1) }) },
      responses: okResponse(z.object({ players: z.array(playerShape) }).openapi("Players"), "Public identity for up to 50 comma-separated user ids"),
    }),
    async (c) => {
      const ids = clampIds(c.req.valid("query").ids.split(","), 50);
      const players = await readPlayers(ctx.d1(c.env), ids);
      return c.json({ players: players.map(playerOf) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/bots",
      operationId: "getBots",
      responses: okResponse(z.object({ bots: z.array(botShape) }).openapi("Bots"), "The bot catalog"),
    }),
    async (c) => {
      const bots = await readBots(ctx.d1(c.env));
      return c.json(
        {
          bots: bots.map((b) => ({
            id: b.id,
            username: b.username,
            display_name: b.displayName,
            avatar_url: b.avatarUrl,
            schema_version: b.schemaVersion,
            rated_eligible: b.ratedEligible,
            config: b.config,
          })),
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/me",
      operationId: "getProfile",
      responses: okResponse(profileShape, "The caller's own profile"),
    }),
    async (c) => {
      const user = c.var.auth.user;
      return c.json({ ...playerOf(user), email: user.email, created_at: user.createdAt }, 200);
    },
  );

  const ratingShape = z.object({ pool: z.string(), mu: z.number(), sigma: z.number(), display_rating: z.number().int(), updated_at: z.number() }).openapi("Rating");
  app.openapi(
    createRoute({
      method: "get",
      path: "/me/ratings",
      operationId: "getMyRatings",
      responses: okResponse(z.object({ ratings: z.array(ratingShape) }).openapi("Ratings"), "The caller's current rating per pool"),
    }),
    async (c) => {
      const rows = await readRatings(ctx.d1(c.env), c.var.auth.user.id);
      return c.json({ ratings: rows.map((r) => ({ pool: r.pool, mu: r.mu, sigma: r.sigma, display_rating: r.displayRating, updated_at: r.updatedAt })) }, 200);
    },
  );

  const historyShape = z
    .object({
      game_id: z.string(),
      pool: z.string(),
      display_before: z.number().int(),
      display_after: z.number().int(),
      display_change: z.number().int(),
      created_at: z.number(),
    })
    .openapi("RatingHistoryEntry");
  app.openapi(
    createRoute({
      method: "get",
      path: "/me/rating-history",
      operationId: "getMyRatingHistory",
      request: { query: z.object({ pool: z.string().optional(), limit: limitQuery }) },
      responses: okResponse(z.object({ history: z.array(historyShape) }).openapi("RatingHistory"), "The caller's rating log, newest first"),
    }),
    async (c) => {
      const { pool, limit } = c.req.valid("query");
      const rows = await readRatingHistory(ctx.d1(c.env), c.var.auth.user.id, pool ?? null, limit);
      return c.json(
        {
          history: rows.map((r) => ({
            game_id: r.gameId,
            pool: r.pool,
            display_before: r.displayBefore,
            display_after: r.displayAfter,
            display_change: r.displayChange,
            created_at: r.createdAt,
          })),
        },
        200,
      );
    },
  );
}
