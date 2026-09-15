/** Effective-grant composition and catalog validation. */

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { readEffectiveAccess } from "../src/commerce/access.js";
import { capabilityAllows, DEFAULT_BOT_TIER } from "../src/commerce/capability.js";
import { resolveCommerce } from "../src/commerce/catalog.js";
import { recordVerifiedTransaction } from "../src/commerce/ledger.js";
import { reconcileCommerce } from "../src/commerce/reconcile.js";
import type { CommerceCatalog, CommerceProvider, EngineAccessCapability, VerifiedCommerceTransaction } from "../src/commerce/types.js";
import { orm } from "../src/d1/orm.js";
import { commerceUsage } from "../src/d1/schema.js";
import { fakeCommerceProvider, testAccount } from "../src/testing.js";

const now = Date.UTC(2026, 8, 15, 12);

const catalog: CommerceCatalog = {
  free: {
    permissions: [{ kind: "game.create", access: "public" }],
    limits: [
      {
        metric: "game.create.success",
        maximum: 5,
        period: { kind: "calendarMonth", timezone: "UTC" },
      },
    ],
  },
  entitlements: [
    {
      key: "supporter",
      permissions: [{ kind: "game.create", access: "friends" }],
      content: [{ collection: "board_theme", id: "gold" }],
      limits: [
        {
          metric: "game.create.success",
          maximum: 20,
          period: { kind: "calendarMonth", timezone: "UTC" },
        },
      ],
    },
    {
      key: "pro",
      permissions: [{ kind: "game.create", access: "private" }],
      limits: [
        {
          metric: "game.create.success",
          maximum: "noCommercialLimit",
        },
      ],
    },
  ],
  offers: [
    {
      key: "supporter",
      name: "Supporter",
      description: "Permanent supporter access",
      kind: "oneTime",
      entitlements: ["supporter"],
      providerReferences: { fake: "supporter_once" },
    },
    {
      key: "pro_monthly",
      name: "Pro",
      description: "Monthly pro access",
      kind: "subscription",
      entitlements: ["pro"],
      providerReferences: { fake: "pro_monthly" },
    },
  ],
  content: { board_theme: { gold: { classification: "cosmetic" } } },
};

async function record(accountId: string, offerKey: string, transaction: VerifiedCommerceTransaction) {
  // The ledger writes only for an account that exists. Through the API the
  // auth middleware guarantees that; a direct call has to provision it.
  await testAccount(env.DB, accountId, now);
  await recordVerifiedTransaction(env.DB, {
    catalog,
    provider: "fake",
    accountId,
    expectedOfferKey: offerKey,
    transaction,
    now,
  });
}

