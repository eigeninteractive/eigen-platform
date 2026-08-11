/**
 * The read routes: worker → D1, never a DO. Lobby,
 * my-games (through the participants index), the game summary, the batch
 * players endpoint, the bot catalog, and the caller's profile + ratings.
 */

import { createRoute, z } from "@hono/zod-openapi";
import { clampIds, readBots, readGame, readLobby, readMyGames, readPlayerPublicGames, readPlayers, readRatingHistory, readRatings } from "../d1/reads.js";
import type { EngineApp, RouteContext } from "../engine.js";
import { HttpError } from "../http.js";
import { botOf, botShape, errorShape, gameSummaryOf, gameSummaryShape, playerOf, playerShape, profileShape, sessionShape } from "./wire.js";

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

/** Keyset cursor: the previous page's last sort value (epoch ms). Absent on the
 * first page. Paging by cursor rather than offset keeps a page stable while the
 * underlying list changes, which for a lobby it constantly does. */
const cursorQuery = z.coerce.number().int().optional();

export function registerReadRoutes(app: EngineApp, ctx: RouteContext): void {
  app.openapi(
    createRoute({
      method: "get",
      path: "/lobby",
      operationId: "getLobby",
      tags: ["Games"],
      request: { query: z.object({ limit: limitQuery, cursor: cursorQuery }) },
      responses: okResponse(z.object({ games: z.array(gameSummaryShape) }).openapi("Lobby"), "Public joinable games, newest first"),
    }),
    async (c) => {
      const { limit, cursor } = c.req.valid("query");
      const games = await readLobby(ctx.d1(c.env), limit, cursor ?? null, c.var.auth.user.id);
      return c.json({ games: games.map(gameSummaryOf) }, 200);
    },
  );

  // Registered before /games/{gameId} so "mine" never resolves as an id.
  app.openapi(
    createRoute({
      method: "get",
      path: "/games/mine",
      operationId: "getMyGames",
      tags: ["Games"],
      request: { query: z.object({ bucket: z.enum(["active", "finished"]).default("active"), limit: limitQuery, cursor: cursorQuery }) },
      responses: okResponse(z.object({ games: z.array(gameSummaryShape) }).openapi("MyGames"), "The caller's games in the requested bucket"),
    }),
    async (c) => {
      const { bucket, limit, cursor } = c.req.valid("query");
      const games = await readMyGames(ctx.d1(c.env), c.var.auth.user.id, bucket, limit, cursor ?? null);
      return c.json({ games: games.map(gameSummaryOf) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/games/{gameId}",
      operationId: "getGame",
      tags: ["Games"],
      request: { params: z.object({ gameId: z.string().min(1) }) },
      responses: okResponse(gameSummaryShape, "The game summary, never state"),
    }),
    async (c) => {
      const game = await readGame(ctx.d1(c.env), c.req.valid("param").gameId);
      if (game === undefined) throw new HttpError(404, "Unknown game", "unknownGame");
      return c.json(gameSummaryOf(game), 200);
    },
  );

  // The one read that goes to the DO rather than D1, because it asks the
  // question only the DO can answer: where is this game NOW, as I see it. The
  // socket delivers the same value and keeps delivering it, so a client with a
  // socket never needs this; it serves the paths without one, and a cold read
  // that wants the truth rather than the index's mirror of it.
  app.openapi(
    createRoute({
      method: "get",
      path: "/games/{gameId}/session",
      operationId: "getGameSession",
      tags: ["Games"],
      request: { params: z.object({ gameId: z.string().min(1) }) },
      responses: okResponse(sessionShape, "The caller's current session snapshot"),
    }),
    async (c) => {
      const { gameId } = c.req.valid("param");
      const session = await ctx.stub(c.env, gameId).session(gameId, c.var.auth.user.id);
      if (session === null) throw new HttpError(404, "Unknown game", "unknownGame");
      return c.json(session, 200);
    },
  );

  // The batch identity endpoint, and why games rows carry no denormalized
  // identity: a renamed user is correct everywhere on the next fetch, with no
  // history rewrite. The client's persisted cache keeps this warm.
  app.openapi(
    createRoute({
      method: "get",
      path: "/players",
      operationId: "getPlayers",
      tags: ["Players"],
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
      tags: ["Bots"],
      responses: okResponse(z.object({ bots: z.array(botShape) }).openapi("Bots"), "The bot catalog"),
    }),
    async (c) => {
      const bots = await readBots(ctx.d1(c.env));
      return c.json({ bots: bots.map(botOf) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/me",
      operationId: "getProfile",
      tags: ["Me"],
      responses: okResponse(profileShape, "The caller's own profile"),
    }),
    async (c) => {
      const user = c.var.auth.user;
      return c.json({ ...playerOf(user), email: user.email, createdAt: user.createdAt }, 200);
    },
  );

  const ratingShape = z.object({ pool: z.string(), mu: z.number(), sigma: z.number(), displayRating: z.number().int(), updatedAt: z.number().int() }).openapi("Rating");
  app.openapi(
    createRoute({
      method: "get",
      path: "/me/ratings",
      operationId: "getMyRatings",
      tags: ["Me"],
      responses: okResponse(z.object({ ratings: z.array(ratingShape) }).openapi("Ratings"), "The caller's current rating per pool"),
    }),
    async (c) => {
      const rows = await readRatings(ctx.d1(c.env), c.var.auth.user.id);
      return c.json({ ratings: rows }, 200);
    },
  );

  // Any player's finished public games: the replay list on a profile. Public
  // and finished only, so this exposes nothing about someone that was not
  // already replayable by anyone holding the game's id.
  app.openapi(
    createRoute({
      method: "get",
      path: "/players/{playerId}/games",
      operationId: "getPlayerGames",
      tags: ["Players"],
      request: { params: z.object({ playerId: z.string().min(1) }), query: z.object({ limit: limitQuery, cursor: cursorQuery }) },
      responses: okResponse(z.object({ games: z.array(gameSummaryShape) }).openapi("PlayerGames"), "That player's finished public games, newest first"),
    }),
    async (c) => {
      const { limit, cursor } = c.req.valid("query");
      const games = await readPlayerPublicGames(ctx.d1(c.env), c.req.valid("param").playerId, limit, cursor ?? null);
      return c.json({ games: games.map(gameSummaryOf) }, 200);
    },
  );

  // Any player's ratings, human or bot: the profile sheet shown for an
  // opponent, and the rating line on a bot in the picker. Display ratings are
  // public (they are visible on every finished game), so this needs no
  // relationship check; it is tagged `Players` alongside the batch identity
  // read because it answers "tell me about someone else", not "tell me about
  // me".
  app.openapi(
    createRoute({
      method: "get",
      path: "/players/{playerId}/ratings",
      operationId: "getPlayerRatings",
      tags: ["Players"],
      request: { params: z.object({ playerId: z.string().min(1) }) },
      responses: okResponse(z.object({ ratings: z.array(ratingShape) }).openapi("Ratings"), "That player's current rating per pool"),
    }),
    async (c) => {
      const rows = await readRatings(ctx.d1(c.env), c.req.valid("param").playerId);
      return c.json({ ratings: rows }, 200);
    },
  );

  const historyShape = z
    .object({
      gameId: z.string(),
      pool: z.string(),
      displayBefore: z.number().int(),
      displayAfter: z.number().int(),
      displayChange: z.number().int(),
      createdAt: z.number().int(),
    })
    .openapi("RatingHistoryEntry");
  app.openapi(
    createRoute({
      method: "get",
      path: "/me/rating-history",
      operationId: "getMyRatingHistory",
      tags: ["Me"],
      request: { query: z.object({ pool: z.string().optional(), limit: limitQuery }) },
      responses: okResponse(z.object({ history: z.array(historyShape) }).openapi("RatingHistory"), "The caller's rating log, newest first"),
    }),
    async (c) => {
      const { pool, limit } = c.req.valid("query");
      const rows = await readRatingHistory(ctx.d1(c.env), c.var.auth.user.id, pool ?? null, limit);
      return c.json({ history: rows }, 200);
    },
  );
}
