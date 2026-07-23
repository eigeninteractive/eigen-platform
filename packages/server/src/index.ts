/**
 * `@eigen/server` — everything that deploys: the
 * `createEngine` API factory, the GameDO base class, the D1 applier +
 * schemas, and the protocol types.
 */

export { displayRating, type RatingDelta } from "@eigen/kernel";
export { type AuthClaims, AuthError, createFirebaseVerifier, type TokenVerifier } from "./auth/firebase.js";
export { ensureUser, type UserRow } from "./auth/provision.js";
// The operator utility for onboarding an external bot: derive the key you hand
// its owner. The signing/verifying halves stay internal — the engine does that.
export { deriveBotKey } from "./bot/bot-auth.js";
export { applyFinish, type CreateGameInput, createGame, type FinishApplyInput, mirrorRoster, readGameRow, updateSummary } from "./d1/apply.js";
export { isTransientD1Error, type RetryOptions, withRetry } from "./d1/retry.js";
export * as d1Schema from "./d1/schema.js";
export { BaseGameDO, DEADLINE_GRACE_MS } from "./do/game-do.js";
export * as doSchema from "./do/schema.js";
export { createEngine, type EngineConfig, type LegalConfig, type OperatorConfig, openApiDocument, type SiteConfig } from "./engine.js";
export { HttpError } from "./http.js";
export type { Command, CommandResult, FrameMessage, LobbyRejectCode, Principal, RosterSnapshot } from "./protocol.js";
