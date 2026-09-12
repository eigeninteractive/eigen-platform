/**
 * The wire vocabulary: zod schemas for every request and response body, and
 * the D1-row → wire projections. camelCase on the wire throughout, matching
 * the engine's TypeScript and the client's Dart; the D1 columns stay
 * snake_case behind the ORM (`casing: "snake_case"`). The OpenAPI document is
 * generated from exactly these schemas and vendored into the Dart repo.
 *
 * Leak-test discipline: no projection here ever touches a state field. Raw
 * state never leaves the DO, and the games row carries none. The projections
 * are an explicit field whitelist: they list every key that reaches the wire
 * and so deliberately omit internal row columns like `rngSeed`, which is why
 * they stay spelled out even now that property and wire names line up 1:1.
 */

import type { JsonObject } from "@eigeninteractive/rules";
import { z } from "@hono/zod-openapi";
import type { UserRow } from "../auth/provision.js";
import type { BotRow, GameWithRoster } from "../d1/reads.js";
import type { BotType } from "../d1/schema.js";
import type { ErrorCode } from "../http.js";
import type { GameOrigin } from "../protocol.js";

/** A game-defined JSON object payload (an observation's `data`, a config).
 * Typed as the engine's `JsonObject` so the wire types line up with the
 * protocol types exactly; documented as a free-form object. */
const jsonObjectShape = z.custom<JsonObject>((v) => typeof v === "object" && v !== null && !Array.isArray(v)).openapi({ type: "object" });

// ── Shared shapes ─────────────────────────────────────────────────────────────

/**
 * Every machine code an error body can carry, with what it means. Keyed by
 * `ErrorCode`, so the compiler forces this map to stay exhaustive in both
 * directions: a new kernel or lobby rejection code that is not listed here
 * fails to compile, and a code listed here that no longer exists does too.
 */
const errorCodeDocs: Record<ErrorCode, string> = {
  // Kernel rejections: the command reached the game and it refused.
  notActive: "The game is not in a status that accepts this intent",
  notReady: "Start was requested but the game is not ready",
  expired: "The turn deadline (plus grace) had already passed",
  notPending: "The acting seat is not in the pending set",
  stateUpdated: "The board advanced past the version acted against; resync and retry",
  invalidPayload: "The action payload failed the version unit's action schema",
  illegalMove: "The game's applyAction refused the move",
  // Lobby rejections: the waiting-room commands.
  unknownGame: "No game with this id exists",
  notJoinable: "The game is no longer in a lobby status",
  gameFull: "Every seat is taken",
  alreadyJoined: "The caller already holds a seat",
  notParticipant: "The caller holds no seat in this game",
  notCreator: "A creator-only command from a non-creator",
  creatorCannotLeave: "The creator cancels the game instead of leaving it",
  // Raised by a route before the command reaches the game.
  clientUpdateRequired: "This client build is older than the game or server rules it needs",
  serverUpdateRequired: "This client build is newer than the deployed server rules",
  usernameInvalid: "The submitted username fails the format rules",
  usernameTaken: "The submitted username is already in use",
  friendsOnly: "The game is limited to the creator's friends",
  registrationRequired: "The action needs a registered account; the caller is a guest",
  imageTooLarge: "The uploaded avatar exceeds the size limit",
  unsupportedImageType: "The uploaded avatar is not an accepted image type",
  rateLimited: "Too many requests in a short window; retry after the interval in the Retry-After header",
  invalidCursor: "The pagination cursor did not decode; drop it and request the first page",
  localOnly: "This route only serves games played on the device (origin `local`)",
  notLocalBot: "A bot in this request is hosted elsewhere and cannot play on the device",
};

/** The closed set of stable error codes, published as an enum so a client can
 * `switch` on it exhaustively rather than string-matching. Adding a member is
 * a wire change and needs a schema-version bump, like any enum on the wire. */
export const errorCodeShape = z.enum(Object.keys(errorCodeDocs) as [ErrorCode, ...ErrorCode[]]).openapi("ErrorCode", {
  // Deliberately a single short line: the generator stamps this description
  // onto every enum member, so the per-code meanings live in `errorCodeDocs`
  // above (and the reference docs) rather than 15 times over in the client.
  description: "A stable machine code identifying why a request failed.",
});

