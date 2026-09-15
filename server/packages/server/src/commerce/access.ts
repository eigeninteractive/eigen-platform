import { and, eq, gt, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { orm } from "../d1/orm.js";
import { commerceUsage, entitlementGrants, gameContent, games } from "../d1/schema.js";
import { HttpError } from "../http.js";
import type { GameOrigin } from "../protocol.js";
import { capabilityAllows, capabilityKey, catalogGrants } from "./capability.js";
import type { AccessGrant, AccessSnapshot, ActiveEntitlement, CommerceCatalog, CommercialLimit, CommercialMetric, CommercialPeriod, ContentGrant, EngineAccessCapability, LimitAccess, SelectedContent } from "./types.js";

/**
 * The one game origin commerce does not price.
 *
 * A local game is played entirely on the device: no server turn, no dispatch,
 * no alarm, and no seat held open between moves. Nothing was sold, so nothing
 * is charged — it consumes no capability, no content ownership, and no metric.
 * The engine still registers it, commits its transitions, and replays it,
 * because those are records of play rather than play itself.
 *
 * `app.access` is the deliberate exception and is enforced in the auth
 * middleware, not here: it gates reaching the server at all rather than
 * playing, and a player without it can still play offline — they just cannot
 * synchronize. Every other gate asks {@link isCommerceExempt} first.
 */
export const COMMERCE_EXEMPT_ORIGIN: GameOrigin = "local";

/** Whether commerce prices this game. See {@link COMMERCE_EXEMPT_ORIGIN}. */
export function isCommerceExempt(game: { origin: GameOrigin }): boolean {
  return game.origin === COMMERCE_EXEMPT_ORIGIN;
}

interface ActiveGrantSource {
  key: string;
  validFrom: number;
  validUntil: number | null;
}

interface GrantWithSource {
  grant: AccessGrant;
  source: ActiveGrantSource | null;
}

export interface MetricPolicy {
  metric: CommercialMetric;
  maximum: number | "noCommercialLimit";
  period: CommercialPeriod | null;
  periodKey: string | null;
  resetsAt: number | null;
  /** Record uses even while an unlimited entitlement temporarily dominates. */
  recordsUsage: boolean;
}

export interface EffectiveAccess {
  snapshot: AccessSnapshot;
  grants: readonly GrantWithSource[];
}

async function activeSources(d1: D1Database, userId: string, now: number): Promise<ActiveGrantSource[]> {
  const rows = await orm(d1)
    .select({ key: entitlementGrants.entitlementKey, validFrom: entitlementGrants.validFrom, validUntil: entitlementGrants.validUntil })
    .from(entitlementGrants)
    .where(and(eq(entitlementGrants.userId, userId), isNull(entitlementGrants.revokedAt), lte(entitlementGrants.validFrom, now), or(isNull(entitlementGrants.validUntil), gt(entitlementGrants.validUntil, now))))
    .all();
  const combined = new Map<string, ActiveGrantSource>();
  for (const row of rows) {
    const existing = combined.get(row.key);
    if (existing === undefined) combined.set(row.key, row);
    else if (existing.validUntil !== null && (row.validUntil === null || row.validUntil > existing.validUntil)) combined.set(row.key, row);
  }
  return [...combined.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function calendarWindow(now: number): { key: string; resetsAt: number } {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    key: `calendarMonth:${year}-${String(month + 1).padStart(2, "0")}`,
    resetsAt: Date.UTC(year, month + 1, 1),
  };
}

function periodWindow(period: CommercialPeriod, source: ActiveGrantSource | null, now: number): { key: string; resetsAt: number | null } {
  switch (period.kind) {
    case "calendarMonth": {
      const window = calendarWindow(now);
      return { key: window.key, resetsAt: window.resetsAt };
    }
    case "lifetime":
      return { key: "lifetime", resetsAt: null };
    case "concurrent":
      return { key: "concurrent", resetsAt: null };
    case "subscriptionPeriod":
      if (source === null || source.validUntil === null) throw new Error("subscriptionPeriod limit has no finite active entitlement period");
      return { key: `subscription:${source.key}:${source.validFrom}:${source.validUntil}`, resetsAt: source.validUntil };
  }
}

function numericCandidates(access: EffectiveAccess, metric: CommercialMetric): { limit: Extract<CommercialLimit, { maximum: number }>; source: ActiveGrantSource | null }[] {
  const candidates = [];
  for (const item of access.grants) {
    for (const limit of item.grant.limits ?? []) {
      if (limit.metric === metric && limit.maximum !== "noCommercialLimit") candidates.push({ limit, source: item.source });
    }
  }
  return candidates;
}

export function metricPolicy(access: EffectiveAccess, catalog: CommerceCatalog, metric: CommercialMetric, now: number): MetricPolicy | null {
  const candidates = numericCandidates(access, metric);
  const allConfigured = catalogGrants(catalog)
    .flatMap((grant) => grant.limits ?? [])
    .filter((limit) => limit.metric === metric);
  if (allConfigured.length === 0) return null;

  const unlimited = access.grants.some((item) => item.grant.limits?.some((limit) => limit.metric === metric && limit.maximum === "noCommercialLimit") === true);
  if (unlimited) {
    // Record against the strongest currently active numeric fallback so usage
    // remains meaningful if the unlimited grant expires. An inactive plan is
    // not a fallback and, for subscription periods, has no valid window to
    // charge; an unlimited-only account therefore records nothing.
    const recording = candidates.reduce<(typeof candidates)[number] | undefined>((best, candidate) => (best === undefined || candidate.limit.maximum > best.limit.maximum ? candidate : best), undefined);
    if (recording === undefined) return { metric, maximum: "noCommercialLimit", period: null, periodKey: null, resetsAt: null, recordsUsage: false };
    const window = periodWindow(recording.limit.period, recording.source, now);
    return { metric, maximum: "noCommercialLimit", period: recording.limit.period, periodKey: window.key, resetsAt: window.resetsAt, recordsUsage: true };
  }
  if (candidates.length === 0) return null;
  const chosen = candidates.reduce((best, candidate) => (candidate.limit.maximum > best.limit.maximum ? candidate : best));
  const window = periodWindow(chosen.limit.period, chosen.source, now);
  return { metric, maximum: chosen.limit.maximum, period: chosen.limit.period, periodKey: window.key, resetsAt: window.resetsAt, recordsUsage: chosen.limit.period.kind !== "concurrent" };
}

async function usageFor(d1: D1Database, userId: string, policy: MetricPolicy): Promise<number> {
  if (policy.period?.kind === "concurrent") {
    // A game played on the device holds no server seat and reserves no capacity
    // slot at creation, so counting one here would spend an allowance nothing
    // is holding and that finishing it would then have to release. Excluded by
    // the same constant the create and replay gates read, so the boundary
    // cannot drift between what is charged and what is counted.
    const row = await orm(d1)
      .select({ count: sql<number>`count(*)` })
      .from(games)
      .where(and(eq(games.createdBy, userId), ne(games.origin, COMMERCE_EXEMPT_ORIGIN), inArray(games.status, ["waiting", "ready", "active"])))
      .get();
    return row?.count ?? 0;
  }
  if (policy.periodKey === null) return 0;
  const row = await orm(d1)
    .select({ count: sql<number>`count(*)` })
    .from(commerceUsage)
    .where(and(eq(commerceUsage.userId, userId), eq(commerceUsage.metric, policy.metric), eq(commerceUsage.periodKey, policy.periodKey)))
    .get();
  return row?.count ?? 0;
}

/** Resolve the free profile plus every currently active entitlement. */
export async function readEffectiveAccess(d1: D1Database, catalog: CommerceCatalog, userId: string, now: number): Promise<EffectiveAccess> {
  const sources = await activeSources(d1, userId, now);
  const definitions = new Map(catalog.entitlements.map((item) => [item.key, item] as const));
  const grants: GrantWithSource[] = [{ grant: catalog.free, source: null }];
  for (const source of sources) {
    const definition = definitions.get(source.key);
    if (definition !== undefined) grants.push({ grant: definition, source });
  }

  const permissions = new Map<string, EngineAccessCapability>();
  const content = new Map<string, ContentGrant>();
  for (const item of grants) {
    for (const permission of item.grant.permissions ?? []) permissions.set(capabilityKey(permission), permission);
    for (const owned of item.grant.content ?? []) content.set(`${owned.collection}/${owned.id}`, owned);
  }

  const access: EffectiveAccess = {
    grants,
    snapshot: {
      entitlements: sources.map((source): ActiveEntitlement => ({ key: source.key, validFrom: source.validFrom, validUntil: source.validUntil })),
      permissions: [...permissions.values()],
      content: [...content.values()],
      limits: [],
    },
  };
  const metrics = new Set(catalogGrants(catalog).flatMap((grant) => (grant.limits ?? []).map((limit) => limit.metric)));
  const limits: LimitAccess[] = [];
  for (const metric of metrics) {
    const policy = metricPolicy(access, catalog, metric, now);
    if (policy === null) continue;
    const used = await usageFor(d1, userId, policy);
    limits.push({
      metric,
      maximum: policy.maximum,
      period: policy.period,
      used,
      remaining: policy.maximum === "noCommercialLimit" ? null : Math.max(0, policy.maximum - used),
      resetsAt: policy.resetsAt,
    });
  }
  return { ...access, snapshot: { ...access.snapshot, limits } };
}

export function allowsCapability(access: EffectiveAccess, required: EngineAccessCapability): boolean {
  return access.snapshot.permissions.some((granted) => capabilityAllows(granted, required));
}

/** Enforce one capability, or refuse with the code the client renders a store
 * for. `message` overrides the default rendering where a route has copy a
 * player can act on; the code is what the client actually switches on. */
export function requireCapability(access: EffectiveAccess, required: EngineAccessCapability, message?: string): void {
  if (!allowsCapability(access, required)) {
    throw new HttpError(403, message ?? `Capability required: ${capabilityKey(required)}`, "capabilityRequired");
  }
}

export function ownsContent(access: EffectiveAccess, required: ContentGrant): boolean {
  return access.snapshot.content.some((owned) => owned.collection === required.collection && owned.id === required.id);
}

export async function readSelectedGameContent(d1: D1Database, gameId: string): Promise<SelectedContent[]> {
  const rows = await orm(d1).select().from(gameContent).where(eq(gameContent.gameId, gameId)).all();
  return rows.map((row) => ({ collection: row.collection, id: row.itemId, classification: row.classification, ownership: row.ownership }));
}
