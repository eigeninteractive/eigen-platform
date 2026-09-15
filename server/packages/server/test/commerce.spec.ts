/** Commerce contract tests through the deployed Worker shape. */

import { env, exports } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { orm } from "../src/d1/orm.js";
import { bots, commerceEvents, commerceProviderAccounts, commerceTransactions, commerceUsage, entitlementGrants } from "../src/d1/schema.js";
import { createEngine } from "../src/engine.js";
import { testBearer as bearer, fakeCommerceProvider, testMutationHeaders as mutationHeaders, testFirebaseAdmin, testVerifier } from "../src/testing.js";
import { commerceProvider, contentForCreateArguments, productLookups, testGame } from "./worker.js";

const db = orm(env.DB);
const uid = (tag: string) => `${tag}-${crypto.randomUUID()}`;

async function api(userId: string, method: string, path: string, body?: unknown, anonymous = false): Promise<Response> {
  return await exports.default.fetch(`https://x/api/engine${path}`, {
    method,
    headers: method === "GET" ? await bearer({ uid: userId, anonymous }) : await mutationHeaders({ uid: userId, anonymous }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function json<T>(response: Response, status = 200): Promise<T> {
  expect(response.status).toBe(status);
  return (await response.json()) as T;
}

/**
 * An account a webhook is allowed to name.
 *
 * A provider learns an account id when an authenticated caller opens a
 * checkout, so by the time it notifies anyone the account exists — and the
 * ledger refuses to write for one that does not, so that an erasure is not
 * undone by a notification weeks later. Any authenticated request provisions
 * it, which is how a real client gets there too.
 */
async function provisioned(userId: string): Promise<string> {
  expect((await api(userId, "GET", "/commerce/access")).status).toBe(200);
  return userId;
}

function evidence(accountId: string, transactionId: string, providerReference: string, overrides: Record<string, unknown> = {}) {
  return { accountId, transactionId, providerReference, ...overrides };
}

describe("commerce catalog and access", () => {
  it("publishes stable offers with provider-localized price data", async () => {
    const response = await json<{
      offers: {
        key: string;
        kind: string;
        products: { provider: string; providerReference: string; displayPrice: string; currencyCode: string }[];
      }[];
    }>(await api(uid("catalog"), "GET", "/commerce/catalog"));

    expect(response.offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "supporter",
          kind: "oneTime",
          products: [
            {
              provider: "fake",
              providerReference: "supporter_once",
              displayPrice: "$4.99",
              currencyCode: "USD",
            },
            {
              provider: "fake_web",
              providerReference: "supporter_web",
              displayPrice: "$5.49",
              currencyCode: "USD",
            },
          ],
        }),
        expect.objectContaining({ key: "pro_monthly", kind: "subscription" }),
      ]),
    );
  });

  it("consults only the storefronts the caller can buy through", async () => {
    productLookups.length = 0;
    const response = await json<{ offers: { key: string; products: { provider: string }[] }[] }>(await api(uid("narrow"), "GET", "/commerce/catalog?provider=fake_web"));

    // Every other storefront's price lookup is a round trip to a payment API,
    // for a number this caller could not render, on a request a player waits on.
    expect(productLookups).toEqual(["fake_web"]);
    const supporter = response.offers.find((offer) => offer.key === "supporter");
    expect(supporter?.products.map((product) => product.provider)).toEqual(["fake_web"]);
    // The offer is still listed with nothing to buy it by, which a store screen
    // can explain. Hiding it would make it unexplainable.
    const pro = response.offers.find((offer) => offer.key === "pro_monthly");
    expect(pro?.products).toEqual([]);
  });

  it("serves the storefronts it has when a build names one it does not", async () => {
    productLookups.length = 0;
    const response = await json<{ offers: { key: string; products: { provider: string }[] }[] }>(await api(uid("partial"), "GET", "/commerce/catalog?provider=fake,apple_app_store"));

    // A build that knows about a storefront this deployment has not configured
    // should still be able to sell through the ones it has.
    expect(productLookups).toEqual(["fake"]);
    expect(response.offers.find((offer) => offer.key === "supporter")?.products.map((product) => product.provider)).toEqual(["fake"]);
  });

  it("says so when it has none of the storefronts a build named", async () => {
    // Silently returning an empty storefront would look like "nothing is for
    // sale" rather than "this deployment and this build disagree".
    const response = await api(uid("mismatch"), "GET", "/commerce/catalog?provider=apple_app_store");
    expect(response.status).toBe(404);
  });

  it("returns the free profile before any purchase", async () => {
    const access = await json<{
      entitlements: unknown[];
      permissions: { kind: string; access?: string }[];
      content: unknown[];
      limits: unknown[];
    }>(await api(uid("free"), "GET", "/commerce/access"));

    expect(access.entitlements).toEqual([]);
    expect(access.content).toEqual([]);
    expect(access.limits).toEqual([]);
    expect(access.permissions).toEqual(
      expect.arrayContaining([
        { kind: "game.create", access: "public" },
        { kind: "game.create", access: "friends" },
        { kind: "game.create", access: "private" },
      ]),
    );
  });

  it("keeps commerce self-service reachable behind paid app access", async () => {
    const gated = createEngine({
      gameModule: testGame,
      appName: "Gated Test",
      d1: (workerEnv: Cloudflare.Env) => workerEnv.DB,
      gameDO: (workerEnv: Cloudflare.Env) => workerEnv.GAME_DO,
      testing: {
        auth: testVerifier(),
        firebaseAdmin: () => testFirebaseAdmin,
      },
      commerce: {
        catalog: {
          free: {},
          entitlements: [{ key: "full", permissions: [{ kind: "app.access" }] }],
          offers: [{ key: "full", name: "Full game", description: "Application access", kind: "oneTime", entitlements: ["full"], providerReferences: { fake: "full_once" } }],
        },
        providers: [fakeCommerceProvider([{ providerReference: "full_once", displayPrice: "$4.99" }])],
      },
    });
    const accountId = uid("app-gate");
    const fetch = async (method: string, path: string, body?: unknown) =>
      await gated.fetch?.(
        new Request(`https://gated.test/api/engine${path}`, {
          method,
          headers: method === "GET" ? await bearer({ uid: accountId }) : await mutationHeaders({ uid: accountId }),
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
        env,
        {} as ExecutionContext,
      );

    expect((await fetch("GET", "/me"))?.status).toBe(403);
    expect((await fetch("GET", "/commerce/access"))?.status).toBe(200);
    const deletionAccount = uid("app-gate-delete");
    const deletion = await gated.fetch?.(
      new Request("https://gated.test/api/engine/me", {
        method: "DELETE",
        headers: await mutationHeaders({ uid: deletionAccount }),
      }),
      env,
      {} as ExecutionContext,
    );
    expect(deletion?.status).toBe(204);
    expect(
      (
        await fetch("POST", "/commerce/claims", {
          provider: "fake",
          offerKey: "full",
          evidence: evidence(accountId, crypto.randomUUID(), "full_once"),
        })
      )?.status,
    ).toBe(200);
    expect((await fetch("GET", "/me"))?.status).toBe(200);
  });
});

describe("purchase claims", () => {
  it("requires a recoverable account", async () => {
    const accountId = uid("guest");
    const response = await api(
      accountId,
      "POST",
      "/commerce/claims",
      {
        provider: "fake",
        offerKey: "supporter",
        evidence: evidence(accountId, crypto.randomUUID(), "supporter_once"),
      },
      true,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "registrationRequired" });
  });

  it("activates a verified one-time purchase idempotently", async () => {
    const accountId = uid("supporter");
    const transactionId = crypto.randomUUID();
    const body = {
      provider: "fake",
      offerKey: "supporter",
      evidence: evidence(accountId, transactionId, "supporter_once"),
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      const access = await json<{
        entitlements: { key: string }[];
        content: { collection: string; id: string }[];
      }>(await api(accountId, "POST", "/commerce/claims", body));
      expect(access.entitlements).toEqual([expect.objectContaining({ key: "supporter" })]);
      expect(access.content).toContainEqual({ collection: "board_theme", id: "supporter_gold" });
    }

    const transactions = await db
      .select()
      .from(commerceTransactions)
      .where(and(eq(commerceTransactions.provider, "fake"), eq(commerceTransactions.providerTransactionId, transactionId)))
      .all();
    expect(transactions).toHaveLength(1);
    const grants = await db
      .select()
      .from(entitlementGrants)
      .where(eq(entitlementGrants.sourceTransactionId, transactions[0]?.id as string))
      .all();
    expect(grants).toHaveLength(1);
  });

  it("converges concurrent duplicate claims without a unique-race failure", async () => {
    const accountId = uid("concurrent-supporter");
    const transactionId = crypto.randomUUID();
    const body = {
      provider: "fake",
      offerKey: "supporter",
      evidence: evidence(accountId, transactionId, "supporter_once"),
    };
    const responses = await Promise.all([api(accountId, "POST", "/commerce/claims", body), api(accountId, "POST", "/commerce/claims", body)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await db.select().from(commerceTransactions).where(eq(commerceTransactions.providerTransactionId, transactionId)).all()).toHaveLength(1);
  });

  it("keeps pending purchases inactive and later applies their verified update", async () => {
    const accountId = uid("pending");
    const transactionId = crypto.randomUUID();
    const pending = await api(accountId, "POST", "/commerce/claims", {
      provider: "fake",
      offerKey: "pro_monthly",
      evidence: evidence(accountId, transactionId, "pro_monthly", {
        state: "pending",
      }),
    });
    expect(pending.status).toBe(409);
    expect(await pending.json()).toMatchObject({ code: "purchasePending" });

    const before = await json<{ entitlements: { key: string }[] }>(await api(accountId, "GET", "/commerce/access"));
    expect(before.entitlements).toEqual([]);

    const now = Date.now();
    const active = await json<{
      entitlements: { key: string; validUntil: number }[];
      permissions: { kind: string }[];
      limits: { metric: string; resetsAt: number }[];
    }>(
      await api(accountId, "POST", "/commerce/claims", {
        provider: "fake",
        offerKey: "pro_monthly",
        evidence: evidence(accountId, transactionId, "pro_monthly", {
          state: "active",
          validFrom: now,
          validUntil: now + 30 * 24 * 60 * 60 * 1000,
        }),
      }),
    );
    expect(active.entitlements).toEqual([expect.objectContaining({ key: "pro" })]);
    expect(active.permissions).toContainEqual({ kind: "analysis.use" });
    expect(active.limits).toEqual([
      expect.objectContaining({
        metric: "analysis.run.success",
        maximum: 100,
        used: 0,
        remaining: 100,
        resetsAt: now + 30 * 24 * 60 * 60 * 1000,
      }),
    ]);
  });

  it("does not let a verified transaction move to another account", async () => {
    const first = uid("owner");
    const second = uid("other");
    const transactionId = crypto.randomUUID();
    await json(
      await api(first, "POST", "/commerce/claims", {
        provider: "fake",
        offerKey: "supporter",
        evidence: evidence(first, transactionId, "supporter_once"),
      }),
    );

    const response = await api(second, "POST", "/commerce/claims", {
      provider: "fake",
      offerKey: "supporter",
      evidence: evidence(second, transactionId, "supporter_once"),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "purchaseConflict" });
  });

  it("maps unverifiable client evidence to a provider failure", async () => {
    const accountId = uid("invalid");
    const response = await api(accountId, "POST", "/commerce/claims", {
      provider: "fake",
      offerKey: "supporter",
      evidence: { accountId, transactionId: crypto.randomUUID(), providerReference: "forged" },
    });
    expect(response.status).toBe(502);
  });

  it("restores multiple verified purchases into one effective snapshot", async () => {
    const accountId = uid("restore");
    const now = Date.now();
    const access = await json<{
      entitlements: { key: string }[];
      content: { collection: string; id: string }[];
      permissions: { kind: string }[];
    }>(
      await api(accountId, "POST", "/commerce/restore", {
        claims: [
          {
            provider: "fake",
            offerKey: "supporter",
            evidence: evidence(accountId, crypto.randomUUID(), "supporter_once"),
          },
          {
            provider: "fake",
            offerKey: "pro_monthly",
            evidence: evidence(accountId, crypto.randomUUID(), "pro_monthly", {
              validFrom: now,
              validUntil: now + 100_000,
            }),
          },
        ],
      }),
    );
    expect(access.entitlements.map((item) => item.key).sort()).toEqual(["pro", "supporter"]);
    expect(access.content).toContainEqual({ collection: "board_theme", id: "supporter_gold" });
    expect(access.permissions).toContainEqual({ kind: "analysis.use" });
  });

  it("creates hosted URLs only for trusted return origins", async () => {
    const accountId = uid("hosted");
    const checkout = await json<{ url: string }>(
      await api(accountId, "POST", "/commerce/checkout", {
        provider: "fake",
        offerKey: "supporter",
        returnUrl: "https://app.example/store/complete",
        operationId: crypto.randomUUID(),
      }),
    );
    expect(new URL(checkout.url).origin).toBe("https://checkout.example");

    const management = await json<{ url: string }>(
      await api(accountId, "POST", "/commerce/management", {
        provider: "fake",
        returnUrl: "https://x/settings/billing",
      }),
    );
    expect(new URL(management.url).origin).toBe("https://checkout.example");

    const denied = await api(accountId, "POST", "/commerce/checkout", {
      provider: "fake",
      offerKey: "supporter",
      returnUrl: "https://evil.example/phish",
      operationId: crypto.randomUUID(),
    });
    expect(denied.status).toBe(400);
  });

  it("replays one operation identity instead of opening a second session", async () => {
    const accountId = uid("checkout-replay");
    const operationId = crypto.randomUUID();
    const body = { provider: "fake", offerKey: "supporter", returnUrl: "https://app.example/store/complete", operationId };

    const first = await json<{ url: string }>(await api(accountId, "POST", "/commerce/checkout", body));
    const again = await json<{ url: string }>(await api(accountId, "POST", "/commerce/checkout", body));
    expect(again.url).toBe(first.url);

    // Same identity, different intent: refused, rather than quietly charging
    // for something other than what the first attempt opened.
    const changed = await api(accountId, "POST", "/commerce/checkout", { ...body, returnUrl: "https://app.example/store/other" });
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({ code: "purchaseConflict" });
  });

  it("reuses an open session for a non-repeatable offer under a new identity", async () => {
    const accountId = uid("checkout-open");
    const body = { provider: "fake", offerKey: "supporter", returnUrl: "https://app.example/store/complete" };

    const first = await json<{ url: string }>(await api(accountId, "POST", "/commerce/checkout", { ...body, operationId: crypto.randomUUID() }));
    // A player who taps buy twice gets the session already waiting for them,
    // not a second one they could pay twice.
    const second = await json<{ url: string }>(await api(accountId, "POST", "/commerce/checkout", { ...body, operationId: crypto.randomUUID() }));
    expect(second.url).toBe(first.url);
  });

  it("refuses checkout for a non-repeatable offer this account already owns", async () => {
    const accountId = uid("checkout-owned");
    await json(
      await api(accountId, "POST", "/commerce/claims", {
        provider: "fake",
        offerKey: "supporter",
        evidence: evidence(accountId, crypto.randomUUID(), "supporter_once"),
      }),
    );

    const denied = await api(accountId, "POST", "/commerce/checkout", {
      provider: "fake",
      offerKey: "supporter",
      returnUrl: "https://app.example/store/complete",
      operationId: crypto.randomUUID(),
    });
    expect(denied.status).toBe(409);
    expect(await denied.json()).toMatchObject({ code: "purchaseConflict" });
  });

  it("binds one provider customer per account and refuses a second", async () => {
    const accountId = uid("checkout-customer");
    await json(
      await api(accountId, "POST", "/commerce/checkout", {
        provider: "fake",
        offerKey: "supporter",
        returnUrl: "https://app.example/store/complete",
        operationId: crypto.randomUUID(),
      }),
    );

    const bound = await db.select().from(commerceProviderAccounts).where(eq(commerceProviderAccounts.userId, accountId)).get();
    expect(bound?.providerAccountId).toBe(`fake:${accountId}`);

    // Management resolves through that binding rather than asking the client.
    const management = await json<{ url: string }>(await api(accountId, "POST", "/commerce/management", { provider: "fake", returnUrl: "https://x/settings/billing" }));
    expect(new URL(management.url).searchParams.get("customer")).toBe(`fake:${accountId}`);

    // A provider that reports a different customer for the same account is a
    // confusion that must not silently rebind a paying user's purchases.
    commerceProvider.reportProviderAccount("fake:someone-else");
    const rebind = await api(accountId, "POST", "/commerce/checkout", {
      provider: "fake",
      offerKey: "pro_monthly",
      returnUrl: "https://app.example/store/complete",
      operationId: crypto.randomUUID(),
    });
    expect(rebind.status).toBe(409);
    expect(await rebind.json()).toMatchObject({ code: "purchaseConflict" });
  });
});

describe("provider webhooks", () => {
  it("authenticates in the adapter, deduplicates events, and applies revocation", async () => {
    const accountId = await provisioned(uid("webhook"));
    const transactionId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const notification = {
      eventId,
      accountId,
      transactionId,
      providerReference: "supporter_once",
      state: "active",
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await exports.default.fetch("https://x/api/commerce/fake/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(notification),
      });
      expect(response.status).toBe(204);
    }

    const events = await db.select().from(commerceEvents).where(eq(commerceEvents.providerEventId, eventId)).all();
    expect(events).toHaveLength(1);
    expect(events[0]?.processedAt).not.toBeNull();

    const active = await json<{ entitlements: { key: string }[] }>(await api(accountId, "GET", "/commerce/access"));
    expect(active.entitlements).toEqual([expect.objectContaining({ key: "supporter" })]);

    const revoked = await exports.default.fetch("https://x/api/commerce/fake/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...notification,
        eventId: crypto.randomUUID(),
        state: "revoked",
      }),
    });
    expect(revoked.status).toBe(204);
    const after = await json<{ entitlements: unknown[] }>(await api(accountId, "GET", "/commerce/access"));
    expect(after.entitlements).toEqual([]);
  });

  it("rejects malformed notification evidence without Firebase auth", async () => {
    const response = await exports.default.fetch("https://x/api/commerce/fake/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: crypto.randomUUID() }),
    });
    expect(response.status).toBe(502);
  });
});