/** The one error envelope for every non-2xx response: a human message plus an
 * optional stable `code` the client keys typed handling off. Named
 * `ErrorResponse` (not `Error`) to avoid colliding with Dart's `dart:core.Error`
 * in the generated client. The message is display copy and may be reworded, so
 * dispatch on `code`, never on `error`. */
export const errorShape = z.object({ error: z.string(), code: errorCodeShape.optional() }).openapi("ErrorResponse");

export const seatShape = z
  .object({
    playerIndex: z.number().int(),
    userId: z.string().nullable(),
    botId: z.string().nullable(),
    type: z.enum(["human", "bot"]),
  })
  .openapi("Seat");

export const gameStatusShape = z.enum(["waiting", "ready", "active", "finished", "aborted"]).openapi("GameStatus");

/** Who may join a game. Named (not inlined at each use) so the create body and
 * the game summary generate against ONE client enum rather than two unrelated
 * ones for the same concept. */
export const gameAccessShape = z.enum(["public", "private", "friends"]).openapi("GameAccess");

/** Where a game is played: an ordinary server game, or one the device played
 * offline against on-device bots and imported. Fixed at creation. Named for the
 * same reason `GameAccess` is: the summary and the session must generate
 * against one client enum. */
export const gameOriginShape = z.enum(["online", "local"] satisfies [GameOrigin, ...GameOrigin[]]).openapi("GameOrigin", {
  description: "Where a game is played. `online` is decided entirely by the server; `local` was played on the device against on-device bots and imported afterwards.",
});

/** How a bot's moves are produced. On the wire because a client picking an
 * opponent has to know which mode a bot can play: only `local` and `engine`
 * bots can be seated in an on-device game, and guessing from the name is not a
 * contract. `webhookUrl` stays server-side. */
export const botTypeShape = z.enum(["engine", "external", "local"] satisfies [BotType, ...BotType[]]).openapi("BotType", {
  description: "How this bot's moves are produced: `engine` in the server's game rules, `external` by a hosted service, `local` by a brain shipped in the client.",
});

export const outcomeShape = z
  .object({
    playerIndex: z.number().int(),
    result: z.enum(["win", "loss", "draw", "eliminated"]),
    placement: z.number().int(),
    teamIndex: z.number().int(),
    score: z.number().nullish(),
  })
  .openapi("Outcome");

export const ratingDeltaShape = z
  .object({
    /** Exactly one id is set: the same nullable-pair shape as `Seat`. */
    identity: z.object({ userId: z.string().nullable(), botId: z.string().nullable() }).openapi("RatingIdentity"),
    pool: z.string(),
    muBefore: z.number(),
    sigmaBefore: z.number(),
    displayBefore: z.number().int(),
    muAfter: z.number(),
    sigmaAfter: z.number(),
    displayAfter: z.number().int(),
    displayChange: z.number().int(),
  })
  .openapi("RatingDelta");

export const frameShape = z
  .object({
    type: z.literal("frame"),
    version: z.number().int(),
    /** The seat's projected observation: game-defined, never raw state. */
    data: jsonObjectShape,
    pendingPlayers: z.array(z.number().int()),
    deadline: z.number().int().nullable(),
    playerTimes: z.array(z.number().int()).nullable(),
    outcomes: z.array(outcomeShape).optional(),
    ratings: z.array(ratingDeltaShape).optional(),
  })
  .openapi("Frame");

/** The complete live truth about one game as one seat sees it: the only message
 * the socket carries, and the body of every accepted command.
 *
 * One shape for every path a client can learn about a game, which is the point.
 * It carries the immutable header as well as the moving parts so a game screen
 * needs no second source, and `frame` is only ever the receiving seat's own view,
 * projected before send. Ordered by `seq` rather than `version`, because a lobby
 * change has no version. */
