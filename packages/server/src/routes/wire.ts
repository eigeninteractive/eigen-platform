/**
 * The wire vocabulary — zod schemas for every request and response body, and
 * the D1-row → wire projections. snake_case on the wire (the Dart client's
 * convention, carried from the Supabase era); the OpenAPI document is
 * generated from exactly these schemas and vendored into the Dart repo.
 *
 * Leak-test discipline (§5.3): no projection here ever touches a state
 * field — raw state never leaves the DO, and the games row carries none.
 */

import type { JsonObject } from "@eigen/rules";
import { z } from "@hono/zod-openapi";
import type { UserRow } from "../auth/provision.js";
import type { GameWithRoster } from "../d1/reads.js";

/** A game-defined JSON object payload (an observation's `data`, a config).
 * Typed as the engine's `JsonObject` so the wire types line up with the
 * protocol types exactly; documented as a free-form object. */
const jsonObjectShape = z.custom<JsonObject>((v) => typeof v === "object" && v !== null && !Array.isArray(v)).openapi({ type: "object" });

// ── Shared shapes ─────────────────────────────────────────────────────────────

export const errorShape = z.object({ error: z.string(), code: z.string().optional() }).openapi("Error");

export const seatShape = z
  .object({
    player_index: z.number().int(),
    user_id: z.string().nullable(),
    bot_id: z.string().nullable(),
    type: z.enum(["human", "bot"]),
  })
  .openapi("Seat");

export const gameStatusShape = z.enum(["waiting", "ready", "active", "finished", "aborted"]).openapi("GameStatus");

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
    identity: z.union([z.object({ user_id: z.string() }), z.object({ bot_id: z.string() })]),
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
    deadline: z.number().nullable(),
    player_times: z.array(z.number()).nullable(),
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
 * acting seat's own frame riding the response (§4.3). */
export const commandAcceptedShape = z
  .object({
    ok: z.literal(true),
    version: z.number().int(),
    frame: frameShape.nullable(),
  })
  .openapi("CommandAccepted");

/** An accepted waiting-room command: the post-commit roster snapshot. */
export const lobbyAcceptedShape = z
  .object({
    ok: z.literal(true),
    roster: rosterShape,
  })
  .openapi("LobbyAccepted");

export const gameSummaryShape = z
  .object({
    id: z.string(),
    created_by: z.string().nullable(),
    status: gameStatusShape,
    access: z.enum(["public", "private", "friends"]),
    schema_version: z.number().int(),
    config: jsonObjectShape,
    turn_seconds: z.number().nullable(),
    budget_seconds: z.number().nullable(),
    increment_seconds: z.number().nullable(),
    rated: z.boolean(),
    rating_pool: z.string().nullable(),
    min_players: z.number().int(),
    max_players: z.number().int(),
    short_code: z.string(),
    pending_players: z.array(z.number().int()).nullable(),
    turn_deadline: z.number().nullable(),
    outcomes: z.array(outcomeShape).nullable(),
    finished_at: z.number().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
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
    created_at: z.number(),
  })
  .openapi("Profile");

/** One entry in a friends / pending-requests list: the other user's public
 * identity plus relationship metadata (`direction` only on pending lists). */
export const relationshipShape = playerShape
  .extend({
    user_id: z.string(),
    direction: z.enum(["incoming", "outgoing"]).optional(),
    since: z.number(),
  })
  .omit({ id: true })
  .openapi("Relationship");

/** The target of a friend write. */
export const friendTargetBody = z.object({ target_user_id: z.string().min(1) }).openapi("FriendTarget");

/** A username change. Charset is validated in the handler for a precise error. */
export const usernameBody = z.object({ username: z.string().min(3).max(20) }).openapi("UsernameUpdate");

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
    access: z.enum(["public", "private", "friends"]).default("public"),
    schema_version: z.number().int(),
    /** Game-defined; parsed by the version unit's config schema. */
    config: z.record(z.string(), z.unknown()).default({}),
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

/** Create-solo (§7): a private game seated with the caller plus one or more
 * bots, created and started in one call. Same timing/config fields as
 * `createGameBody` (no `access` — solo games are always private) plus the
 * bots to seat. */
export const createSoloBody = z
  .object({
    schema_version: z.number().int(),
    config: z.record(z.string(), z.unknown()).default({}),
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
 * response instead of re-executing (§3.6). */
const commandId = z.string().min(1).max(128).optional();

export const joinBody = z
  .object({
    /** The newest schema_version this client build ships rules for — the
     * §4.2 schema gate (an old app cannot join a newer game). */
    client_schema_version: z.number().int(),
    command_id: commandId,
  })
  .openapi("Join");

export const joinByCodeBody = joinBody.extend({ short_code: z.string().min(1) }).openapi("JoinByCode");

export const lobbyCommandBody = z.object({ command_id: commandId }).openapi("LobbyCommand");

export const addBotBody = z.object({ bot_id: z.string(), command_id: commandId }).openapi("AddBot");

export const actionBody = z
  .object({
    /** The caller's own seat (§4.2) — verified against the roster at the DO;
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
    finished_at: g.finishedAt,
    created_at: g.createdAt,
    updated_at: g.updatedAt,
    participants: g.participants,
  };
}

export function playerOf(u: Pick<UserRow, "id" | "username" | "displayName" | "avatarUrl" | "isAnonymous">): z.infer<typeof playerShape> {
  return { id: u.id, username: u.username, display_name: u.displayName, avatar_url: u.avatarUrl, is_anonymous: u.isAnonymous };
}
