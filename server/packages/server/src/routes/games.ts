/**
 * The game lifecycle routes: the worker-direct
 * create, the waiting-room commands (worker policy BEFORE minting; the
 * DO enforces integrity under its gate), active-play action/forfeit, the
 * range fetch, and the WebSocket upgrade.
 */

import { parseClientPayload, type Seat } from "@eigeninteractive/kernel";
import type { GameRules, JsonObject, PlayerLimits } from "@eigeninteractive/rules";
import { createRoute, z } from "@hono/zod-openapi";
import { canonicalRequest, userPrincipal } from "../command-request.js";
import { type CreateGameInput, type CreateReceipt, createGame, readCreatedGame } from "../d1/apply.js";
import { isBlockedAmong } from "../d1/blocks.js";
import { isCreateReplay, isShortCodeCollision } from "../d1/errors.js";
import { type BotRow, type GameWithRoster, isAcceptedFriend, readBots, readGame, readGameByCode } from "../d1/reads.js";
import { acceptedFriendIds } from "../d1/social.js";
import type { Authed, EngineApp, RouteContext } from "../engine.js";
import { HttpError, unwrap } from "../http.js";
import { gameInvitePush } from "../notify/push.js";
import type { Command, CommandResult } from "../protocol.js";
import { enforceRateLimit } from "../rate-limit.js";
import { versionQuery } from "./query.js";
import { actionBody, addBotBody, commandAcceptedShape, createdShape, createGameBody, createSoloBody, errorShape, forfeitBody, frameShape, IDEMPOTENCY_KEY_HEADER, idempotencyKeyHeader, joinBody, joinByCodeBody, soloStartedShape } from "./wire.js";

// ── Route plumbing ────────────────────────────────────────────────────────────

function jsonBody<T extends z.ZodType>(schema: T) {
  return { content: { "application/json": { schema } }, required: true } as const;
}

const error = (what: string) => ({ content: { "application/json": { schema: errorShape } }, description: what });
const errorResponses = {
  400: error("Invalid request"),
  401: error("Missing or invalid token"),
  403: error("Not allowed"),
  404: error("Not found"),
  409: error("Stale view; resync and retry"),
  422: error("Assertion mismatch, or an Idempotency-Key reused for a different request"),
} as const;

/** A mutation: the caller's `Idempotency-Key` is part of its request contract.
 * Every non-idempotent route carries this, so a client never has to know which
 * mutations honour a retry. */
function mutation<R extends { params?: z.ZodType; body?: unknown }>(request: R) {
  return { ...request, headers: idempotencyKeyHeader } as const;
}

/** A 200 OK carrying `schema`, plus the shared error responses. */
function responses<T extends z.ZodType>(schema: T, description: string) {
  return { 200: { content: { "application/json": { schema } }, description }, ...errorResponses } as const;
}

/** A 201 Created carrying `schema`, for the endpoints that create a resource. */
function createdResponses<T extends z.ZodType>(schema: T, description: string) {
  return { 201: { content: { "application/json": { schema } }, description }, ...errorResponses } as const;
}

const gameIdParam = z.object({ gameId: z.string().min(1) });

/** The caller's idempotency key, validated by the route's header schema. Named
 * `commandId` from here inward: the header is the transport, the command id is
 * what the engine stores it as. */
function commandId(c: { req: { valid: (target: "header") => Record<string, string> } }): string {
  return c.req.valid("header")[IDEMPOTENCY_KEY_HEADER] as string;
}

/** Strip the internal `ok` discriminator from an accepted result; success is the
 * HTTP 200, not a body field. One helper for every command kind, because they
 * all answer with the caller's session now. */
function commandResult(result: CommandResult) {
  return { session: unwrap(result).session };
}

function rulesFor(ctx: RouteContext, schemaVersion: number): GameRules {
  const rules = ctx.gameModule.versions[schemaVersion];
  if (rules === undefined) throw new HttpError(400, `This deployment ships no rules for schemaVersion ${schemaVersion}`);
  return rules;
}

/**
 * The creation gate: what a NEW game runs is the deployment's choice, not the
 * caller's.
 *
 * The body's `schemaVersion` says which rules shaped its `config`, so it must be
 * one the deployment still creates at. Refusing a mismatch rather than coercing
 * it is what makes a staged rollout safe in both directions: a client ahead of
 * the server cannot create a version the server has not enabled, and a client
 * behind it stops creating a version the operator has retired. Coercing would
 * silently pair a config built for one version with another version's rules.
 */
