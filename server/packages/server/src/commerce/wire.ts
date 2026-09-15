import { z } from "@hono/zod-openapi";

export const accessModeShape = z.enum(["public", "private", "friends"]);

/** A flattened wire projection of the structural server union. `kind` decides
 * which optional resource fields are meaningful. OpenAPI Generator does not
 * preserve discriminated object unions reliably for Dart. */
export const accessCapabilityShape = z
  .object({
    kind: z.enum(["app.access", "game.create", "game.join", "game.create.rated", "bot.use", "content.use", "replay.read", "analysis.use"]),
    access: accessModeShape.optional(),
    tier: z.string().optional(),
    collection: z.string().optional(),
    id: z.string().optional(),
    analysisType: z.string().optional(),
  })
  .openapi("AccessCapability");

export const contentGrantShape = z.object({ collection: z.string(), id: z.string() }).openapi("ContentGrant");

export const commercialPeriodKindShape = z.enum(["calendarMonth", "subscriptionPeriod", "lifetime", "concurrent"]).openapi("CommercialPeriodKind", {
  description: "The commercial accounting window. Calendar months always use UTC.",
});

export const limitAccessShape = z
  .object({
    metric: z.enum(["game.create.success", "games.openCreated", "bot.game.success", "analysis.run.success"]),
    /** Null exactly when `noCommercialLimit` is true. Kept as two ordinary
     * fields because OpenAPI Generator emits invalid Dart for number/string
     * scalar unions. */
    maximum: z.number().int().nonnegative().nullable(),
    noCommercialLimit: z.boolean(),
    period: commercialPeriodKindShape.nullable(),
    used: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative().nullable(),
    resetsAt: z.number().int().nullable(),
  })
  .openapi("CommercialLimitAccess");

export const accessSnapshotShape = z
  .object({
    entitlements: z.array(z.object({ key: z.string(), validFrom: z.number().int(), validUntil: z.number().int().nullable() }).openapi("ActiveEntitlement")),
    permissions: z.array(accessCapabilityShape),
    content: z.array(contentGrantShape),
    limits: z.array(limitAccessShape),
  })
  .openapi("AccessSnapshot");

export const commerceProductShape = z
  .object({
    provider: z.string(),
    providerReference: z.string(),
    displayPrice: z.string().nullable(),
    currencyCode: z.string().nullable(),
  })
  .openapi("CommerceProduct");

export const commerceOfferShape = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    kind: z.enum(["oneTime", "subscription"]),
    entitlements: z.array(z.string()),
    repeatable: z.boolean(),
    products: z.array(commerceProductShape),
  })
  .openapi("CommerceOffer");

export const commerceCatalogShape = z.object({ offers: z.array(commerceOfferShape) }).openapi("CommerceCatalog");

export const claimBodyShape = z.object({ provider: z.string(), offerKey: z.string(), evidence: z.record(z.string(), z.unknown()) }).openapi("CommerceClaim");

export const restoreBodyShape = z.object({ claims: z.array(claimBodyShape).min(1).max(100) }).openapi("CommerceRestore");

export const checkoutBodyShape = z
  .object({
    provider: z.string(),
    offerKey: z.string(),
    returnUrl: z.string().url(),
    operationId: z.string().min(1).max(128),
  })
  .openapi("CommerceCheckoutRequest");

export const managementBodyShape = z.object({ provider: z.string(), returnUrl: z.string().url() }).openapi("CommerceManagementRequest");

export const urlShape = z.object({ url: z.string().url() }).openapi("CommerceUrl");
