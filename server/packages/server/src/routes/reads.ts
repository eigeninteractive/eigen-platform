/**
 * The read routes: worker → D1, never a DO. Lobby, the game summary, the batch
 * players endpoint, the bot catalog, the caller's profile, and the account sync
 * with its history backfill.
 */

import { createRoute, z } from "@hono/zod-openapi";
import { botTier } from "../commerce/capability.js";
import { decodeOptionalCursor } from "../cursor.js";
import { clampIds, gameExists, readBots, readGame, readLobby, readMyFinishedGames, readPlayerPublicGames, readPlayers, readRatings } from "../d1/reads.js";
import { readAccountSync } from "../d1/sync.js";
import type { EngineApp, RouteContext } from "../engine.js";
import { HttpError } from "../http.js";
import { cursorQuery, limitQuery, nextCursorShape, sequenceQuery } from "./query.js";
import { botOf, botShape, errorShape, gameSummaryOf, gameSummaryShape, playerOf, playerShape, profileOf, profileShape, ratingShape, sessionShape, syncShape } from "./wire.js";

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

export function registerReadRoutes(app: EngineApp, ctx: RouteContext): void {
  app.openapi(
    createRoute({
      method: "get",
      path: "/lobby",
      operationId: "getLobby",
      tags: ["Games"],
      request: { query: z.object({ limit: limitQuery, cursor: cursorQuery }) },
      responses: okResponse(z.object({ games: z.array(gameSummaryShape), nextCursor: nextCursorShape }).openapi("Lobby"), "Public joinable games, newest first"),
    }),
    async (c) => {
      const { limit, cursor } = c.req.valid("query");
      const page = await readLobby(ctx.d1(c.env), limit, decodeOptionalCursor(cursor), c.var.auth.user.id);
      return c.json({ games: page.rows.map(gameSummaryOf), nextCursor: page.nextCursor }, 200);
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
      if (!(await gameExists(ctx.d1(c.env), gameId))) {
        throw new HttpError(404, "Unknown game", "unknownGame");
      }
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
      return c.json({ bots: bots.map((bot) => botOf(bot, botTier(ctx.commerce?.catalog, bot))) }, 200);
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
    async (c) => c.json(profileOf(c.var.auth.user), 200),
  );

  // Everything a device keeps about the account, in one transaction: the one
  // read a device's sync pass makes (decision 0013). It replaces a read per
  // screen, so opening a screen costs nothing and a sync costs one request.
  app.openapi(
    createRoute({
      method: "get",
      path: "/me/sync",
      operationId: "syncAccount",
      tags: ["Me"],
      request: { query: z.object({ finishedAfter: sequenceQuery.optional() }) },
      responses: okResponse(syncShape, "The caller's account, whole where small and incremental where it grows"),
    }),
    async (c) => {
      const { finishedAfter } = c.req.valid("query");
      const user = c.var.auth.user;
      const sync = await readAccountSync(ctx.d1(c.env), user.id, finishedAfter ?? null);
      return c.json(
        {
          account: profileOf(user),
          ratings: sync.ratings,
          friends: sync.friends,
          friendRequests: sync.friendRequests,
          activeGames: sync.activeGames.map(gameSummaryOf),
          finishedGames: sync.finishedGames.map(gameSummaryOf),
          players: sync.players.map(playerOf),
          finishedCursor: sync.finishedCursor,
          hasMoreFinished: sync.hasMoreFinished,
          historyFloor: sync.historyFloor,
        },
        200,
      );
    },
  );

  // History older than what the sync handed a device: continues from its
  // `historyFloor`, newest first.
  app.openapi(
    createRoute({
      method: "get",
      path: "/me/games/finished",
      operationId: "getMyFinishedGames",
      tags: ["Me"],
      request: { query: z.object({ limit: limitQuery, cursor: cursorQuery }) },
      responses: okResponse(z.object({ games: z.array(gameSummaryShape), nextCursor: nextCursorShape }).openapi("MyFinishedGames"), "The caller's finished games, newest first"),
    }),
    async (c) => {
      const { limit, cursor } = c.req.valid("query");
      const page = await readMyFinishedGames(ctx.d1(c.env), c.var.auth.user.id, limit, decodeOptionalCursor(cursor));
      return c.json({ games: page.rows.map(gameSummaryOf), nextCursor: page.nextCursor }, 200);
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
      responses: okResponse(z.object({ games: z.array(gameSummaryShape), nextCursor: nextCursorShape }).openapi("PlayerGames"), "That player's finished public games, newest first"),
    }),
    async (c) => {
      const { limit, cursor } = c.req.valid("query");
      const page = await readPlayerPublicGames(ctx.d1(c.env), c.req.valid("param").playerId, limit, decodeOptionalCursor(cursor));
      return c.json({ games: page.rows.map(gameSummaryOf), nextCursor: page.nextCursor }, 200);
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
}
