import { capabilityKey } from "./capability.js";
import type { AccessGrant, CommerceCatalog, CommerceConfig, CommerceProvider, CommercialLimit, CommercialMetric, ResolvedCommerce } from "./types.js";

const KEY = /^[a-z][a-z0-9._-]{0,63}$/;

function assertKey(value: string, where: string): void {
  if (!KEY.test(value)) throw new Error(`createEngine: ${where} must match ${KEY}, found ${JSON.stringify(value)}`);
}

function assertUnique(values: readonly string[], where: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`createEngine: duplicate ${where} ${JSON.stringify(value)}`);
    seen.add(value);
  }
}

function periodKey(limit: CommercialLimit): string {
  if (limit.maximum === "noCommercialLimit") return "unlimited";
  return limit.period.kind === "calendarMonth" ? `${limit.period.kind}:${limit.period.timezone}` : limit.period.kind;
}

function validateGrant(catalog: CommerceCatalog, grant: AccessGrant, where: string): void {
  const permissionKeys = (grant.permissions ?? []).map(capabilityKey);
  assertUnique(permissionKeys, `${where} permission`);
  for (const permission of grant.permissions ?? []) {
    if (permission.kind === "content.use" && catalog.content?.[permission.collection]?.[permission.id] === undefined) {
      throw new Error(`createEngine: ${where} references unknown content capability ${permission.collection}/${permission.id}`);
    }
    if (permission.kind === "bot.use" && permission.tier !== undefined) {
      assertKey(permission.tier, `${where} bot tier`);
      if (!Object.values(catalog.botTiers ?? {}).includes(permission.tier)) {
        throw new Error(`createEngine: ${where} references unknown bot tier ${permission.tier}`);
      }
    }
    if (permission.kind === "analysis.use" && permission.analysisType !== undefined) {
      assertKey(permission.analysisType, `${where} analysis type`);
    }
  }

  const contentKeys = (grant.content ?? []).map((item) => `${item.collection}/${item.id}`);
  assertUnique(contentKeys, `${where} content`);
  for (const item of grant.content ?? []) {
    assertKey(item.collection, `${where} content collection`);
    assertKey(item.id, `${where} content id`);
    if (catalog.content?.[item.collection]?.[item.id] === undefined) {
      throw new Error(`createEngine: ${where} references unknown content ${item.collection}/${item.id}`);
    }
  }

  const periods = new Map<CommercialMetric, string>();
  for (const limit of grant.limits ?? []) {
    if (limit.maximum !== "noCommercialLimit" && (!Number.isSafeInteger(limit.maximum) || limit.maximum < 0)) {
      throw new Error(`createEngine: ${where} limit ${limit.metric} must be a non-negative safe integer`);
    }
    const key = periodKey(limit);
    const previous = periods.get(limit.metric);
    if (previous !== undefined && previous !== key && previous !== "unlimited" && key !== "unlimited") {
      throw new Error(`createEngine: ${where} combines incompatible periods for ${limit.metric}`);
    }
    periods.set(limit.metric, previous === "unlimited" ? previous : key);
    if (limit.maximum !== "noCommercialLimit") {
      if (limit.metric === "games.openCreated" && limit.period.kind !== "concurrent") {
        throw new Error("createEngine: games.openCreated requires a concurrent period");
      }
      if (limit.metric !== "games.openCreated" && limit.period.kind === "concurrent") {
        throw new Error(`createEngine: ${limit.metric} cannot use a concurrent period`);
      }
    }
  }
}

