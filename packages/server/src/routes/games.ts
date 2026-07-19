/**
 * The game lifecycle routes (engine_stack.md §4): the §4.1 worker-direct
 * create, the §4.2 waiting-room commands (worker policy BEFORE minting; the
 * DO enforces integrity under its gate), active-play action/forfeit, the
 * §4.6 range fetch, and the WebSocket upgrade.
 */

import { parseClientPayload, type Seat } from "@eigen/kernel";
import type { GameRules, JsonObject } from "@eigen/rules";
import { createRoute, z } from "@hono/zod-openapi";
import { createGame } from "../d1/apply.js";
import { type BotRow, type GameWithRoster, isAcceptedFriend, readBots, readGame, readGameByCode } from "../d1/reads.js";
import type { Authed, EngineApp, RouteContext } from "../engine.js";
import { HttpError, unwrap } from "../http.js";
import type { Command, CommandResult } from "../protocol.js";
import { actionBody, addBotBody, commandAcceptedShape, createdShape, createGameBody, createSoloBody, errorShape, forfeitBody, frameShape, joinBody, joinByCodeBody, lobbyAcceptedShape, lobbyCommandBody, soloStartedShape } from "./wire.js";

// ── Route plumbing ────────────────────────────────────────────────────────────

function jsonBody<T extends z.ZodType>(schema: T) {
  return { content: { "application/json": { schema } }, required: true } as const;
}

function responses<T extends z.ZodType>(schema: T, description: string) {
  const error = (what: string) => ({ content: { "application/json": { schema: errorShape } }, description: what });
  return {
    200: { content: { "application/json": { schema } }, description },
    400: error("Invalid request"),
    401: error("Missing or invalid token"),
    403: error("Not allowed"),
    404: error("Not found"),
    409: error("State conflict — resync and retry"),
    422: error("Assertion mismatch"),
  } as const;
}

const gameIdParam = z.object({ gameId: z.string().min(1) });

/** Narrow an accepted result to the lobby (roster) variant. */
function lobbyResult(result: CommandResult) {
  const ok = unwrap(result);
  if (!("roster" in ok)) throw new HttpError(500, "engine bug: expected a roster response");
  return ok;
}

/** Narrow an accepted result to the versioned (frame) variant. */
function commandResult(result: CommandResult) {
  const ok = unwrap(result);
  if (!("version" in ok)) throw new HttpError(500, "engine bug: expected a versioned response");
  return ok;
}

function rulesFor(ctx: RouteContext, schemaVersion: number): GameRules {
  const rules = ctx.gameModule.versions[schemaVersion];
  if (rules === undefined) throw new HttpError(400, `This deployment ships no rules for schema_version ${schemaVersion}`);
  return rules;
}

/** The bot-seating gates (§7), shared by `add-bot` and create-solo. `game` is
 * anything with the game's timing/rated/schema/config — a stored row or a
 * to-be-created spec. Throws an `HttpError` on any failed gate. */
interface BotSeatingGame {
  schemaVersion: number;
  turnSeconds: number | null;
  budgetSeconds: number | null;
  rated: boolean;
  config: JsonObject;
}

function assertBotSeatable(ctx: RouteContext, game: BotSeatingGame, bot: BotRow): void {
  // bots ⇒ timed (§7): a brain that throws, or a DO evicted mid-turn, is
  // resolved by the turn deadline — the one liveness backstop for every bot,
  // in-DO or external.
  if (game.turnSeconds === null && game.budgetSeconds === null) {
    throw new HttpError(400, "A game with a bot must be timed");
  }
  if (game.schemaVersion > bot.schemaVersion) {
    throw new HttpError(400, `Bot does not support schema_version ${game.schemaVersion}`);
  }
  if (game.rated && !bot.ratedEligible) {
    throw new HttpError(400, "This bot is not eligible for rated games");
  }
  const rules = rulesFor(ctx, game.schemaVersion);
  // Dispatch discriminator (§7): an `engine` bot needs a `botActions` entry
  // for its username in this version; an `external` bot needs a webhook (the
  // DB CHECK guarantees it, so this only guards a genuinely broken row); a
  // `local` bot is client-driven and not seatable online until transcript
  // import exists. A bot that can't take its turn is refused here.
  switch (bot.type) {
    case "engine":
      if (rules.botActions?.[bot.username] === undefined) {
        throw new HttpError(400, `The game ships no bot brain named '${bot.username}' for schema_version ${game.schemaVersion}`);
      }
      break;
    case "external":
      if (bot.webhookUrl === null) throw new HttpError(500, "external bot has no webhook_url");
      break;
    case "local":
      throw new HttpError(400, "Local bots are client-driven and cannot be seated in an online game yet");
  }
  const parsed = parseClientPayload(rules.schemas.config, game.config, "config");
  if (!parsed.ok) throw new HttpError(500, "stored config failed its schema");
  if (!rules.botSeatable({ gameConfig: parsed.value as JsonObject, botConfig: bot.config })) {
    throw new HttpError(400, "Bot does not support this game configuration");
  }
}