describe("snapshotted content ownership", () => {
  async function becomeSupporter(accountId: string): Promise<void> {
    await json(
      await api(accountId, "POST", "/commerce/claims", {
        provider: "fake",
        offerKey: "supporter",
        evidence: evidence(accountId, crypto.randomUUID(), "supporter_once"),
      }),
    );
  }

  it("checks creator-owned shared content before game creation", async () => {
    const accountId = uid("variant-owner");
    const body = {
      creationId: crypto.randomUUID(),
      access: "public",
      schemaVersion: 1,
      config: { target: 3, premiumVariant: true },
      minPlayers: 2,
      maxPlayers: 2,
      rated: false,
    };
    const denied = await api(accountId, "POST", "/games", body);
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: "contentRequired" });

    await becomeSupporter(accountId);
    expect((await api(accountId, "POST", "/games", body)).status).toBe(201);
  });

  it("checks each-participant content against the immutable game snapshot", async () => {
    const host = uid("content-host");
    const guest = uid("content-guest");
    await becomeSupporter(host);
    const created = await json<{ gameId: string }>(
      await api(host, "POST", "/games", {
        creationId: crypto.randomUUID(),
        access: "public",
        schemaVersion: 1,
        config: { target: 3, participantTheme: true },
        minPlayers: 2,
        maxPlayers: 2,
        rated: false,
      }),
      201,
    );

    const denied = await api(guest, "POST", `/games/${created.gameId}/join`, {
      clientSchemaVersion: 1,
    });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: "contentRequired" });

    await becomeSupporter(guest);
    expect(
      (
        await api(guest, "POST", `/games/${created.gameId}/join`, {
          clientSchemaVersion: 1,
        })
      ).status,
    ).toBe(200);
  });

  it("checks viewer-owned content only when a finished game is replayed", async () => {
    const host = uid("viewer-host");
    const guest = uid("viewer-player");
    const viewer = uid("viewer-reader");
    const created = await json<{ gameId: string }>(
      await api(host, "POST", "/games", {
        creationId: crypto.randomUUID(),
        access: "public",
        schemaVersion: 1,
        config: { target: 3, viewerTheme: true },
        minPlayers: 2,
        maxPlayers: 2,
        rated: false,
      }),
      201,
    );
    await json(await api(guest, "POST", `/games/${created.gameId}/join`, { clientSchemaVersion: 1 }));
    await json(await api(host, "POST", `/games/${created.gameId}/start`, {}));
    await json(await api(host, "POST", `/games/${created.gameId}/action`, { seat: 0, data: { add: 2 }, expectedVersion: 0 }));
    await json(await api(guest, "POST", `/games/${created.gameId}/action`, { seat: 1, data: { add: 2 }, expectedVersion: 1 }));

    await expect.poll(async () => (await api(host, "GET", `/games/${created.gameId}`)).json()).toMatchObject({ status: "finished" });

    const denied = await api(viewer, "GET", `/games/${created.gameId}/frames?from=0&to=10`);
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: "contentRequired" });

    await becomeSupporter(viewer);
    expect((await api(viewer, "GET", `/games/${created.gameId}/frames?from=0&to=10`)).status).toBe(200);
  });
});

