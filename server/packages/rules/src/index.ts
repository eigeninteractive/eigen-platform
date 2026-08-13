/**
 * `@eigeninteractive/rules`: the contract a game implements. A `GameModule` bundles one
 * `GameRules` unit per schema version; the engine calls its hooks and never
 * inspects game state directly. This package is types plus a couple of
 * helpers: it has no runtime dependencies and pulls in no engine code.
 *
 * @module @eigeninteractive/rules
 */

export type {
  ActionKind,
  ActionType,
  AnyGameRules,
  ApplyActionArgs,
  ApplyLifecycleArgs,
  BotAction,
  BotActionArgs,
  BotSeatableArgs,
  ComputeObservationArgs,
  Envelope,
  GameAccess,
  GameModule,
  GameResult,
  GameRules,
  GameSchemas,
  InitialStateArgs,
  LifecycleAction,
  LifecycleType,
  ObservationSlice,
  OutcomeEntry,
  RatingPoolArgs,
  Rng,
  TransitionCause,
} from "./contract.js";
export { IllegalMoveError, passthroughObservation } from "./helpers.js";
export type { Json, JsonObject } from "./json.js";
export type {
  GamePayloadSchema,
  StandardJSONSchemaV1,
} from "./standard-json-schema.js";
