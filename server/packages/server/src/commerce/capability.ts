import type { BotType } from "../d1/schema.js";
import type { AccessGrant, CommerceCatalog, EngineAccessCapability } from "./types.js";

/**
 * The tier of every bot `botTiers` does not list.
 *
 * Every bot belongs to exactly one tier, so a `bot.use` grant always names one
 * and covers only that one. There is deliberately no grant meaning "every bot":
 * it is the grant a free profile reaches for to keep ordinary bots free, and it
 * would quietly cover the paid tiers too. A deployment that prices no bot grants
 * `standard`; one that sells a tier grants `standard` free and the paid tier
 * through an entitlement.
 */
export const DEFAULT_BOT_TIER = "standard";

/**
 * The tier a bot belongs to: its `botTiers` entry, or {@link DEFAULT_BOT_TIER}.
 *
 * A `local` bot is always in the default tier, whatever the catalog says. Its
 * brain ships only in the client, so the server never seats it and could never
 * charge for it; a paid tier on it would advertise a price nothing collects.
 * Resolving through this one function is what keeps the tier the bot catalog
 * publishes identical to the tier the seating routes enforce.
 *
 * An `engine` bot whose Dart twin also ships in the app is free offline in the
 * same way, but nothing on the server can see inside a client bundle, so that
 * half is a rule for the game author rather than a check. See the monetization
 * guide.
 */
export function botTier(catalog: CommerceCatalog | undefined, bot: { id: string; type: BotType }): string {
  if (bot.type === "local") return DEFAULT_BOT_TIER;
  return catalog?.botTiers?.[bot.id] ?? DEFAULT_BOT_TIER;
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
      return `${capability.kind}.${capability.tier}`;
    case "analysis.use":
      return capability.analysisType === undefined ? capability.kind : `${capability.kind}.${capability.analysisType}`;
    case "content.use":
      return `${capability.kind}.${capability.collection}.${capability.id}`;
  }
}

/**
 * Whether a grant covers a requirement. A grant covers exactly the resource it
 * names and nothing wider: a creation access mode, a bot tier, a content item.
 * As with `game.create`, there is no unparameterized grant standing for "all of
 * them", because that is the grant that silently gives away what a deployment
 * sells. `analysis.use` still accepts an untyped grant, which covers untyped
 * analysis only; whether an analysis type must be named belongs to the decision
 * that ships analysis.
 */
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
      return granted.kind === "bot.use" && granted.tier === required.tier;
    case "analysis.use":
      return granted.kind === "analysis.use" && granted.analysisType === required.analysisType;
    case "content.use":
      return granted.kind === "content.use" && granted.collection === required.collection && granted.id === required.id;
  }
}