/** Validate a deployment catalog once, before any request can reach it. */
export function resolveCommerce<TEnv>(config: CommerceConfig<TEnv>): ResolvedCommerce {
  const { catalog } = config;
  assertUnique(
    catalog.entitlements.map((item) => item.key),
    "entitlement key",
  );
  assertUnique(
    catalog.offers.map((item) => item.key),
    "offer key",
  );

  for (const [collection, items] of Object.entries(catalog.content ?? {})) {
    assertKey(collection, "content collection");
    for (const id of Object.keys(items)) assertKey(id, `content id in ${collection}`);
  }

  validateGrant(catalog, catalog.free, "free grant");
  if (catalog.free.limits?.some((limit) => limit.maximum !== "noCommercialLimit" && limit.period.kind === "subscriptionPeriod") === true) {
    throw new Error("createEngine: free grant cannot use a subscriptionPeriod limit");
  }
  const entitlements = new Map(catalog.entitlements.map((item) => [item.key, item] as const));
  for (const entitlement of catalog.entitlements) {
    assertKey(entitlement.key, "entitlement key");
    validateGrant(catalog, entitlement, `entitlement ${entitlement.key}`);
  }

  const productOwners = new Map<string, string>();
  for (const offer of catalog.offers) {
    assertKey(offer.key, "offer key");
    if (offer.entitlements.length === 0) throw new Error(`createEngine: offer ${offer.key} grants no entitlements`);
    assertUnique(offer.entitlements, `entitlement in offer ${offer.key}`);
    for (const key of offer.entitlements) {
      if (!entitlements.has(key)) throw new Error(`createEngine: offer ${offer.key} references unknown entitlement ${key}`);
      const hasSubscriptionPeriod = entitlements.get(key)?.limits?.some((limit) => limit.maximum !== "noCommercialLimit" && limit.period.kind === "subscriptionPeriod") === true;
      if (hasSubscriptionPeriod && offer.kind !== "subscription") {
        throw new Error(`createEngine: entitlement ${key} has a subscriptionPeriod limit but offer ${offer.key} is not a subscription`);
      }
    }
    for (const [provider, providerReference] of Object.entries(offer.providerReferences)) {
      assertKey(provider, `provider key in offer ${offer.key}`);
      if (providerReference.length === 0 || providerReference.length > 512) {
        throw new Error(`createEngine: offer ${offer.key} has an invalid ${provider} provider reference`);
      }
      const identity = `${provider}:${providerReference}`;
      const previous = productOwners.get(identity);
      if (previous !== undefined) throw new Error(`createEngine: provider product ${identity} maps to both ${previous} and ${offer.key}`);
      productOwners.set(identity, offer.key);
    }
  }

  for (const entitlement of catalog.entitlements) {
    const hasSubscriptionPeriod = entitlement.limits?.some((limit) => limit.maximum !== "noCommercialLimit" && limit.period.kind === "subscriptionPeriod") === true;
    if (hasSubscriptionPeriod && !catalog.offers.some((offer) => offer.kind === "subscription" && offer.entitlements.includes(entitlement.key))) {
      throw new Error(`createEngine: entitlement ${entitlement.key} has a subscriptionPeriod limit but no subscription offer`);
    }
  }

  const providers = new Map<string, CommerceProvider<unknown>>();
  for (const provider of config.providers) {
    assertKey(provider.key, "provider key");
    if (providers.has(provider.key)) throw new Error(`createEngine: duplicate commerce provider ${provider.key}`);
    providers.set(provider.key, provider as CommerceProvider<unknown>);
  }
  for (const offer of catalog.offers) {
    for (const provider of Object.keys(offer.providerReferences)) {
      if (!providers.has(provider)) throw new Error(`createEngine: offer ${offer.key} references unconfigured provider ${provider}`);
    }
  }

  const periodByMetric = new Map<CommercialMetric, string>();
  for (const grant of [catalog.free, ...catalog.entitlements]) {
    for (const limit of grant.limits ?? []) {
      if (limit.maximum === "noCommercialLimit") continue;
      const key = periodKey(limit);
      const previous = periodByMetric.get(limit.metric);
      if (previous !== undefined && previous !== key) throw new Error(`createEngine: catalog combines incompatible periods for ${limit.metric}`);
      periodByMetric.set(limit.metric, key);
    }
  }

  const reconcileBatch = config.reconcileBatch ?? 100;
  if (!Number.isSafeInteger(reconcileBatch) || reconcileBatch < 1 || reconcileBatch > 1000) {
    throw new Error("createEngine: commerce.reconcileBatch must be an integer from 1 to 1000");
  }
  const reconcileMaxFailures = config.reconcileMaxFailures ?? 10;
  if (!Number.isSafeInteger(reconcileMaxFailures) || reconcileMaxFailures < 1 || reconcileMaxFailures > 100) {
    throw new Error("createEngine: commerce.reconcileMaxFailures must be an integer from 1 to 100");
  }
  return { catalog, providers, now: config.now ?? Date.now, reconcileBatch, reconcileMaxFailures };
}
