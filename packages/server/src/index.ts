/**
 * `@eigen/server` — everything that deploys (engine_stack.md §2.1): the
 * GameDO base class, the D1 applier + schemas, and the protocol types.
 * Routes (`createEngine`) arrive in the next milestone.
 */

export { displayRating, type RatingDelta } from "@eigen/kernel";
export { applyFinish, type CreateGameInput, createGame, type FinishApplyInput, readGameRow, updateSummary } from "./d1/apply.js";
export * as d1Schema from "./d1/schema.js";
export { createDevHarness, type DevHarnessConfig } from "./dev-harness.js";
export { BaseGameDO, DEADLINE_GRACE_MS } from "./do/game-do.js";
export * as doSchema from "./do/schema.js";
export type { Command, CommandResult, FrameMessage, Principal } from "./protocol.js";