describe("offline play", () => {
  /** A deployment that meters server creation tightly, so an exemption is
   * visible as an exemption rather than as an absent limit. */
  function meteredEngine() {
    return createEngine({
      gameModule: testGame,
      appName: "Metered Test",
      d1: (workerEnv: Cloudflare.Env) => workerEnv.DB,
      gameDO: (workerEnv: Cloudflare.Env) => workerEnv.GAME_DO,
      testing: { auth: testVerifier(), firebaseAdmin: () => testFirebaseAdmin },
      commerce: {
        catalog: {
          free: {
            permissions: [{ kind: "game.create", access: "private" }, { kind: "bot.use" }],
            limits: [{ metric: "game.create.success", maximum: 1, period: { kind: "calendarMonth", timezone: "UTC" } }],
          },
          entitlements: [],
          offers: [],
        },
        providers: [fakeCommerceProvider([])],
      },
    });
  }

  const LOCAL_BOT = "offline-exempt-bot";

  it("imports a device's finished game with the creation allowance already spent", async () => {
    await db.insert(bots).values({ id: LOCAL_BOT, username: LOCAL_BOT, displayName: "Local Brain", avatarUrl: null, schemaVersion: 1, type: "local", webhookUrl: null, ratedEligible: false, config: {}, createdAt: Date.now() }).onConflictDoNothing();

    const engine = meteredEngine();
    const accountId = uid("offline-exempt");
    const fetch = async (method: string, path: string, body?: unknown) =>
      await engine.fetch?.(
        new Request(`https://metered.test/api/engine${path}`, {
          method,
          headers: method === "GET" ? await bearer({ uid: accountId }) : await mutationHeaders({ uid: accountId }),
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
        env,
        {} as ExecutionContext,
      );

    const onlineBody = { access: "private", schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, rated: false };
    expect((await fetch("POST", "/games", { creationId: crypto.randomUUID(), ...onlineBody }))?.status).toBe(201);

    // The month's one server creation is now spent.
    const exhausted = await fetch("POST", "/games", { creationId: crypto.randomUUID(), ...onlineBody });
    expect(exhausted?.status).toBe(403);
    expect(await exhausted?.json()).toMatchObject({ code: "commercialLimitReached" });

    // The device played this one offline; the allowance it never used cannot
    // retroactively refuse the history. It also takes no creationId: the
    // device's own gameId is the whole identity.
    const imported = await fetch("POST", "/games/local", {
      gameId: crypto.randomUUID(),
      schemaVersion: 1,
      config: { target: 3 },
      minPlayers: 2,
      maxPlayers: 2,
      botIds: [LOCAL_BOT],
      seed: "00112233445566778899aabbccddeeff",
      createdAt: Date.now() - 3_600_000,
    });
    expect(imported?.status).toBe(201);

    // And it consumed nothing: the single row is the online create's.
    const uses = await db.select().from(commerceUsage).where(eq(commerceUsage.userId, accountId)).all();
    expect(uses).toHaveLength(1);
    expect(uses[0]?.metric).toBe("game.create.success");
  });
});

/**
 * The two boundaries commerce must never cross.
 *
 * Both are invariants rather than features, which is why they are tested at
 * all: nothing in the shape of the code stops a later change from quietly
 * violating either, and neither would announce itself when broken.
 */
describe("erasure outlives the provider", () => {
  it("does not let a late notification undo an account deletion", async () => {
    // A cancellation or a final renewal can arrive weeks after the player
    // asked to be forgotten. Writing it would put their user id, and a grant,
    // back into the ledger.
    const accountId = await provisioned(uid("erased"));
    const transactionId = crypto.randomUUID();
    const notify = async (state: string, eventId: string) =>
      await exports.default.fetch("https://x/api/commerce/fake/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, accountId, transactionId, providerReference: "supporter_once", state }),
      });

    expect((await notify("active", crypto.randomUUID())).status).toBe(204);
    expect((await api(accountId, "DELETE", "/me")).status).toBe(204);

    const late = await notify("revoked", crypto.randomUUID());
    // Accepted, not refused: a 5xx would have the provider redelivering this
    // for days, and the account is never coming back.
    expect(late.status).toBe(204);

    expect(await db.select().from(entitlementGrants).where(eq(entitlementGrants.userId, accountId)).all()).toEqual([]);
    const transaction = await db.select().from(commerceTransactions).where(eq(commerceTransactions.providerTransactionId, transactionId)).get();
    expect(transaction?.userId).toBeNull();
    expect(transaction?.sealedProviderState).toBeNull();
  });

  it("refuses a first notification for an account that never existed", async () => {
    // The same guard, from the other direction: a webhook naming an unknown
    // account must not conjure a ledger row for it.
    const accountId = uid("never-existed");
    const transactionId = crypto.randomUUID();
    const response = await exports.default.fetch("https://x/api/commerce/fake/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: crypto.randomUUID(), accountId, transactionId, providerReference: "supporter_once", state: "active" }),
    });

    expect(response.status).toBe(204);
    expect(await db.select().from(commerceTransactions).where(eq(commerceTransactions.providerTransactionId, transactionId)).all()).toEqual([]);
    expect(await db.select().from(entitlementGrants).where(eq(entitlementGrants.userId, accountId)).all()).toEqual([]);
  });
});

