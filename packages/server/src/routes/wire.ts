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
import type { ErrorCode } from "../http.js";

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
  schemaUnsupported: "The game's schema version is newer than this client build supports",
  usernameInvalid: "The submitted username fails the format rules",
  usernameTaken: "The submitted username is already in use",
  friendsOnly: "The game is limited to the creator's friends",
  registrationRequired: "The action needs a registered account; the caller is a guest",
  imageTooLarge: "The uploaded avatar exceeds the size limit",
  unsupportedImageType: "The uploaded avatar is not an accepted image type",
  rateLimited: "Too many requests in a short window; retry after the interval in the Retry-After header",
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

export const rosterShape = z
  .object({
    type: z.literal("roster"),
    status: gameStatusShape,
    players: z.array(seatShape),
  })
  .openapi("Roster");

/** An accepted state-transitioning command: the committed version, plus the
 * acting seat's own frame riding the response. */
export const commandAcceptedShape = z
  .object({
    version: z.number().int(),
    frame: frameShape.nullable(),
  })
  .openapi("CommandAccepted");

/** An accepted waiting-room command: the post-commit roster snapshot. */
export const lobbyAcceptedShape = z
  .object({
    roster: rosterShape,
  })
  .openapi("LobbyAccepted");

/** An accepted join, by id or by short code.
 *
 * Both forms answer identically; they are the same operation from the caller's
 * side ("seat me in this game"), and only differ in how the game was named. The
 * id is echoed rather than assumed because the by-code caller never had it, and
 * a single shape means one client path from either entry point instead of two
 * that happen to agree. */
export const joinedShape = z
  .object({
    gameId: z.string(),
    roster: rosterShape,
  })
  .openapi("Joined");

export const gameSummaryShape = z
  .object({
    id: z.string(),
    createdBy: z.string().nullable(),
    status: gameStatusShape,
    access: gameAccessShape,
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
    ratedEligible: z.boolean(),
    config: jsonObjectShape,
  })
  .openapi("Bot");

// ── Request bodies ────────────────────────────────────────────────────────────

const timingFields = {
  turnSeconds: z.number().int().positive().nullable().default(null),
  budgetSeconds: z.number().int().positive().nullable().default(null),
  incrementSeconds: z.number().int().positive().nullable().default(null),
};

type TimingBody = { turnSeconds: number | null; budgetSeconds: number | null; incrementSeconds: number | null };
const timingExclusive = (v: TimingBody) => v.turnSeconds === null || v.budgetSeconds === null;
const incrementNeedsBudget = (v: TimingBody) => v.incrementSeconds === null || v.budgetSeconds !== null;

export const createGameBody = z
  .object({
    access: gameAccessShape,
    schemaVersion: z.number().int(),
    /** Game-defined; parsed by the version unit's config schema. Uses the
     * shared free-form-object shape so every JSON payload on the wire
     * (config, observation data) generates as one Dart type and a config can
     * round-trip from a read straight back into a create. */
    config: jsonObjectShape,
    minPlayers: z.number().int().min(1),
    maxPlayers: z.number().int().min(1),
    /** The client's concrete rated assertion (Dart twin of `ratingPool`),
     * validated and never coerced. Absent ⇒ rated when eligible. */
    rated: z.boolean().optional(),
    ...timingFields,
  })
  .refine(timingExclusive, "turnSeconds and budgetSeconds are mutually exclusive")
  .refine(incrementNeedsBudget, "incrementSeconds requires budgetSeconds")
  .refine((v) => v.maxPlayers >= v.minPlayers, "maxPlayers must be at least minPlayers")
  .openapi("CreateGame");

export const createdShape = z.object({ gameId: z.string(), shortCode: z.string() }).openapi("Created");

/** Create-solo: a private game seated with the caller plus one or more
 * bots, created and started in one call. Same timing/config fields as
 * `createGameBody` (no `access`, since solo games are always private) plus the
 * bots to seat. */
export const createSoloBody = z
  .object({
    schemaVersion: z.number().int(),
    /** Game-defined; parsed by the version unit's config schema. Uses the
     * shared free-form-object shape so every JSON payload on the wire
     * (config, observation data) generates as one Dart type and a config can
     * round-trip from a read straight back into a create. */
    config: jsonObjectShape,
    minPlayers: z.number().int().min(1),
    maxPlayers: z.number().int().min(1),
    rated: z.boolean().optional(),
    /** The bots to seat alongside the caller, in seat order after seat 0. */
    botIds: z.array(z.string()).min(1),
    ...timingFields,
  })
  .refine(timingExclusive, "turnSeconds and budgetSeconds are mutually exclusive")
  .refine(incrementNeedsBudget, "incrementSeconds requires budgetSeconds")
  .refine((v) => v.maxPlayers >= v.minPlayers, "maxPlayers must be at least minPlayers")
  .openapi("CreateSolo");

/** The started solo game: its ids plus the caller's committed v0 frame (the
 * same ride-along an action response carries). */
export const soloStartedShape = z.object({ gameId: z.string(), shortCode: z.string(), version: z.number().int(), frame: frameShape.nullable() }).openapi("SoloStarted");

/** Client retries reuse the same commandId, so the DO replays the stored
 * response instead of re-executing. */
const commandId = z.string().min(1).max(128).optional();

export const joinBody = z
  .object({
    /** The newest schemaVersion this client build ships rules for: the
     * schema gate (an old app cannot join a newer game). */
    clientSchemaVersion: z.number().int(),
    commandId: commandId,
  })
  .openapi("Join");

export const joinByCodeBody = joinBody.extend({ shortCode: z.string().min(1) }).openapi("JoinByCode");

export const lobbyCommandBody = z.object({ commandId: commandId }).openapi("LobbyCommand");

export const addBotBody = z.object({ botId: z.string(), commandId: commandId }).openapi("AddBot");

export const actionBody = z
  .object({
    /** The caller's own seat, verified against the roster at the DO;
     * a seat the caller doesn't hold is rejected. Carried uniformly with bots. */
    seat: z.number().int().min(0),
    /** Game-defined move payload; parsed by the version unit's action schema. */
    data: z.unknown(),
    expectedVersion: z.number().int().min(0),
    commandId: commandId,
  })
  .openapi("Action");

/** Forfeit carries the resigning seat, verified against the roster like an
 * action. */
export const forfeitBody = z.object({ seat: z.number().int().min(0), commandId: commandId }).openapi("Forfeit");

// ── Projections ───────────────────────────────────────────────────────────────

export function gameSummaryOf(g: GameWithRoster): z.infer<typeof gameSummaryShape> {
  return {
    id: g.id,
    createdBy: g.createdBy,
    status: g.status,
    access: g.access,
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
 * already names exactly the wire fields), `readBots` returns the whole row,
 * since `games.ts` needs `type` and the secret `webhookUrl` to seat bots, so the
 * public shape is carved out here, at the wire boundary, and `webhookUrl` never
 * leaves. */
export function botOf(b: BotRow): z.infer<typeof botShape> {
  return { id: b.id, username: b.username, displayName: b.displayName, avatarUrl: b.avatarUrl, schemaVersion: b.schemaVersion, ratedEligible: b.ratedEligible, config: b.config };
}
