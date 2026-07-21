/**
 * The wire vocabulary — zod schemas for every request and response body, and
 * the D1-row → wire projections. snake_case on the wire (the Dart client's
 * convention, carried from the Supabase era); the OpenAPI document is
 * generated from exactly these schemas and vendored into the Dart repo.
 *
 * Leak-test discipline: no projection here ever touches a state
 * field — raw state never leaves the DO, and the games row carries none.
 */

import type { JsonObject } from "@eigen/rules";
import { z } from "@hono/zod-openapi";
import type { UserRow } from "../auth/provision.js";
import type { GameWithRoster } from "../d1/reads.js";
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
  // Kernel rejections — the command reached the game and it refused.
  not_active: "The game is not in a status that accepts this intent",
  not_ready: "Start was requested but the game is not ready",
  expired: "The turn deadline (plus grace) had already passed",
  not_pending: "The acting seat is not in the pending set",
  state_updated: "The board advanced past the version acted against — resync and retry",
  invalid_payload: "The action payload failed the version unit's action schema",
  illegal_move: "The game's applyAction refused the move",
  // Lobby rejections — the waiting-room commands.
  unknown_game: "No game with this id exists",
  not_joinable: "The game is no longer in a lobby status",
  game_full: "Every seat is taken",
  already_joined: "The caller already holds a seat",
  not_participant: "The caller holds no seat in this game",
  not_creator: "A creator-only command from a non-creator",
  creator_cannot_leave: "The creator cancels the game instead of leaving it",
  // Raised by a route before the command reaches the game.
  schema_unsupported: "The game's schema version is newer than this client build supports",
  username_invalid: "The submitted username fails the format rules",
  username_taken: "The submitted username is already in use",
  friends_only: "The game is limited to the creator's friends",
  registration_required: "The action needs a registered account; the caller is a guest",
  image_too_large: "The uploaded avatar exceeds the size limit",
  unsupported_image_type: "The uploaded avatar is not an accepted image type",
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
 * in the generated client. The message is display copy and may be reworded —
 * dispatch on `code`, never on `error`. */
export const errorShape = z.object({ error: z.string(), code: errorCodeShape.optional() }).openapi("ErrorResponse");

export const seatShape = z
  .object({
    player_index: z.number().int(),
    user_id: z.string().nullable(),
    bot_id: z.string().nullable(),
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
    player_index: z.number().int(),
    result: z.enum(["win", "loss", "draw", "eliminated"]),
    placement: z.number().int(),
    team_index: z.number().int(),
    score: z.number().nullish(),
  })
  .openapi("Outcome");

export const ratingDeltaShape = z
  .object({
    /** Exactly one id is set — the same nullable-pair shape as `Seat`. */
    identity: z.object({ user_id: z.string().nullable(), bot_id: z.string().nullable() }).openapi("RatingIdentity"),
    pool: z.string(),
    mu_before: z.number(),
    sigma_before: z.number(),
    display_before: z.number().int(),
    mu_after: z.number(),
    sigma_after: z.number(),
    display_after: z.number().int(),
    display_change: z.number().int(),
  })
  .openapi("RatingDelta");