function assertCreatable(ctx: RouteContext, asserted: number): void {
  if (ctx.creatableSchemaVersions.includes(asserted)) return;
  throw new HttpError(409, `This server creates schemaVersion [${ctx.creatableSchemaVersions.join(", ")}] games; this app build asked for ${asserted}. Read GET /capabilities.`, "schemaUnsupported");
}

/**
 * Resolve the seat range a create actually gets.
 *
 * The rules own what is playable: `playerLimits` reads the parsed config and
 * returns the bounds this version can index seats within. The caller may narrow
 * that range for one lobby and may omit it entirely, but a range reaching outside
 * it is refused rather than clamped — a game seated past what its rules can
 * address does not become a bigger game, it becomes a corrupt one, and silently
 * shrinking the caller's request would open a lobby that never fills as asked.
 *
 * Refusing is a 422 for the same reason a `rated` mismatch is: the Dart
 * `playersForConfig` twin computes this too, so a disagreement is twin drift or a
 * forged client, and neither is a state to write a game from.
 */
function resolveSeats(rules: GameRules, config: JsonObject, asserted: { minPlayers?: number; maxPlayers?: number }): PlayerLimits {
  const limits = rules.playerLimits({ config });
  if (!Number.isSafeInteger(limits.minPlayers) || !Number.isSafeInteger(limits.maxPlayers) || limits.minPlayers < 1 || limits.maxPlayers < limits.minPlayers) {
    throw new HttpError(500, `game bug: playerLimits returned ${JSON.stringify(limits)}`);
  }
  const minPlayers = asserted.minPlayers ?? limits.minPlayers;
  const maxPlayers = asserted.maxPlayers ?? limits.maxPlayers;
  if (minPlayers < limits.minPlayers || maxPlayers > limits.maxPlayers) {
    throw new HttpError(422, `seat mismatch: this game supports ${limits.minPlayers}-${limits.maxPlayers} players; asked for ${minPlayers}-${maxPlayers}`);
  }
  return { minPlayers, maxPlayers };
}

/** The bot-seating gates, shared by `add-bot` and create-solo. `game` is
 * anything with the game's timing/rated/schema/config: a stored row or a
 * to-be-created spec. Throws an `HttpError` on any failed gate. */
interface BotSeatingGame {
  schemaVersion: number;
  turnSeconds: number | null;
  budgetSeconds: number | null;
  rated: boolean;
  config: JsonObject;
}