describe("grant composition", () => {
  it("unions permissions/content, takes the greatest limit, then unlimited", async () => {
    const accountId = `compose-${crypto.randomUUID()}`;
    await record(accountId, "supporter", {
      providerTransactionId: crypto.randomUUID(),
      providerReference: "supporter_once",
      kind: "oneTime",
      state: "active",
      purchasedAt: now - 1000,
      validFrom: now - 1000,
    });

    const supporter = await readEffectiveAccess(env.DB, catalog, accountId, now);
    expect(supporter.snapshot.entitlements.map((item) => item.key)).toEqual(["supporter"]);
    expect(supporter.snapshot.permissions).toEqual(
      expect.arrayContaining([
        { kind: "game.create", access: "public" },
        { kind: "game.create", access: "friends" },
      ]),
    );
    expect(supporter.snapshot.content).toEqual([{ collection: "board_theme", id: "gold" }]);
    expect(supporter.snapshot.limits).toEqual([expect.objectContaining({ maximum: 20, remaining: 20 })]);

    const proTransactionId = crypto.randomUUID();
    await record(accountId, "pro_monthly", {
      providerTransactionId: proTransactionId,
      providerReference: "pro_monthly",
      kind: "subscription",
      state: "active",
      purchasedAt: now,
      validFrom: now,
      validUntil: now + 10_000,
    });
    const pro = await readEffectiveAccess(env.DB, catalog, accountId, now);
    expect(pro.snapshot.entitlements.map((item) => item.key)).toEqual(["pro", "supporter"]);
    expect(pro.snapshot.permissions).toContainEqual({
      kind: "game.create",
      access: "private",
    });
    expect(pro.snapshot.limits).toEqual([
      expect.objectContaining({
        maximum: "noCommercialLimit",
        remaining: null,
      }),
    ]);

    await record(accountId, "pro_monthly", {
      providerTransactionId: proTransactionId,
      providerReference: "pro_monthly",
      kind: "subscription",
      state: "expired",
      purchasedAt: now,
      validFrom: now,
      validUntil: now + 10_000,
    });
    const fallback = await readEffectiveAccess(env.DB, catalog, accountId, now);
    expect(fallback.snapshot.entitlements.map((item) => item.key)).toEqual(["supporter"]);
    expect(fallback.snapshot.limits[0]?.maximum).toBe(20);
  });

  it("scheduled reconciliation converges a missed expiry", async () => {
    const accountId = `reconcile-${crypto.randomUUID()}`;
    const transactionId = crypto.randomUUID();
    await record(accountId, "pro_monthly", {
      providerTransactionId: transactionId,
      providerReference: "pro_monthly",
      kind: "subscription",
      state: "active",
      purchasedAt: now - 1000,
      validFrom: now - 1000,
      validUntil: now + 1000,
    });

    const provider: CommerceProvider<unknown> = {
      key: "fake",
      verifyClaim: async () => {
        throw new Error("not used");
      },
      reconcile: async (_env, transactions) =>
        transactions.map((transaction) => ({
          providerTransactionId: transaction.providerTransactionId,
          providerReference: transaction.providerReference,
          kind: transaction.kind,
          state: "expired",
          purchasedAt: now - 1000,
          validFrom: now - 1000,
          validUntil: now + 1000,
        })),
    };
    await reconcileCommerce(env.DB, resolveCommerce({ catalog, providers: [provider], now: () => now }), {});

    const access = await readEffectiveAccess(env.DB, catalog, accountId, now);
    expect(access.snapshot.entitlements).toEqual([]);
  });

  it("uses one real sustaining source period rather than inventing a merged one", async () => {
    const accountId = `overlap-${crypto.randomUUID()}`;
    await record(accountId, "pro_monthly", {
      providerTransactionId: crypto.randomUUID(),
      providerReference: "pro_monthly",
      kind: "subscription",
      state: "active",
      purchasedAt: now - 5000,
      validFrom: now - 5000,
      validUntil: now + 1000,
    });
    await record(accountId, "pro_monthly", {
      providerTransactionId: crypto.randomUUID(),
      providerReference: "pro_monthly",
      kind: "subscription",
      state: "active",
      purchasedAt: now - 2000,
      validFrom: now - 2000,
      validUntil: now + 2000,
    });

    const access = await readEffectiveAccess(env.DB, catalog, accountId, now);
    expect(access.snapshot.entitlements).toContainEqual({
      key: "pro",
      validFrom: now - 2000,
      validUntil: now + 2000,
    });
  });

  it("uses predictable UTC calendar-month boundaries", async () => {
    const accountId = `month-${crypto.randomUUID()}`;
    await orm(env.DB)
      .insert(commerceUsage)
      .values({
        id: crypto.randomUUID(),
        userId: accountId,
        metric: "game.create.success",
        periodKey: "calendarMonth:2026-09",
        slot: 1,
        operationId: crypto.randomUUID(),
        createdAt: now,
      })
      .run();

    const september = await readEffectiveAccess(env.DB, catalog, accountId, Date.UTC(2026, 8, 30, 23, 59));
    expect(september.snapshot.limits).toEqual([expect.objectContaining({ used: 1, remaining: 4, resetsAt: Date.UTC(2026, 9, 1) })]);

    const october = await readEffectiveAccess(env.DB, catalog, accountId, Date.UTC(2026, 9, 1));
    expect(october.snapshot.limits).toEqual([expect.objectContaining({ used: 0, remaining: 5, resetsAt: Date.UTC(2026, 10, 1) })]);

    await orm(env.DB).delete(commerceUsage).where(eq(commerceUsage.userId, accountId)).run();
  });

  it("does not invent a usage window from an inactive subscription", async () => {
    const accountId = `unlimited-only-${crypto.randomUUID()}`;
    const unlimitedCatalog: CommerceCatalog = {
      free: {},
      entitlements: [
        {
          key: "lifetime",
          limits: [{ metric: "analysis.run.success", maximum: "noCommercialLimit" }],
        },
        {
          key: "metered",
          limits: [
            {
              metric: "analysis.run.success",
              maximum: 100,
              period: { kind: "subscriptionPeriod" },
            },
          ],
        },
      ],
      offers: [
        {
          key: "lifetime",
          name: "Lifetime",
          description: "Unlimited analysis",
          kind: "oneTime",
          entitlements: ["lifetime"],
          providerReferences: { fake: "lifetime" },
        },
        {
          key: "metered",
          name: "Metered",
          description: "Monthly analysis",
          kind: "subscription",
          entitlements: ["metered"],
          providerReferences: { fake: "metered" },
        },
      ],
    };
    await testAccount(env.DB, accountId, now);
    await recordVerifiedTransaction(env.DB, {
      catalog: unlimitedCatalog,
      provider: "fake",
      accountId,
      expectedOfferKey: "lifetime",
      transaction: {
        providerTransactionId: crypto.randomUUID(),
        providerReference: "lifetime",
        kind: "oneTime",
        state: "active",
        purchasedAt: now,
        validFrom: now,
      },
      now,
    });

    const access = await readEffectiveAccess(env.DB, unlimitedCatalog, accountId, now);
    expect(access.snapshot.limits).toEqual([
      expect.objectContaining({
        maximum: "noCommercialLimit",
        period: null,
        used: 0,
      }),
    ]);
  });
});