export const frameShape = z
  .object({
    type: z.literal("frame"),
    version: z.number().int(),
    /** The seat's projected observation — game-defined, never raw state. */
    data: jsonObjectShape,
    pending_players: z.array(z.number().int()),
    deadline: z.number().int().nullable(),
    player_times: z.array(z.number().int()).nullable(),
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
 * Both forms answer identically — they are the same operation from the caller's
 * side ("seat me in this game"), and only differ in how the game was named. The
 * id is echoed rather than assumed because the by-code caller never had it, and
 * a single shape means one client path from either entry point instead of two
 * that happen to agree. */
export const joinedShape = z
  .object({
    game_id: z.string(),
    roster: rosterShape,
  })
  .openapi("Joined");

export const gameSummaryShape = z
  .object({
    id: z.string(),
    created_by: z.string().nullable(),
    status: gameStatusShape,
    access: gameAccessShape,
    schema_version: z.number().int(),
    config: jsonObjectShape,
    turn_seconds: z.number().int().nullable(),
    budget_seconds: z.number().int().nullable(),
    increment_seconds: z.number().int().nullable(),
    rated: z.boolean(),
    rating_pool: z.string().nullable(),
    min_players: z.number().int(),
    max_players: z.number().int(),
    short_code: z.string(),
    pending_players: z.array(z.number().int()).nullable(),
    turn_deadline: z.number().int().nullable(),
    outcomes: z.array(outcomeShape).nullable(),
    /** Every identity's rating change, present only on a finished rated game.
     * Per-game like `outcomes`, not per-viewer: a client picks out its own seat
     * the same way it does there. */
    ratings: z.array(ratingDeltaShape).optional(),
    finished_at: z.number().int().nullable(),
    created_at: z.number().int(),
    updated_at: z.number().int(),
    participants: z.array(seatShape),
  })
  .openapi("GameSummary");

export const playerShape = z
  .object({
    id: z.string(),
    username: z.string(),
    display_name: z.string(),
    avatar_url: z.string().nullable(),
    is_anonymous: z.boolean(),
  })
  .openapi("Player");

export const profileShape = playerShape
  .extend({
    email: z.string().nullable(),
    created_at: z.number().int(),
  })
  .openapi("Profile");

/** The other user's public identity plus when the relationship formed — the
 * shared base of an accepted friend and a pending request. */
const friendBase = playerShape.extend({ user_id: z.string(), since: z.number().int() }).omit({ id: true });

/** One accepted friend. */
export const friendShape = friendBase.openapi("Friend");

/** One pending friend request: a friend shape plus the request's direction
 * relative to the caller (`incoming` = received, `outgoing` = sent). */
export const friendRequestShape = friendBase.extend({ direction: z.enum(["incoming", "outgoing"]) }).openapi("FriendRequest");

/** The target of a friend write. */
export const friendTargetBody = z.object({ target_user_id: z.string().min(1) }).openapi("FriendTarget");

/** A username change. Charset is validated in the handler for a precise error. */
export const usernameBody = z.object({ username: z.string().min(3).max(20) }).openapi("UsernameUpdate");

/** A display-name change. Free-form (it seeds from the identity provider's
 * name), so only length is constrained; uniqueness is deliberately not — two
 * players may share a display name, which is what the username disambiguates. */
export const displayNameBody = z.object({ display_name: z.string().trim().min(1).max(40) }).openapi("DisplayNameUpdate");

export const botShape = z
  .object({
    id: z.string(),
    username: z.string(),
    display_name: z.string(),
    avatar_url: z.string().nullable(),
    schema_version: z.number().int(),
    rated_eligible: z.boolean(),
    config: jsonObjectShape,
  })
  .openapi("Bot");

// ── Request bodies ────────────────────────────────────────────────────────────

const timingFields = {
  turn_seconds: z.number().int().positive().nullable().default(null),
  budget_seconds: z.number().int().positive().nullable().default(null),
  increment_seconds: z.number().int().positive().nullable().default(null),
};

type TimingBody = { turn_seconds: number | null; budget_seconds: number | null; increment_seconds: number | null };
const timingExclusive = (v: TimingBody) => v.turn_seconds === null || v.budget_seconds === null;
const incrementNeedsBudget = (v: TimingBody) => v.increment_seconds === null || v.budget_seconds !== null;

export const createGameBody = z
  .object({
    access: gameAccessShape,
    schema_version: z.number().int(),
    /** Game-defined; parsed by the version unit's config schema. Uses the
     * shared free-form-object shape so every JSON payload on the wire
     * (config, observation data) generates as one Dart type and a config can
     * round-trip from a read straight back into a create. */
    config: jsonObjectShape,
    min_players: z.number().int().min(1),
    max_players: z.number().int().min(1),
    /** The client's concrete rated assertion (Dart twin of `ratingPool`) —
     * validated, never coerced. Absent ⇒ rated when eligible. */
    rated: z.boolean().optional(),
    ...timingFields,
  })
  .refine(timingExclusive, "turn_seconds and budget_seconds are mutually exclusive")
  .refine(incrementNeedsBudget, "increment_seconds requires budget_seconds")
  .refine((v) => v.max_players >= v.min_players, "max_players must be at least min_players")
  .openapi("CreateGame");

export const createdShape = z.object({ game_id: z.string(), short_code: z.string() }).openapi("Created");

/** Create-solo: a private game seated with the caller plus one or more
 * bots, created and started in one call. Same timing/config fields as
 * `createGameBody` (no `access` — solo games are always private) plus the
 * bots to seat. */
export const createSoloBody = z
  .object({
    schema_version: z.number().int(),
    /** Game-defined; parsed by the version unit's config schema. Uses the
     * shared free-form-object shape so every JSON payload on the wire
     * (config, observation data) generates as one Dart type and a config can
     * round-trip from a read straight back into a create. */
    config: jsonObjectShape,
    min_players: z.number().int().min(1),
    max_players: z.number().int().min(1),
    rated: z.boolean().optional(),
    /** The bots to seat alongside the caller, in seat order after seat 0. */
    bot_ids: z.array(z.string()).min(1),
    ...timingFields,
  })
  .refine(timingExclusive, "turn_seconds and budget_seconds are mutually exclusive")
  .refine(incrementNeedsBudget, "increment_seconds requires budget_seconds")
  .refine((v) => v.max_players >= v.min_players, "max_players must be at least min_players")
  .openapi("CreateSolo");

/** The started solo game: its ids plus the caller's committed v0 frame (the
 * same ride-along an action response carries). */
export const soloStartedShape = z.object({ game_id: z.string(), short_code: z.string(), version: z.number().int(), frame: frameShape.nullable() }).openapi("SoloStarted");

/** Client retries reuse the same command_id — the DO replays the stored
 * response instead of re-executing. */
const commandId = z.string().min(1).max(128).optional();

export const joinBody = z
  .object({
    /** The newest schema_version this client build ships rules for — the
     * schema gate (an old app cannot join a newer game). */
    client_schema_version: z.number().int(),
    command_id: commandId,
  })
  .openapi("Join");

export const joinByCodeBody = joinBody.extend({ short_code: z.string().min(1) }).openapi("JoinByCode");

export const lobbyCommandBody = z.object({ command_id: commandId }).openapi("LobbyCommand");

export const addBotBody = z.object({ bot_id: z.string(), command_id: commandId }).openapi("AddBot");

export const actionBody = z
  .object({
    /** The caller's own seat — verified against the roster at the DO;
     * a seat the caller doesn't hold is rejected. Carried uniformly with bots. */
    seat: z.number().int().min(0),
    /** Game-defined move payload; parsed by the version unit's action schema. */
    data: z.unknown(),
    expected_version: z.number().int().min(0),
    command_id: commandId,
  })
  .openapi("Action");

/** Forfeit carries the resigning seat, verified against the roster like an
 * action. */
export const forfeitBody = z.object({ seat: z.number().int().min(0), command_id: commandId }).openapi("Forfeit");

// ── Projections ───────────────────────────────────────────────────────────────

export function gameSummaryOf(g: GameWithRoster): z.infer<typeof gameSummaryShape> {
  return {
    id: g.id,
    created_by: g.createdBy,
    status: g.status,
    access: g.access,
    schema_version: g.schemaVersion,
    config: g.config,
    turn_seconds: g.turnSeconds,
    budget_seconds: g.budgetSeconds,
    increment_seconds: g.incrementSeconds,
    rated: g.rated,
    rating_pool: g.ratingPool,
    min_players: g.minPlayers,
    max_players: g.maxPlayers,
    short_code: g.shortCode,
    pending_players: g.pendingPlayers,
    turn_deadline: g.turnDeadline,
    outcomes: g.outcomes,
    ...(g.ratings !== undefined ? { ratings: g.ratings } : {}),
    finished_at: g.finishedAt,
    created_at: g.createdAt,
    updated_at: g.updatedAt,
    participants: g.participants,
  };
}

export function playerOf(u: Pick<UserRow, "id" | "username" | "displayName" | "avatarUrl" | "isAnonymous">): z.infer<typeof playerShape> {
  return { id: u.id, username: u.username, display_name: u.displayName, avatar_url: u.avatarUrl, is_anonymous: u.isAnonymous };
}
