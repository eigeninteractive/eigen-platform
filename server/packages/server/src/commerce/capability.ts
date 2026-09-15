import type { BotType } from "../d1/schema.js";
import type { AccessGrant, CommerceCatalog, EngineAccessCapability } from "./types.js";

/**
 * The tier a bot is sold under, where a tier can bind at all.
 *
 * `botTiers` names a tier per registered bot, but a tier is a price only where
 * the server seats the bot, because seating is the one request that can be
 * refused. A `local` bot's brain ships only in the client, so the server never
 * seats it and could never check its tier: it has none here, whatever the
 * catalog says. Resolving through this one function is what keeps the tier the
 * bot catalog publishes identical to the tier the seating routes enforce.
 *
 * An `engine` bot whose Dart twin also ships in the app is free offline in the
 * same way, but nothing on the server can see inside a client bundle, so that
 * half is a rule for the game author rather than a check. See the monetization
 * guide.
 */
export function botTier(catalog: CommerceCatalog | undefined, bot: { id: string; type: BotType }): string | undefined {
  if (bot.type === "local") return undefined;
  return catalog?.botTiers?.[bot.id];
}

/** Every grant a catalog can contribute: the always-present free profile plus
 * each defined entitlement. Composition unions these in this order wherever
 * access is resolved, so one accessor keeps that set in one place. */
export function catalogGrants(catalog: CommerceCatalog): readonly AccessGrant[] {
  return [catalog.free, ...catalog.entitlements];
}

/**
 * Whether this deployment gates `kind` at all, meaning some grant in the
 * catalog offers it.
 *
 * This is the opt-in half of a deliberately two-tier default. `game.create`,
 * `game.join` and `bot.use` are the operations a game is FOR, so their absence
 * from every grant denies them: a catalog that forgets to grant creation has
 * said nothing can be created. `app.access` and `replay.read` are the two whose
 * absence means the deployment never had that product, so gating on them
 * unconditionally would paywall the whole app, or every replay, behind a
 * capability nobody sells. Those two ask this first and enforce only when the
 * answer is yes.
 */
export function catalogGates(catalog: CommerceCatalog, kind: EngineAccessCapability["kind"]): boolean {
  return catalogGrants(catalog).some((grant) => grant.permissions?.some((permission) => permission.kind === kind) === true);
}

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