describe("capability matching", () => {
  it("covers exactly the tier a bot.use grant names, and nothing wider", () => {
    const standard = { kind: "bot.use", tier: DEFAULT_BOT_TIER } as const;
    const advanced = { kind: "bot.use", tier: "advanced" } as const;
    expect(capabilityAllows(standard, standard)).toBe(true);
    // The grant a free profile holds must never reach a paid tier, which is the
    // whole reason there is no "every bot" grant.
    expect(capabilityAllows(standard, advanced)).toBe(false);
    expect(capabilityAllows(advanced, standard)).toBe(false);
  });

  it("matches an analysis type exactly, so an untyped grant covers untyped analysis only", () => {
    expect(capabilityAllows({ kind: "analysis.use" }, { kind: "analysis.use" })).toBe(true);
    expect(capabilityAllows({ kind: "analysis.use" }, { kind: "analysis.use", analysisType: "deep" })).toBe(false);
    expect(capabilityAllows({ kind: "analysis.use", analysisType: "deep" }, { kind: "analysis.use", analysisType: "deep" })).toBe(true);
  });
});

describe("catalog validation", () => {
  const provider = fakeCommerceProvider([{ providerReference: "product", displayPrice: "$1" }]);

  it("allows cosmetics-only commerce with no creation metric", () => {
    expect(() =>
      resolveCommerce({
        catalog: {
          free: {
            permissions: [{ kind: "game.create", access: "public" }],
          },
          entitlements: [
            {
              key: "supporter",
              content: [{ collection: "theme", id: "gold" }],
            },
          ],
          offers: [
            {
              key: "supporter",
              name: "Supporter",
              description: "Cosmetics",
              kind: "oneTime",
              entitlements: ["supporter"],
              providerReferences: { fake: "product" },
            },
          ],
          content: { theme: { gold: { classification: "cosmetic" } } },
        },
        providers: [provider],
      }),
    ).not.toThrow();
  });

  it("requires every bot.use grant to name a tier: standard, or one botTiers lists", () => {
    const withBots = (permissions: EngineAccessCapability[], botTiers?: Record<string, string>) => ({
      catalog: { free: { permissions }, entitlements: [], offers: [], ...(botTiers === undefined ? {} : { botTiers }) },
      providers: [provider],
    });
    expect(() => resolveCommerce(withBots([{ kind: "bot.use", tier: DEFAULT_BOT_TIER }]))).not.toThrow();
    expect(() => resolveCommerce(withBots([{ kind: "bot.use", tier: "advanced" }], { "bot-stockfish": "advanced" }))).not.toThrow();
    expect(() => resolveCommerce(withBots([{ kind: "bot.use", tier: "advanced" }]))).toThrow(/unknown bot tier advanced/);
    // Typed as required, but a catalog written as plain JavaScript can omit it.
    expect(() => resolveCommerce(withBots([{ kind: "bot.use" } as unknown as EngineAccessCapability]))).toThrow(/must name a tier/);
  });

  it("rejects subscription accounting on the free profile", () => {
    expect(() =>
      resolveCommerce({
        catalog: {
          free: {
            limits: [
              {
                metric: "analysis.run.success",
                maximum: 1,
                period: { kind: "subscriptionPeriod" },
              },
            ],
          },
          entitlements: [],
          offers: [],
        },
        providers: [],
      }),
    ).toThrow(/free grant cannot use a subscriptionPeriod/);
  });

  it("rejects subscription accounting granted by a one-time offer", () => {
    expect(() =>
      resolveCommerce({
        catalog: {
          free: {},
          entitlements: [
            {
              key: "pro",
              limits: [
                {
                  metric: "analysis.run.success",
                  maximum: 10,
                  period: { kind: "subscriptionPeriod" },
                },
              ],
            },
          ],
          offers: [
            {
              key: "pro_once",
              name: "Pro",
              description: "Invalid",
              kind: "oneTime",
              entitlements: ["pro"],
              providerReferences: { fake: "product" },
            },
          ],
        },
        providers: [provider],
      }),
    ).toThrow(/is not a subscription/);
  });
});