describe("boundaries commerce must not cross", () => {
  it("cannot raise an abuse ceiling, however much the account has paid", async () => {
    const accountId = uid("ceiling");
    const engine = createEngine({
      gameModule: testGame,
      appName: "Ceiling Test",
      d1: (workerEnv: Cloudflare.Env) => workerEnv.DB,
      gameDO: (workerEnv: Cloudflare.Env) => workerEnv.GAME_DO,
      testing: { auth: testVerifier(), firebaseAdmin: () => testFirebaseAdmin },
      commerce: {
        catalog: {
          // The most generous commercial policy this engine can express.
          free: {
            permissions: [{ kind: "game.create", access: "public" }],
            limits: [{ metric: "game.create.success", maximum: "noCommercialLimit" }],
          },
          entitlements: [],
          offers: [],
        },
        providers: [fakeCommerceProvider([])],
      },
    });

    // A limiter that refuses everything, standing in for an account that has
    // genuinely been hammering the endpoint.
    const refusing = { limit: async () => ({ success: false }) };
    const response = await engine.fetch?.(
      new Request("https://ceiling.test/api/engine/games", {
        method: "POST",
        headers: await mutationHeaders({ uid: accountId }),
        body: JSON.stringify({ creationId: crypto.randomUUID(), access: "public", schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, rated: false }),
      }),
      { ...env, EIGEN_RATE_LIMIT_GAME_CREATE: refusing } as Cloudflare.Env,
      {} as ExecutionContext,
    );

    // `noCommercialLimit` means no PLAN restriction. It has never meant
    // unbounded infrastructure, and a purchase that could buy its way past the
    // abuse limiter would make the limiter worthless.
    expect(response?.status).toBe(429);
    expect(await response?.json()).toMatchObject({ code: "rateLimited" });
  });

  it("expiring an entitlement changes nothing about a game already created under it", async () => {
    const accountId = await provisioned(uid("expiry-holder"));
    const transactionId = crypto.randomUUID();
    const webhook = async (state: string) =>
      await exports.default.fetch("https://x/api/commerce/fake/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: crypto.randomUUID(), accountId, transactionId, providerReference: "supporter_once", state }),
      });

    expect((await webhook("active")).status).toBe(204);
    // A game using the paid variant, created while the entitlement was live.
    const created = await json<{ gameId: string }>(
      await api(accountId, "POST", "/games", {
        creationId: crypto.randomUUID(),
        access: "public",
        schemaVersion: 1,
        config: { target: 3, premiumVariant: true },
        minPlayers: 2,
        maxPlayers: 2,
        rated: false,
      }),
      201,
    );

    expect((await webhook("revoked")).status).toBe(204);
    expect((await json<{ entitlements: unknown[] }>(await api(accountId, "GET", "/commerce/access"))).entitlements).toEqual([]);

    // Expiry governs NEW protected operations, never committed history. The
    // game is not cancelled, still reads back, and still carries the content
    // it was created with -- a snapshot, not a live entitlement lookup.
    const game = await json<{ status: string; participants: { userId: string | null }[] }>(await api(accountId, "GET", `/games/${created.gameId}`));
    expect(game.status).toBe("waiting");
    expect(game.participants.map((seat) => seat.userId)).toContain(accountId);

    // What expiry DOES stop is the next one.
    const denied = await api(accountId, "POST", "/games", {
      creationId: crypto.randomUUID(),
      access: "public",
      schemaVersion: 1,
      config: { target: 3, premiumVariant: true },
      minPlayers: 2,
      maxPlayers: 2,
      rated: false,
    });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: "contentRequired" });
  });

  it("mounts no commerce surface, and enforces no commercial policy, when commerce is absent", async () => {
    const accountId = uid("no-commerce");
    const plain = createEngine({
      gameModule: testGame,
      appName: "No Commerce Test",
      d1: (workerEnv: Cloudflare.Env) => workerEnv.DB,
      gameDO: (workerEnv: Cloudflare.Env) => workerEnv.GAME_DO,
      testing: { auth: testVerifier(), firebaseAdmin: () => testFirebaseAdmin },
    });
    const fetch = async (method: string, path: string, body?: unknown) =>
      await plain.fetch?.(
        new Request(`https://plain.test/api/engine${path}`, {
          method,
          headers: method === "GET" ? await bearer({ uid: accountId }) : await mutationHeaders({ uid: accountId }),
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
        env,
        {} as ExecutionContext,
      );

    // Opting out is not a degraded mode: creation works, with no catalog, no
    // provider, and no credential anywhere in the deployment.
    expect((await fetch("POST", "/games", { creationId: crypto.randomUUID(), access: "public", schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, rated: false }))?.status).toBe(201);
    // And the routes are not merely empty, they are absent.
    expect((await fetch("GET", "/commerce/catalog"))?.status).toBe(404);
    expect((await fetch("GET", "/commerce/access"))?.status).toBe(404);
  });

  it("never hands authoritative rules an entitlement, an access decision, or provider state", async () => {
    const accountId = uid("rules-isolation");
    // Give the account real commerce state first, so the assertion is about
    // what the hook is SHOWN rather than about there being nothing to show.
    await json(
      await api(accountId, "POST", "/commerce/claims", {
        provider: "fake",
        offerKey: "supporter",
        evidence: evidence(accountId, crypto.randomUUID(), "supporter_once"),
      }),
    );

    const before = contentForCreateArguments.length;
    await json(
      await api(accountId, "POST", "/games", {
        creationId: crypto.randomUUID(),
        access: "public",
        schemaVersion: 1,
        config: { target: 3, premiumVariant: true },
        minPlayers: 2,
        maxPlayers: 2,
        rated: false,
      }),
      201,
    );

    const seen = contentForCreateArguments.slice(before);
    expect(seen.length).toBeGreaterThan(0);
    for (const argument of seen) {
      // Exactly the validated creation input, and nothing else. A rule that
      // could read a purchase is a rule that can be bought, which is the one
      // thing this whole model refuses to allow.
      expect(Object.keys(argument).sort()).toEqual(["config"]);
    }
  });
});
