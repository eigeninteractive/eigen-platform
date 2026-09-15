import type { EngineAccessCapability } from "./types.js";

/** Stable structural identity for set membership, logs, and error details. */
export function capabilityKey(capability: EngineAccessCapability): string {
  switch (capability.kind) {
    case "app.access":
    case "game.create.rated":
    case "replay.read":
      return capability.kind;
    case "game.create":
    case "game.join":
      return `${capability.kind}.${capability.access}`;
    case "bot.use":
      return capability.tier === undefined ? capability.kind : `${capability.kind}.${capability.tier}`;
    case "analysis.use":
      return capability.analysisType === undefined ? capability.kind : `${capability.kind}.${capability.analysisType}`;
    case "content.use":
      return `${capability.kind}.${capability.collection}.${capability.id}`;
  }
}

/** An unparameterized resource grant satisfies every tier of that capability. */
export function capabilityAllows(granted: EngineAccessCapability, required: EngineAccessCapability): boolean {
  if (granted.kind !== required.kind) return false;
  switch (required.kind) {
    case "app.access":
    case "game.create.rated":
    case "replay.read":
      return true;
    case "game.create":
    case "game.join":
      return (granted.kind === "game.create" || granted.kind === "game.join") && granted.access === required.access;
    case "bot.use":
      return granted.kind === "bot.use" && (granted.tier === undefined || granted.tier === required.tier);
    case "analysis.use":
      return granted.kind === "analysis.use" && (granted.analysisType === undefined || granted.analysisType === required.analysisType);
    case "content.use":
      return granted.kind === "content.use" && granted.collection === required.collection && granted.id === required.id;
  }
}