async function loadGame(ctx: RouteContext, env: unknown, gameId: string): Promise<GameWithRoster> {
  const game = await readGame(ctx.d1(env), gameId);
  if (game === undefined) throw new HttpError(404, "Unknown game");
  return game;
}

// ── Short codes (§4.1: D1 UNIQUE + retry loop) ────────────────────────────────

/** No 0/O/1/I/L — these codes are read aloud and typed. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const CODE_ATTEMPTS = 5;

function generateShortCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function isShortCodeCollision(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed.*short_code/.test(error.message);
}

// ── Routes ────────────────────────────────────────────────────────────────────

export function registerGameRoutes(app: EngineApp, ctx: RouteContext): void {
  // §4.1 — the one worker-direct write. Policy ports verbatim from the
  // Supabase-era handleCreate: guest gates, config parse, ratingPool, and
  // the client's `rated` assertion (validated, never coerced).
  app.openapi(
    createRoute({
      method: "post",
      path: "/games",
      operationId: "createGame",
      request: { body: jsonBody(createGameBody) },
      responses: responses(createdShape, "The created game"),
    }),
    async (c) => {
      const auth = c.var.auth;
      const body = c.req.valid("json");
      // Guests cannot create friends-access games: guests can never have an
      // accepted friend, so the lobby would be permanently unjoinable.
      if (body.access === "friends" && auth.claims.isAnonymous) {
        throw new HttpError(403, "Friends-access games require a registered account");
      }
      const rules = rulesFor(ctx, body.schema_version);
      const parsed = parseClientPayload(rules.schemas.config, body.config, "config");
      if (!parsed.ok) throw new HttpError(400, parsed.message);
      const config = parsed.value as JsonObject;

      const pool = rules.ratingPool({
        access: body.access,
        turnSeconds: body.turn_seconds,
        budgetSeconds: body.budget_seconds,
        incrementSeconds: body.increment_seconds,
        minPlayers: body.min_players,
        maxPlayers: body.max_players,
        config,
      });
      // `rated` is a concrete assertion the client also computes (the Dart
      // twin) — a mismatch means twin drift or a forged client; reject it
      // rather than silently coercing. There is no forced-rated, so a sent
      // `false` is always valid.
      const canBeRated = pool !== null && !auth.claims.isAnonymous;
      if (!canBeRated && body.rated === true) {
        throw new HttpError(422, "rated mismatch: this game is not eligible to be rated");
      }
      const rated = canBeRated && (body.rated ?? true);

      const gameId = crypto.randomUUID();
      const seats: Seat[] = [{ player_index: 0, user_id: auth.user.id, bot_id: null, type: "human" }];
      const now = Date.now();
      for (let attempt = 1; ; attempt++) {
        const shortCode = generateShortCode();
        try {
          await createGame(ctx.d1(c.env), {
            gameId,
            createdBy: auth.user.id,
            status: seats.length >= body.min_players ? "ready" : "waiting",
            access: body.access,
            schemaVersion: body.schema_version,
            config,
            turnSeconds: body.turn_seconds,
            budgetSeconds: body.budget_seconds,
            incrementSeconds: body.increment_seconds,
            rated,
            ratingPool: pool,
            minPlayers: body.min_players,
            maxPlayers: body.max_players,
            shortCode,
            seats,
            now,
          });
          return c.json({ game_id: gameId, short_code: shortCode }, 200);
        } catch (error) {
          if (!isShortCodeCollision(error) || attempt === CODE_ATTEMPTS) throw error;
        }
      }
    },
  );

  // §7 create-solo — create a private game seated with the caller plus bots,
  // and start it, in one call. Guests may play bots (unrated); the same
  // create policy and bot-seating gates apply, then an immediate `start`.
  app.openapi(
    createRoute({
      method: "post",
      path: "/games/solo",
      operationId: "createSoloGame",
      request: { body: jsonBody(createSoloBody) },
      responses: responses(soloStartedShape, "The created-and-started solo game"),
    }),
    async (c) => {
      const auth = c.var.auth;
      const body = c.req.valid("json");
      const rules = rulesFor(ctx, body.schema_version);
      const parsedConfig = parseClientPayload(rules.schemas.config, body.config, "config");
      if (!parsedConfig.ok) throw new HttpError(400, parsedConfig.message);
      const config = parsedConfig.value as JsonObject;

      // Solo games are always private — no lobby, no invites.
      const pool = rules.ratingPool({
        access: "private",
        turnSeconds: body.turn_seconds,
        budgetSeconds: body.budget_seconds,
        incrementSeconds: body.increment_seconds,
        minPlayers: body.min_players,
        maxPlayers: body.max_players,
        config,
      });
      const canBeRated = pool !== null && !auth.claims.isAnonymous;
      if (!canBeRated && body.rated === true) {
        throw new HttpError(422, "rated mismatch: this game is not eligible to be rated");
      }
      const rated = canBeRated && (body.rated ?? true);

      // Resolve and gate every bot before writing anything: a bad bot id or a
      // failed seating gate must abort with nothing created.
      const bots = await readBots(ctx.d1(c.env), body.bot_ids);
      const spec: BotSeatingGame = { schemaVersion: body.schema_version, turnSeconds: body.turn_seconds, budgetSeconds: body.budget_seconds, rated, config };
      const seats: Seat[] = [{ player_index: 0, user_id: auth.user.id, bot_id: null, type: "human" }];
      for (const botId of body.bot_ids) {
        const bot = bots.find((b) => b.id === botId);
        if (bot === undefined) throw new HttpError(404, `Bot not found: ${botId}`);
        assertBotSeatable(ctx, spec, bot);
        seats.push({ player_index: seats.length, user_id: null, bot_id: bot.id, type: "bot" });
      }
      if (seats.length < body.min_players) throw new HttpError(400, "Not enough seats to start the game");
      if (seats.length > body.max_players) throw new HttpError(400, "More bots than max_players allows");

      const gameId = crypto.randomUUID();
      const now = Date.now();
      let shortCode = "";
      for (let attempt = 1; ; attempt++) {
        shortCode = generateShortCode();
        try {
          await createGame(ctx.d1(c.env), {
            gameId,
            createdBy: auth.user.id,
            status: "ready",
            access: "private",
            schemaVersion: body.schema_version,
            config,
            turnSeconds: body.turn_seconds,
            budgetSeconds: body.budget_seconds,
            incrementSeconds: body.increment_seconds,
            rated,
            ratingPool: pool,
            minPlayers: body.min_players,
            maxPlayers: body.max_players,
            shortCode,
            seats,
            now,
          });
          break;
        } catch (error) {
          if (!isShortCodeCollision(error) || attempt === CODE_ATTEMPTS) throw error;
        }
      }

      // Start immediately: the DO lazy-inits from D1 (bots included) and
      // commits v0; a bot due to open plays via its in-DO brain post-commit
      // (arriving over the socket). A start has no single acting seat, so its
      // response carries no frame — read the creator's opening projection back
      // so the client has the initial board without a round trip.
      const stub = ctx.stub(c.env, gameId);
      const started = commandResult(await stub.handle(mint(auth, "start", gameId, undefined)));
      const [frame] = await stub.frames({ seat: 0, from: started.version, to: started.version });
      return c.json({ game_id: gameId, short_code: shortCode, version: started.version, frame: frame ?? null }, 200);
    },
  );

  // §4.2 join — worker policy: guest-vs-rated, friends access, schema gate.
  const join = async (c: { env: unknown; var: { auth: Authed } }, game: GameWithRoster, clientSchemaVersion: number, commandId: string | undefined) => {
    const auth = c.var.auth;
    if (game.rated && auth.claims.isAnonymous) {
      throw new HttpError(403, "Guests cannot join rated games");
    }
    if (game.schemaVersion > clientSchemaVersion) {
      throw new HttpError(409, "This game requires a newer app version", "schema_unsupported");
    }
    if (game.access === "friends") {
      if (auth.claims.isAnonymous) throw new HttpError(403, "Friends-access games require a registered account");
      if (game.createdBy === null || !(await isAcceptedFriend(ctx.d1(c.env), auth.user.id, game.createdBy))) {
        throw new HttpError(403, "This game is limited to the creator's friends");
      }
    }
    return lobbyResult(await ctx.stub(c.env, game.id).handle(mint(c.var.auth, "join", game.id, commandId)));
  };

  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/join",
      operationId: "joinGame",
      request: { params: gameIdParam, body: jsonBody(joinBody) },
      responses: responses(lobbyAcceptedShape, "Seated — the post-join roster"),
    }),
    async (c) => {
      const body = c.req.valid("json");
      const game = await loadGame(ctx, c.env, c.req.valid("param").gameId);
      return c.json(await join(c, game, body.client_schema_version, body.command_id), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/games/join-by-code",
      operationId: "joinGameByCode",
      request: { body: jsonBody(joinByCodeBody) },
      responses: responses(lobbyAcceptedShape, "Seated — the post-join roster"),
    }),
    async (c) => {
      const body = c.req.valid("json");
      const game = await readGameByCode(ctx.d1(c.env), body.short_code.toUpperCase());
      if (game === undefined) throw new HttpError(404, "No game with that code");
      return c.json(await join(c, game, body.client_schema_version, body.command_id), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/leave",
      operationId: "leaveGame",
      request: { params: gameIdParam, body: jsonBody(lobbyCommandBody) },
      responses: responses(lobbyAcceptedShape, "Left — the post-leave roster"),
    }),
    async (c) => {
      const { gameId } = c.req.valid("param");
      const result = await ctx.stub(c.env, gameId).handle(mint(c.var.auth, "leave", gameId, c.req.valid("json").command_id));
      return c.json(lobbyResult(result), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/cancel",
      operationId: "cancelGame",
      request: { params: gameIdParam, body: jsonBody(lobbyCommandBody) },
      responses: responses(lobbyAcceptedShape, "Cancelled"),
    }),
    async (c) => {
      const { gameId } = c.req.valid("param");
      const result = await ctx.stub(c.env, gameId).handle(mint(c.var.auth, "cancel", gameId, c.req.valid("json").command_id));
      return c.json(lobbyResult(result), 200);
    },
  );

  // §4.2 add-bot — worker policy: registry gates (schema, rated eligibility,
  // timed invariant, brain-or-webhook) and botSeatable. Guests may add bots
  // (unrated only, enforced at create/join); the timed invariant and rated
  // gate are shared with create-solo via `assertBotSeatable`.
  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/add-bot",
      operationId: "addBot",
      request: { params: gameIdParam, body: jsonBody(addBotBody) },
      responses: responses(lobbyAcceptedShape, "Bot seated — the new roster"),
    }),
    async (c) => {
      const auth = c.var.auth;
      const body = c.req.valid("json");
      const { gameId } = c.req.valid("param");
      const [game, bots] = await Promise.all([loadGame(ctx, c.env, gameId), readBots(ctx.d1(c.env), [body.bot_id])]);
      const bot = bots[0];
      if (bot === undefined) throw new HttpError(404, "Bot not found");
      assertBotSeatable(ctx, game, bot);
      const cmd: Command = { kind: "add-bot", gameId, commandId: body.command_id ?? crypto.randomUUID(), actor: { userId: auth.user.id, botId: null }, botId: bot.id };
      return c.json(lobbyResult(await ctx.stub(c.env, gameId).handle(cmd)), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/start",
      operationId: "startGame",
      request: { params: gameIdParam, body: jsonBody(lobbyCommandBody) },
      responses: responses(commandAcceptedShape, "Started — version 0 committed"),
    }),
    async (c) => {
      const { gameId } = c.req.valid("param");
      const result = await ctx.stub(c.env, gameId).handle(mint(c.var.auth, "start", gameId, c.req.valid("json").command_id));
      return c.json(commandResult(result), 200);
    },
  );

  // §4.3 — a player's move. The client sends its own seat (uniform with bots);
  // the DO verifies it belongs to the caller against its own roster (the
  // authoritative copy — the D1 participants mirror only displays) and the
  // caller's committed frame rides the response. No D1 read on this path.
  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/action",
      operationId: "submitAction",
      request: { params: gameIdParam, body: jsonBody(actionBody) },
      responses: responses(commandAcceptedShape, "Committed — the acting seat's frame"),
    }),
    async (c) => {
      const body = c.req.valid("json");
      const { gameId } = c.req.valid("param");
      const cmd: Command = {
        kind: "action",
        gameId,
        commandId: body.command_id ?? crypto.randomUUID(),
        actor: { userId: c.var.auth.user.id, botId: null },
        seat: body.seat,
        expectedVersion: body.expected_version,
        data: body.data,
      };
      return c.json(commandResult(await ctx.stub(c.env, gameId).handle(cmd)), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/forfeit",
      operationId: "forfeitGame",
      request: { params: gameIdParam, body: jsonBody(forfeitBody) },
      responses: responses(commandAcceptedShape, "Forfeit committed"),
    }),
    async (c) => {
      const body = c.req.valid("json");
      const { gameId } = c.req.valid("param");
      const cmd: Command = {
        kind: "lifecycle",
        gameId,
        commandId: body.command_id ?? crypto.randomUUID(),
        actor: { userId: c.var.auth.user.id, botId: null },
        type: "forfeit",
        seat: body.seat,
      };
      return c.json(commandResult(await ctx.stub(c.env, gameId).handle(cmd)), 200);
    },
  );

  // §4.6 — the range fetch: live gap recovery AND finished-game replay, one
  // path. Participants read their own seat; a finished PUBLIC game is
  // replayable by anyone as the null-seat viewer projection.
  app.openapi(
    createRoute({
      method: "get",
      path: "/games/{gameId}/frames",
      operationId: "getFrames",
      request: {
        params: gameIdParam,
        query: z.object({
          from: z.coerce.number().int().min(0).default(0),
          to: z.coerce.number().int().min(0).optional(),
        }),
      },
      responses: responses(z.object({ frames: z.array(frameShape) }).openapi("Frames"), "The projected frames, version-ascending"),
    }),
    async (c) => {
      const auth = c.var.auth;
      const { gameId } = c.req.valid("param");
      const { from, to } = c.req.valid("query");
      const game = await loadGame(ctx, c.env, gameId);
      const mySeat = game.participants.find((s) => s.user_id === auth.user.id)?.player_index ?? null;
      const finished = game.status === "finished";
      if (mySeat === null && !(finished && game.access === "public")) {
        throw new HttpError(403, "Not a participant in this game", "not_participant");
      }
      const page = 1000;
      const cappedTo = Math.min(to ?? from + page - 1, from + page - 1);
      const frames = await ctx.stub(c.env, gameId).frames({ seat: mySeat, from, to: cappedTo, isReplay: finished });
      return c.json({ frames }, 200);
    },
  );

  // The WebSocket (§4.2/§4.3) — one socket for the game's whole lifetime.
  // Not an OpenAPI route (documents can't describe the upgrade); auth rides
  // the `?token=` query. The worker stamps the principal header itself —
  // inbound x-eigen-* headers are dropped wholesale.
  app.get("/games/:gameId/socket", async (c) => {
    if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
      throw new HttpError(400, "Expected a WebSocket upgrade");
    }
    const gameId = c.req.param("gameId");
    await loadGame(ctx, c.env, gameId); // 404 without waking a DO for garbage ids
    const headers = new Headers();
    for (const [key, value] of c.req.raw.headers) {
      if (!key.toLowerCase().startsWith("x-eigen-")) headers.set(key, value);
    }
    headers.set("x-eigen-game", gameId);
    headers.set("x-eigen-user", c.var.auth.user.id);
    return await ctx.stub(c.env, gameId).fetch(new Request(c.req.raw.url, { headers }));
  });
}

function mint(auth: Authed, kind: "join" | "leave" | "cancel" | "start", gameId: string, commandId: string | undefined): Command {
  const base = { gameId, commandId: commandId ?? crypto.randomUUID(), actor: { userId: auth.user.id, botId: null } };
  switch (kind) {
    case "start":
      return { kind, ...base };
    case "cancel":
      return { kind, ...base };
    default:
      return { kind, ...base };
  }
}