export const sessionShape = z
  .object({
    type: z.literal("session"),
    seq: z.number().int(),
    gameId: z.string(),
    shortCode: z.string(),
    access: gameAccessShape,
    origin: gameOriginShape,
    schemaVersion: z.number().int(),
    config: jsonObjectShape,
    turnSeconds: z.number().int().nullable(),
    budgetSeconds: z.number().int().nullable(),
    incrementSeconds: z.number().int().nullable(),
    rated: z.boolean(),
    ratingPool: z.string().nullable(),
    minPlayers: z.number().int(),
    maxPlayers: z.number().int(),
    createdBy: z.string().nullable(),
    status: gameStatusShape,
    players: z.array(seatShape),
    /** Null while the game is in the lobby. */
    version: z.number().int().nullable(),
    /** Null in the lobby, and for a caller holding no seat.
     *
     * Spelled as a union with `z.null()` rather than `.nullable()` because a
     * nullable `$ref` loses its null branch on the way into the OpenAPI
     * document: the emitter resolves it to a bare `$ref`, and the generated Dart
     * then types the field non-nullable and throws parsing a lobby session,
     * which is the common case. A union emits `anyOf: [$ref, {type: null}]`,
     * which survives. */
    frame: z.union([frameShape, z.null()]),
  })
  .openapi("Session");

/** Every accepted command answers with the caller's own post-commit session, so
 * a join, a start and a move are one client path rather than three. */
export const commandAcceptedShape = z
  .object({
    session: sessionShape,
  })
  .openapi("CommandAccepted");