function assertBotSeatable(ctx: RouteContext, game: BotSeatingGame, bot: BotRow): void {
  // SERVER-seated bots ⇒ timed. Dispatch is single-attempt, so a brain that
  // throws, an external webhook that never answers, or a DO evicted mid-turn is
  // resolved only by the turn deadline firing the alarm, the one liveness
  // backstop. Untimed means no deadline, no alarm, and a game wedged forever.
  //
  // Scoped to *server* seating on purpose: a client-driven bot has no dispatch
  // to fail and needs no backstop, so the deferred offline-solo path (a game
  // simulated on-device and uploaded as a transcript) is free to be untimed.
  // That partition is why this lives here, on the seating path, rather than as
  // a blanket rule on game creation.
  if (game.turnSeconds === null && game.budgetSeconds === null) {
    throw new HttpError(400, "A game with a server-seated bot must be timed");
  }
  if (game.schemaVersion > bot.schemaVersion) {
    throw new HttpError(400, `Bot does not support schemaVersion ${game.schemaVersion}`);
  }
  if (game.rated && !bot.ratedEligible) {
    throw new HttpError(400, "This bot is not eligible for rated games");
  }
  const rules = rulesFor(ctx, game.schemaVersion);
  // Dispatch discriminator: an `engine` bot needs a `botActions` entry
  // for its username in this version; an `external` bot needs a webhook (the
  // DB CHECK guarantees it, so this only guards a genuinely broken row); a
  // `local` bot is client-driven and not seatable online until transcript
  // import exists. A bot that can't take its turn is refused here.
  switch (bot.type) {
    case "engine":
      if (rules.botActions?.[bot.username] === undefined) {
        throw new HttpError(400, `The game ships no bot brain named '${bot.username}' for schemaVersion ${game.schemaVersion}`);
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
  if (game === undefined) throw new HttpError(404, "Unknown game", "unknownGame");
  return game;
}

// ── Short codes (D1 UNIQUE + retry loop) ────────────────────────────────

/** No 0/O/1/I/L, because these codes are read aloud and typed. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const CODE_ATTEMPTS = 5;

function generateShortCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

// ── Create receipts ───────────────────────────────────────────────────────────

/** What a create produced, whether it ran now or had already run. */
interface CreatedGame {
  gameId: string;
  shortCode: string;
  /** True when this request re-presented a command id already committed. Every
   * once-only side effect a create performs is gated on this being false. */
  replayed: boolean;
}

/**
 * The create-side receipt check, and the shortCode retry loop it shares with.
 *
 * Both create routes go through here so a duplicate create is impossible in one
 * place rather than two. `input.gameId` is the freshly minted id, used only if
 * this create is genuinely new: a replay answers with the id the first attempt
 * committed, so a caller that retries because it never saw the response gets the
 * game it already made instead of a second one.
 */
async function createOnce(d1: D1Database, createdBy: string, receipt: CreateReceipt, input: Omit<CreateGameInput, "receipt" | "shortCode">): Promise<CreatedGame> {
  for (let attempt = 1; ; attempt++) {
    const shortCode = generateShortCode();
    try {
      await createGame(d1, { ...input, receipt, shortCode });
      return { gameId: input.gameId, shortCode, replayed: false };
    } catch (error) {
      if (isCreateReplay(error)) return await replayCreate(d1, createdBy, receipt);
      if (!isShortCodeCollision(error) || attempt === CODE_ATTEMPTS) throw error;
    }
  }
}

/** Answer a create whose command id is already committed. */
async function replayCreate(d1: D1Database, createdBy: string, receipt: CreateReceipt): Promise<CreatedGame> {
  const stored = await readCreatedGame(d1, createdBy, receipt.commandId);
  // The insert that just failed proves the row exists, and a game row is never
  // deleted (a purge anonymizes it, a reap aborts it). Reaching here means one of
  // those two invariants broke.
  if (stored === undefined) throw new HttpError(500, "engine bug: a committed create has no game");
  if (stored.request !== receipt.request) {
    throw new HttpError(422, "This command id is already committed with different intent", "commandConflict");
  }
  return { gameId: stored.gameId, shortCode: stored.shortCode, replayed: true };
}

/** The canonical intent of a create, compared to refuse one key standing for two
 * different games. `resource` is the collection D1 is authoritative for, the
 * create-time counterpart of a DO passing its own game id. Payload fields are the
 * request as SENT, never a server-derived value: two byte-identical retries must
 * fingerprint identically even across a redeploy that moved a derived bound. */
function createReceipt(userId: string, commandId: string, operation: "game.create" | "game.create-solo", payload: unknown): CreateReceipt {
  return { commandId, request: canonicalRequest({ principal: userPrincipal(userId), operation, resource: "games", payload }) };
}

// ── Routes ────────────────────────────────────────────────────────────────────

export function registerGameRoutes(app: EngineApp, ctx: RouteContext): void {
  // Create: the one worker-direct write, and the only place game policy is
  // decided outside a DO: guest gates, config parse, ratingPool, and the
  // client's `rated` assertion (validated, never coerced).
  app.openapi(
    createRoute({
      method: "post",
      path: "/games",
      operationId: "createGame",
      tags: ["Games"],
      request: mutation({ body: jsonBody(createGameBody) }),
      responses: createdResponses(createdShape, "The created game"),
    }),
    async (c) => {
      const auth = c.var.auth;
      await enforceRateLimit(c.env, "game_create", auth.user.id);
      const body = c.req.valid("json");
      // Guests cannot create friends-access games: guests can never have an
      // accepted friend, so the lobby would be permanently unjoinable.
      if (body.access === "friends" && auth.claims.isAnonymous) {
        throw new HttpError(403, "Friends-access games require a registered account", "registrationRequired");
      }
      assertCreatable(ctx, body.schemaVersion);
      const rules = rulesFor(ctx, body.schemaVersion);
      const parsed = parseClientPayload(rules.schemas.config, body.config, "config");
      if (!parsed.ok) throw new HttpError(400, parsed.message);
      const config = parsed.value as JsonObject;
      const { minPlayers, maxPlayers } = resolveSeats(rules, config, body);

      const pool = rules.ratingPool({
        access: body.access,
        turnSeconds: body.turnSeconds,
        budgetSeconds: body.budgetSeconds,
        incrementSeconds: body.incrementSeconds,
        minPlayers,
        maxPlayers,
        config,
      });
      // `rated` is a concrete assertion the client also computes (the Dart
      // twin). A mismatch means twin drift or a forged client; reject it
      // rather than silently coercing. There is no forced-rated, so a sent
      // `false` is always valid.
      const canBeRated = pool !== null && !auth.claims.isAnonymous;
      if (!canBeRated && body.rated === true) {
        throw new HttpError(422, "rated mismatch: this game is not eligible to be rated");
      }
      const rated = canBeRated && (body.rated ?? true);

      const seats: Seat[] = [{ playerIndex: 0, userId: auth.user.id, botId: null, type: "human" }];
      const created = await createOnce(
        ctx.d1(c.env),
        auth.user.id,
        createReceipt(auth.user.id, commandId(c), "game.create", {
          access: body.access,
          schemaVersion: body.schemaVersion,
          config,
          turnSeconds: body.turnSeconds,
          budgetSeconds: body.budgetSeconds,
          incrementSeconds: body.incrementSeconds,
          rated: body.rated ?? null,
          minPlayers: body.minPlayers ?? null,
          maxPlayers: body.maxPlayers ?? null,
        }),
        {
          gameId: crypto.randomUUID(),
          createdBy: auth.user.id,
          status: seats.length >= minPlayers ? "ready" : "waiting",
          access: body.access,
          schemaVersion: body.schemaVersion,
          config,
          turnSeconds: body.turnSeconds,
          budgetSeconds: body.budgetSeconds,
          incrementSeconds: body.incrementSeconds,
          rated,
          ratingPool: pool,
          minPlayers,
          maxPlayers,
          seats,
          now: Date.now(),
        },
      );
      // Friends-access game: fan out an invite push to the creator's
      // accepted friends. Best-effort and off the response path: a friend
      // with notifications off (or none at all) costs nothing, and a push
      // failure never affects the create. Skipped on a replay: the first
      // attempt already invited everyone, and a caller retrying a lost
      // response must not re-notify their whole friend list.
      if (body.access === "friends" && !created.replayed) {
        const d1 = ctx.d1(c.env);
        const admin = ctx.firebaseAdmin(c.env);
        c.executionCtx.waitUntil(acceptedFriendIds(d1, auth.user.id).then((ids) => Promise.all(ids.map((id) => admin.notifyUser(d1, id, gameInvitePush(auth.user.displayName, created.gameId))))));
      }
      return c.json({ gameId: created.gameId, shortCode: created.shortCode }, 201);
    },
  );

  // create-solo: create a private game seated with the caller plus bots,
  // and start it, in one call. Guests may play bots (unrated); the same
  // create policy and bot-seating gates apply, then an immediate `start`.
  app.openapi(
    createRoute({
      method: "post",
      path: "/games/solo",
      operationId: "createSoloGame",
      tags: ["Games"],
      request: mutation({ body: jsonBody(createSoloBody) }),
      responses: createdResponses(soloStartedShape, "The created-and-started solo game"),
    }),
    async (c) => {
      const auth = c.var.auth;
      await enforceRateLimit(c.env, "game_create", auth.user.id);
      const body = c.req.valid("json");
      assertCreatable(ctx, body.schemaVersion);
      const rules = rulesFor(ctx, body.schemaVersion);
      const parsedConfig = parseClientPayload(rules.schemas.config, body.config, "config");
      if (!parsedConfig.ok) throw new HttpError(400, parsedConfig.message);
      const config = parsedConfig.value as JsonObject;
      const { minPlayers, maxPlayers } = resolveSeats(rules, config, body);

      // Solo games are always private: no lobby, no invites.
      const pool = rules.ratingPool({
        access: "private",
        turnSeconds: body.turnSeconds,
        budgetSeconds: body.budgetSeconds,
        incrementSeconds: body.incrementSeconds,
        minPlayers,
        maxPlayers,
        config,
      });
      const canBeRated = pool !== null && !auth.claims.isAnonymous;
      if (!canBeRated && body.rated === true) {
        throw new HttpError(422, "rated mismatch: this game is not eligible to be rated");
      }
      const rated = canBeRated && (body.rated ?? true);

      // Resolve and gate every bot before writing anything: a bad bot id or a
      // failed seating gate must abort with nothing created.
      const bots = await readBots(ctx.d1(c.env), body.botIds);
      const spec: BotSeatingGame = { schemaVersion: body.schemaVersion, turnSeconds: body.turnSeconds, budgetSeconds: body.budgetSeconds, rated, config };
      const seats: Seat[] = [{ playerIndex: 0, userId: auth.user.id, botId: null, type: "human" }];
      for (const botId of body.botIds) {
        const bot = bots.find((b) => b.id === botId);
        if (bot === undefined) throw new HttpError(404, `Bot not found: ${botId}`);
        assertBotSeatable(ctx, spec, bot);
        seats.push({ playerIndex: seats.length, userId: null, botId: bot.id, type: "bot" });
      }
      if (seats.length < minPlayers) throw new HttpError(400, "Not enough seats to start the game");
      if (seats.length > maxPlayers) throw new HttpError(400, "More bots than maxPlayers allows");

      const key = commandId(c);
      const created = await createOnce(
        ctx.d1(c.env),
        auth.user.id,
        createReceipt(auth.user.id, key, "game.create-solo", {
          schemaVersion: body.schemaVersion,
          config,
          turnSeconds: body.turnSeconds,
          budgetSeconds: body.budgetSeconds,
          incrementSeconds: body.incrementSeconds,
          rated: body.rated ?? null,
          minPlayers: body.minPlayers ?? null,
          maxPlayers: body.maxPlayers ?? null,
          botIds: body.botIds,
        }),
        {
          gameId: crypto.randomUUID(),
          createdBy: auth.user.id,
          status: "ready",
          access: "private",
          schemaVersion: body.schemaVersion,
          config,
          turnSeconds: body.turnSeconds,
          budgetSeconds: body.budgetSeconds,
          incrementSeconds: body.incrementSeconds,
          rated,
          ratingPool: pool,
          minPlayers,
          maxPlayers,
          seats,
          now: Date.now(),
        },
      );

      // Start immediately: the DO lazy-inits from D1 (bots included) and
      // commits v0; a bot due to open plays via its in-DO brain post-commit
      // (arriving over the socket). A start has no single acting seat, so the
      // committed response carries no frame; read the creator's session back so
      // the client has the opening board without a round trip. The game is
      // already running before any socket exists, so this is its only delivery.
      const stub = ctx.stub(c.env, created.gameId);
      // The start's own id, DERIVED from the caller's key rather than reused as
      // it or minted fresh. Reusing the key would let one id stand for two
      // operations, which the receipt design refuses; minting a fresh one would
      // make this half unreplayable, so a retry would start a game that is
      // already running. A derived id is a distinct id that is also
      // reproducible, which is what makes create-solo idempotent as a whole:
      // the DO replays its committed start, and a create whose process died
      // before this line ran is resumed here rather than left unstarted.
      unwrap(await stub.handle(mint(auth, "start", created.gameId, `${key}:start`)));
      const session = await stub.session(created.gameId, auth.user.id);
      if (session === null) throw new HttpError(500, "engine bug: started game has no session");
      return c.json({ session }, 201);
    },
  );

  // join: worker policy is guest-vs-rated, friends access, schema gate.
  const join = async (c: { env: unknown; var: { auth: Authed } }, game: GameWithRoster, clientSchemaVersions: number[], key: string) => {
    const auth = c.var.auth;
    if (game.rated && auth.claims.isAnonymous) {
      throw new HttpError(403, "Guests cannot join rated games", "registrationRequired");
    }
    // Exact membership, not `game.schemaVersion <= clientMaximum`. Client support
    // is sparse — a build may ship {1, 3} once v2 has drained — so a maximum
    // cannot express it, and comparing against one seats a {1, 3} client into a
    // v2 game whose frames it cannot decode. Checked before seating, so a refusal
    // leaves no participant row behind.
    if (!clientSchemaVersions.includes(game.schemaVersion)) {
      throw new HttpError(409, `This app build does not support this game's version (${game.schemaVersion})`, "schemaUnsupported");
    }
    if (game.access === "friends") {
      if (auth.claims.isAnonymous) throw new HttpError(403, "Friends-access games require a registered account", "registrationRequired");
      if (game.createdBy === null || !(await isAcceptedFriend(ctx.d1(c.env), auth.user.id, game.createdBy))) {
        throw new HttpError(403, "This game is limited to the creator's friends", "friendsOnly");
      }
    }
    // The seating boundary: the caller and anyone they have blocked (either
    // direction) must never share a game. Answered as `unknownGame`, not a
    // "blocked" code, because the lobby already hides this game from the pair, so a
    // direct attempt (a shared code, a deep link) sees the same "no such game"
    // a genuine miss would, leaking nothing and needing no new wire code.
    const seatedUserIds = game.participants.flatMap((p) => (p.userId !== null ? [p.userId] : []));
    if (await isBlockedAmong(ctx.d1(c.env), auth.user.id, seatedUserIds)) {
      throw new HttpError(404, "Unknown game", "unknownGame");
    }
    return commandResult(await ctx.stub(c.env, game.id).handle(mint(c.var.auth, "join", game.id, key)));
  };

  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/join",
      operationId: "joinGame",
      tags: ["Games"],
      request: mutation({ params: gameIdParam, body: jsonBody(joinBody) }),
      responses: responses(commandAcceptedShape, "Seated: the post-join session"),
    }),
    async (c) => {
      const body = c.req.valid("json");
      const game = await loadGame(ctx, c.env, c.req.valid("param").gameId);
      const seated = await join(c, game, body.clientSchemaVersions, commandId(c));
      return c.json(seated, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/games/join-by-code",
      operationId: "joinGameByCode",
      tags: ["Games"],
      request: mutation({ body: jsonBody(joinByCodeBody) }),
      responses: responses(commandAcceptedShape, "Seated: the post-join session"),
    }),
    async (c) => {
      const body = c.req.valid("json");
      const game = await readGameByCode(ctx.d1(c.env), body.shortCode.toUpperCase());
      if (game === undefined) throw new HttpError(404, "No game with that code", "unknownGame");
      const seated = await join(c, game, body.clientSchemaVersions, commandId(c));
      return c.json(seated, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/leave",
      operationId: "leaveGame",
      tags: ["Games"],
      request: mutation({ params: gameIdParam }),
      responses: responses(commandAcceptedShape, "Left: the post-leave session"),
    }),
    async (c) => {
      const { gameId } = c.req.valid("param");
      const result = await ctx.stub(c.env, gameId).handle(mint(c.var.auth, "leave", gameId, commandId(c)));
      return c.json(commandResult(result), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/cancel",
      operationId: "cancelGame",
      tags: ["Games"],
      request: mutation({ params: gameIdParam }),
      responses: responses(commandAcceptedShape, "Cancelled"),
    }),
    async (c) => {
      const { gameId } = c.req.valid("param");
      const result = await ctx.stub(c.env, gameId).handle(mint(c.var.auth, "cancel", gameId, commandId(c)));
      return c.json(commandResult(result), 200);
    },
  );

  // add-bot: worker policy is the registry gates (schema, rated eligibility,
  // timed invariant, brain-or-webhook) and botSeatable. Guests may add bots
  // (unrated only, enforced at create/join); the timed invariant and rated
  // gate are shared with create-solo via `assertBotSeatable`.
  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/add-bot",
      operationId: "addBot",
      tags: ["Games"],
      request: mutation({ params: gameIdParam, body: jsonBody(addBotBody) }),
      responses: responses(commandAcceptedShape, "Bot seated: the post-commit session"),
    }),
    async (c) => {
      const auth = c.var.auth;
      const body = c.req.valid("json");
      const { gameId } = c.req.valid("param");
      const [game, bots] = await Promise.all([loadGame(ctx, c.env, gameId), readBots(ctx.d1(c.env), [body.botId])]);
      const bot = bots[0];
      if (bot === undefined) throw new HttpError(404, "Bot not found");
      assertBotSeatable(ctx, game, bot);
      const cmd: Command = { kind: "add-bot", gameId, commandId: commandId(c), actor: { userId: auth.user.id, botId: null }, botId: bot.id };
      return c.json(commandResult(await ctx.stub(c.env, gameId).handle(cmd)), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/start",
      operationId: "startGame",
      tags: ["Games"],
      request: mutation({ params: gameIdParam }),
      responses: responses(commandAcceptedShape, "Started: the session at version 0"),
    }),
    async (c) => {
      const { gameId } = c.req.valid("param");
      const result = await ctx.stub(c.env, gameId).handle(mint(c.var.auth, "start", gameId, commandId(c)));
      return c.json(commandResult(result), 200);
    },
  );

  // Act: a player's move. The client sends its own seat (uniform with bots);
  // the DO verifies it belongs to the caller against its own roster (the
  // authoritative copy, since the D1 participants mirror only displays) and the
  // caller's committed frame rides the response. No D1 read on this path.
  app.openapi(
    createRoute({
      method: "post",
      path: "/games/{gameId}/action",
      operationId: "submitAction",
      tags: ["Games"],
      request: mutation({ params: gameIdParam, body: jsonBody(actionBody) }),
      responses: responses(commandAcceptedShape, "Committed: the acting seat's session"),
    }),
    async (c) => {
      const body = c.req.valid("json");
      const { gameId } = c.req.valid("param");
      const cmd: Command = {
        kind: "action",
        gameId,
        commandId: commandId(c),
        actor: { userId: c.var.auth.user.id, botId: null },
        seat: body.seat,
        expectedVersion: body.expectedVersion,
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
      tags: ["Games"],
      request: mutation({ params: gameIdParam, body: jsonBody(forfeitBody) }),
      responses: responses(commandAcceptedShape, "Forfeit committed"),
    }),
    async (c) => {
      const body = c.req.valid("json");
      const { gameId } = c.req.valid("param");
      const cmd: Command = {
        kind: "lifecycle",
        gameId,
        commandId: commandId(c),
        actor: { userId: c.var.auth.user.id, botId: null },
        type: "forfeit",
        seat: body.seat,
      };
      return c.json(commandResult(await ctx.stub(c.env, gameId).handle(cmd)), 200);
    },
  );

  // Transitions, the range fetch: live gap recovery AND finished-game replay, one
  // path. Participants read their own seat; a finished PUBLIC game is
  // replayable by anyone as the null-seat viewer projection.
  app.openapi(
    createRoute({
      method: "get",
      path: "/games/{gameId}/frames",
      operationId: "getFrames",
      tags: ["Games"],
      request: {
        params: gameIdParam,
        query: z.object({
          from: versionQuery.default(0).openapi({ type: "integer", minimum: 0, default: 0 }),
          to: versionQuery.optional(),
        }),
      },
      responses: responses(z.object({ frames: z.array(frameShape) }).openapi("Frames"), "The projected frames, version-ascending"),
    }),
    async (c) => {
      const auth = c.var.auth;
      const { gameId } = c.req.valid("param");
      const { from, to } = c.req.valid("query");
      const game = await loadGame(ctx, c.env, gameId);
      const mySeat = game.participants.find((s) => s.userId === auth.user.id)?.playerIndex ?? null;
      const finished = game.status === "finished";
      if (mySeat === null && !(finished && game.access === "public")) {
        throw new HttpError(403, "Not a participant in this game", "notParticipant");
      }
      const page = 1000;
      const cappedTo = Math.min(to ?? from + page - 1, from + page - 1);
      // Finished games replay through the HistoryStore seam: DO-backed
      // in v1, R2-backed later; live gap recovery stays a direct DO fetch.
      const frames = finished ? await ctx.history(c.env).replay(gameId, { seat: mySeat, from, to: cappedTo }) : await ctx.stub(c.env, gameId).frames({ seat: mySeat, from, to: cappedTo, isReplay: false });
      return c.json({ frames }, 200);
    },
  );

  // The WebSocket: one socket for the game's whole lifetime.
  // Not an OpenAPI route (documents can't describe the upgrade); auth rides
  // the `?token=` query. The worker stamps the principal header itself;
  // inbound x-eigen-* headers are dropped wholesale.
  app.get("/games/:gameId/socket", async (c) => {
    if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
      throw new HttpError(400, "Expected a WebSocket upgrade");
    }
    // Browsers always send Origin on a WebSocket handshake. It is not covered
    // by CORS, so enforce the same exact-origin policy here. Native clients
    // normally omit Origin and continue to authenticate solely with Firebase.
    const origin = c.req.header("origin");
    if (origin !== undefined && origin !== new URL(c.req.url).origin && !ctx.clientOrigins(c.env).includes(origin)) {
      throw new HttpError(403, "Browser origin is not allowed");
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

function mint(auth: Authed, kind: "join" | "leave" | "cancel" | "start", gameId: string, commandId: string): Command {
  const base = { gameId, commandId, actor: { userId: auth.user.id, botId: null } };
  switch (kind) {
    case "start":
      return { kind, ...base };
    case "cancel":
      return { kind, ...base };
    default:
      return { kind, ...base };
  }
}
