/**
 * `@eigeninteractive/server`: everything that deploys, being the
 * `createEngine` API factory, the GameDO base class, the D1 applier, and
 * the protocol types.
 *
 * The D1 and Durable Object table definitions are deliberately NOT exported.
 * They are engine-owned storage internals that migrate on their own schedule,
 * and `readGameRow` already returns the whole game row typed. Exporting the
 * drizzle tables would turn a private layout into a compatibility surface.
 *
 * @module @eigeninteractive/server
 */

export { displayRating, type RatingDelta } from "@eigeninteractive/kernel";
export { type AuthClaims, AuthError, createFirebaseVerifier, type TokenVerifier } from "./auth/firebase.js";
export { ensureUser, type UserRow } from "./auth/provision.js";
// The operator utility for onboarding an external bot: derive the key you hand
// its owner. The signing/verifying halves stay internal; the engine does that.
export { deriveBotKey } from "./bot/bot-auth.js";
export { applyFinish, type CreateGameInput, createGame, type FinishApplyInput, mirrorRoster, readGameRow, updateSummary } from "./d1/apply.js";
export { isTransientD1Error, type RetryOptions, withRetry } from "./d1/retry.js";
export { BaseGameDO, DEADLINE_GRACE_MS } from "./do/game-do.js";
export { createEngine, DEFAULT_CREDIT, type EngineConfig, type LegalConfig, type OperatorConfig, openApiDocument, type SiteConfig } from "./engine.js";
export type { FirebaseAdminEffects } from "./firebase/admin-effects.js";
export { HttpError } from "./http.js";
export type { Command, CommandResult, FrameMessage, LobbyRejectCode, Principal, SessionSnapshot } from "./protocol.js";