export const gameSummaryShape = z
  .object({
    id: z.string(),
    createdBy: z.string().nullable(),
    status: gameStatusShape,
    access: gameAccessShape,
    origin: gameOriginShape,
    schemaVersion: z.number().int(),
    config: jsonObjectShape,
    turnSeconds: z.number().int().nullable(),
    budgetSeconds: z.number().int().nullable(),
    incrementSeconds: z.number().int().nullable(),
    rated: z.boolean(),
    ratingPool: z.string().nullable(),
    minPlayers: z.number().int(),
    maxPlayers: z.number().int(),
    shortCode: z.string(),
    pendingPlayers: z.array(z.number().int()).nullable(),
    turnDeadline: z.number().int().nullable(),
    outcomes: z.array(outcomeShape).nullable(),
    /** Every identity's rating change, present only on a finished rated game.
     * Per-game like `outcomes`, not per-viewer: a client picks out its own seat
     * the same way it does there. */
    ratings: z.array(ratingDeltaShape).optional(),
    finishedAt: z.number().int().nullable(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    participants: z.array(seatShape),
  })
  .openapi("GameSummary");

export const playerShape = z
  .object({
    id: z.string(),
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    isAnonymous: z.boolean(),
  })
  .openapi("Player");

export const profileShape = playerShape
  .extend({
    email: z.string().nullable(),
    createdAt: z.number().int(),
  })
  .openapi("Profile");

/** The other user's public identity plus when the relationship formed: the
 * shared base of an accepted friend and a pending request. */
const friendBase = playerShape.extend({ userId: z.string(), since: z.number().int() }).omit({ id: true });

/** One accepted friend. */
export const friendShape = friendBase.openapi("Friend");

/** One pending friend request: a friend shape plus the request's direction
 * relative to the caller (`incoming` = received, `outgoing` = sent). */
export const friendRequestShape = friendBase.extend({ direction: z.enum(["incoming", "outgoing"]) }).openapi("FriendRequest");

/** The target of a friend write. */
export const friendTargetBody = z.object({ targetUserId: z.string().min(1) }).openapi("FriendTarget");

/** A username change. Charset is validated in the handler for a precise error. */
export const usernameBody = z.object({ username: z.string().min(3).max(20) }).openapi("UsernameUpdate");

/** A display-name change. Free-form (it seeds from the identity provider's
 * name), so only length is constrained; uniqueness is deliberately not, since two
 * players may share a display name, which is what the username disambiguates. */
export const displayNameBody = z.object({ displayName: z.string().trim().min(1).max(40) }).openapi("DisplayNameUpdate");

export const botShape = z
  .object({
    id: z.string(),
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    schemaVersion: z.number().int(),
    type: botTypeShape,
    ratedEligible: z.boolean(),
    config: jsonObjectShape,
  })
  .openapi("Bot");

// ── Request bodies ────────────────────────────────────────────────────────────

/**
 * The caller's chosen seat range: an assertion about the game it wants, not the
 * authority on what is possible.
 *
 * `GameRules.playerLimits` derives the bounds this config can actually be played
 * with, and a create may only narrow them (a 2-6 game opened as a 3-6 lobby).
 * Omitting both means exactly the derived bounds, which is every fixed-size
 * game, so the common case sends nothing. A range reaching outside them is
 * refused: the rules index seats by these numbers, so a wider one is a corrupt
 * game rather than a big one.
 */
const seatFields = {
  minPlayers: z.number().int().min(1).optional(),
  maxPlayers: z.number().int().min(1).optional(),
};

/** A chosen range must be a range. Bounds against the rules need the parsed
 * config, so they are checked in the route, not here. */
const seatsOrdered = (v: { minPlayers?: number; maxPlayers?: number }) => v.minPlayers === undefined || v.maxPlayers === undefined || v.maxPlayers >= v.minPlayers;

const timingFields = {
  turnSeconds: z.number().int().positive().nullable().default(null),
  budgetSeconds: z.number().int().positive().nullable().default(null),
  incrementSeconds: z.number().int().nonnegative().nullable().default(null),
};

type TimingBody = { turnSeconds: number | null; budgetSeconds: number | null; incrementSeconds: number | null };
const timingExclusive = (v: TimingBody) => v.turnSeconds === null || v.budgetSeconds === null;
const incrementNeedsBudget = (v: TimingBody) => v.incrementSeconds === null || v.budgetSeconds !== null;

/** The newest schema version bundled by the client creating the game. */
const creatableSchemaVersionAssertion = z.number().int().positive().openapi({
  description: "The newest schemaVersion bundled by this client. New games always use exactly the server's latest installed version.",
  example: 1,
});

export const createGameBody = z
  .object({
    access: gameAccessShape,
    schemaVersion: creatableSchemaVersionAssertion,
    /** Game-defined; parsed by the version unit's config schema. Uses the
     * shared free-form-object shape so every JSON payload on the wire
     * (config, observation data) generates as one Dart type and a config can
     * round-trip from a read straight back into a create. */
    config: jsonObjectShape,
    ...seatFields,
    /** The client's concrete rated assertion (Dart twin of `ratingPool`),
     * validated and never coerced. Absent ⇒ rated when eligible. */
    rated: z.boolean().optional(),
    ...timingFields,
  })
  .refine(timingExclusive, "turnSeconds and budgetSeconds are mutually exclusive")
  .refine(incrementNeedsBudget, "incrementSeconds requires budgetSeconds")
  .refine(seatsOrdered, "maxPlayers must be at least minPlayers")
  .openapi("CreateGame");

export const createdShape = z.object({ gameId: z.string(), shortCode: z.string() }).openapi("Created");

/** A narrow, short-lived credential for the browser WebSocket handshake. */
export const socketTicketShape = z.object({ ticket: z.string() }).openapi("SocketTicket");

/** Create-solo: a private game seated with the caller plus one or more
 * bots, created and started in one call. Same timing/config fields as
 * `createGameBody` (no `access`, since solo games are always private) plus the
 * bots to seat. */
export const createSoloBody = z
  .object({
    schemaVersion: creatableSchemaVersionAssertion,
    /** Game-defined; parsed by the version unit's config schema. Uses the
     * shared free-form-object shape so every JSON payload on the wire
     * (config, observation data) generates as one Dart type and a config can
     * round-trip from a read straight back into a create. */
    config: jsonObjectShape,
    ...seatFields,
    rated: z.boolean().optional(),
    /** The bots to seat alongside the caller, in seat order after seat 0. */
    botIds: z.array(z.string()).min(1),
    ...timingFields,
  })
  .refine(timingExclusive, "turnSeconds and budgetSeconds are mutually exclusive")
  .refine(incrementNeedsBudget, "incrementSeconds requires budgetSeconds")
  .refine(seatsOrdered, "maxPlayers must be at least minPlayers")
  .openapi("CreateSolo");

/** The started solo game: its ids plus the caller's committed v0 frame (the
 * same ride-along an action response carries). */
/** A created-and-started solo game. The session is the only delivery of its
 * opening frame: the game is already running before any socket exists. */
export const soloStartedShape = z.object({ session: sessionShape }).openapi("SoloStarted");

// ── Local games (offline play, imported) ─────────────────────────────────────

/** The base RNG seed the device already played the game from: 128 bits, hex,
 * exactly what `randomSeed()` produces. Spelled as a pattern rather than a
 * length because the server re-derives every transition's randomness from it,
 * and a seed that differs by one character is a different game. */
const seedField = z
  .string()
  .regex(/^[0-9a-f]{32}$/, "must be 32 lowercase hex characters")
  .openapi({ example: "0f1e2d3c4b5a69788796a5b4c3d2e1f0" });

/**
 * Create-local: register a game the device has already started and played, so
 * the rest of the import has somewhere to land.
 *
 * The same creation policy as create-solo, minus the timed rule (an on-device
 * game has no server to keep a clock) and minus the caller's say over access
 * and rating: a local game is always private, always unrated, and always
 * untimed, so those are not fields. The id and the seed come from the device
 * because the game already exists there; sending them is what makes this create
 * idempotent and what makes the server's replay draw the same random values.
 */
export const createLocalBody = z
  .object({
    /** The device-generated game id, which becomes the server id. Opaque: a
     * client UUID in practice, bounded only so it cannot be unreasonable. */
    gameId: z.string().min(1).max(64),
    /** The version the device played at. Unlike an online create this need only
     * be *installed*, not the latest: the game was created on a device that was
     * current when it was played, and refusing it later would strand a finished
     * game the player can see on their phone. */
    schemaVersion: z.number().int().positive().openapi({ description: "The schemaVersion the device played at. Any version this deployment ships is accepted; a newer one answers 409 serverUpdateRequired.", example: 1 }),
    config: jsonObjectShape,
    ...seatFields,
    /** The bots the device seated, in seat order after seat 0. Each must be a
     * registry row whose brain can run on a device (`local` or `engine`). */
    botIds: z.array(z.string()).min(1),
    seed: seedField,
    /** When the device started the game. Clamped to the server's clock, so a
     * device with a fast clock cannot post-date its history. */
    createdAt: z.number().int().openapi({ description: "Epoch milliseconds, as the device recorded it. Stored as min(claimed, server now)." }),
  })
  .refine(seatsOrdered, "maxPlayers must be at least minPlayers")
  .openapi("CreateLocalGame");

/** A registered local game. Like `SoloStarted`, the session is the only
 * delivery of the opening frame: the game is already running. */
export const localStartedShape = z.object({ session: sessionShape }).openapi("LocalStarted");

/** One transition of the device's log. `data` is the game's own action payload
 * for `game`, and `{ type: "forfeit", playerIndex }` for `lifecycle` — the only
 * importable lifecycle, since an untimed game cannot time out and auto-forfeit
 * is the engine's own. */
export const localTransitionShape = z
  .object({
    seat: z.number().int().min(0),
    kind: z.enum(["game", "lifecycle"]),
    data: z.unknown(),
  })
  .openapi("LocalTransition");

/** An append of the device's log against the server's current version.
 * Bounded per request so a long game syncs in batches inside the body limit,
 * and so one request's work stays bounded at the object. */
export const localTransitionsBody = z
  .object({
    fromVersion: z.number().int().min(0),
    transitions: z.array(localTransitionShape).min(1).max(200),
  })
  .openapi("LocalTransitions");

/** How far an append got.
 *
 * A rejection is not a transport failure: everything before `rejection.index`
 * is committed and permanent, so this is a 200 carrying the truth. It means the
 * device's Dart rules and the server's TypeScript rules disagreed about the
 * game, which is a twin defect the client surfaces (`diverged`) rather than
 * retrying. */
export const localTransitionsAppliedShape = z
  .object({
    applied: z.number().int(),
    session: sessionShape,
    rejection: z.union([
      z
        .object({
          index: z.number().int(),
          code: errorCodeShape,
          message: z.string(),
        })
        .openapi("LocalRejection"),
      z.null(),
    ]),
  })
  .openapi("LocalTransitionsApplied");

/** One stored transition as the engine logged it. Not the wire vocabulary a
 * game screen uses (that is `Frame`, projected per seat); this is the
 * engine-owned log entry, and it appears on exactly one route. */
export const transitionActionShape = z
  .object({
    type: z.enum(["user", "bot", "system"]),
    kind: z.enum(["game", "lifecycle", "ratings"]),
    /** Game-defined for `game`, the lifecycle payload for `lifecycle`, and the
     * engine's rating deltas for `ratings`. */
    data: jsonObjectShape,
    /** The performer's seat; null for identity-less system transitions. */
    playerIndex: z.number().int().nullable(),
  })
  .openapi("TransitionAction");

/**
 * Everything a device needs to continue a local game it holds no record for.
 *
 * This is the ONE route that carries raw state and the game's seed off the
 * server, and it is deliberate: a local game has exactly one human, the caller,
 * who played every transition on their own device and still holds both there.
 * There is no second participant for the disclosure to be against, and the
 * alternative — re-deriving the game from the log — is exactly what the device
 * will do with it anyway.
 */
export const localRecordShape = z
  .object({
    session: sessionShape,
    seed: seedField,
    /** When the device that played it says the game began, and when it ended.
     * The session carries neither, and a pulled record has to sort into the
     * same lists as one this device played, so they ride along rather than
     * costing a second read of the summary. */
    createdAt: z.number().int(),
    finishedAt: z.number().int().nullable(),
    transitions: z.array(
      z
        .object({
          version: z.number().int(),
          state: jsonObjectShape,
          action: z.union([transitionActionShape, z.null()]),
          pending: z.array(z.number().int()),
        })
        .openapi("LocalTransitionRow"),
    ),
  })
  .openapi("LocalRecord");

export const joinBody = z
  .object({
    /** Newest game schema bundled by this client. Published versions are
     * retained contiguously, so this means the client supports `1...latest`. */
    clientSchemaVersion: z.number().int().positive().openapi({ example: 3 }),
  })
  .openapi("Join");

export const joinByCodeBody = joinBody.extend({ shortCode: z.string().min(1) }).openapi("JoinByCode");

export const addBotBody = z.object({ botId: z.string() }).openapi("AddBot");

export const actionBody = z
  .object({
    /** The caller's own seat, verified against the roster at the DO;
     * a seat the caller doesn't hold is rejected. Carried uniformly with bots. */
    seat: z.number().int().min(0),
    /** Game-defined move payload; parsed by the version unit's action schema. */
    data: z.unknown(),
    expectedVersion: z.number().int().min(0),
  })
  .openapi("Action");

/** Forfeit carries the resigning seat, verified against the roster like an
 * action. */
export const forfeitBody = z.object({ seat: z.number().int().min(0) }).openapi("Forfeit");

// ── Projections ───────────────────────────────────────────────────────────────

export function gameSummaryOf(g: GameWithRoster): z.infer<typeof gameSummaryShape> {
  return {
    id: g.id,
    createdBy: g.createdBy,
    status: g.status,
    access: g.access,
    origin: g.origin,
    schemaVersion: g.schemaVersion,
    config: g.config,
    turnSeconds: g.turnSeconds,
    budgetSeconds: g.budgetSeconds,
    incrementSeconds: g.incrementSeconds,
    rated: g.rated,
    ratingPool: g.ratingPool,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    shortCode: g.shortCode,
    pendingPlayers: g.pendingPlayers,
    turnDeadline: g.turnDeadline,
    outcomes: g.outcomes,
    ...(g.ratings !== undefined ? { ratings: g.ratings } : {}),
    finishedAt: g.finishedAt,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    participants: g.participants,
  };
}

export function playerOf(u: Pick<UserRow, "id" | "username" | "displayName" | "avatarUrl" | "isAnonymous">): z.infer<typeof playerShape> {
  return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl, isAnonymous: u.isAnonymous };
}

/** The bot catalog projection. Unlike the ratings/history reads (whose SELECT
 * already names exactly the wire fields), `readBots` returns the whole row, so
 * the public shape is carved out here, at the wire boundary. `type` is public
 * (a client picking an on-device opponent needs it); the secret `webhookUrl`
 * never leaves, which is why this stays an explicit field list. */
export function botOf(b: BotRow): z.infer<typeof botShape> {
  return { id: b.id, username: b.username, displayName: b.displayName, avatarUrl: b.avatarUrl, schemaVersion: b.schemaVersion, type: b.type, ratedEligible: b.ratedEligible, config: b.config };
}
