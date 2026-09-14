import { createRoute, type z } from "@hono/zod-openapi";
import type { EngineApp, RouteContext } from "../engine.js";
import { HttpError } from "../http.js";
import { errorShape } from "../routes/wire.js";
import { readEffectiveAccess } from "./access.js";
import { assertPurchasable, readCheckout, readOpenCheckout, recordCheckout } from "./checkout.js";
import { readProviderAccount, recordProviderAccount, recordVerifiedEvent, recordVerifiedTransaction } from "./ledger.js";
import { acknowledgeIfNeeded } from "./provider-lifecycle.js";
import type { CommerceOffer, CommerceProvider } from "./types.js";
import { accessSnapshotShape, checkoutBodyShape, claimBodyShape, commerceCatalogShape, managementBodyShape, restoreBodyShape, urlShape } from "./wire.js";

const commerceErrors = {
  400: { content: { "application/json": { schema: errorShape } }, description: "Invalid commerce request" },
  401: { content: { "application/json": { schema: errorShape } }, description: "Missing or invalid token" },
  403: { content: { "application/json": { schema: errorShape } }, description: "A recoverable account or entitlement is required" },
  404: { content: { "application/json": { schema: errorShape } }, description: "Unknown offer or provider" },
  409: { content: { "application/json": { schema: errorShape } }, description: "Purchase is pending or conflicts with another account" },
  502: { content: { "application/json": { schema: errorShape } }, description: "The commerce provider could not verify the operation" },
} as const;

function commerce(ctx: RouteContext) {
  if (ctx.commerce === null) throw new HttpError(404, "Commerce is not enabled");
  return ctx.commerce;
}

function provider(ctx: RouteContext, key: string): CommerceProvider<unknown> {
  const found = commerce(ctx).providers.get(key);
  if (found === undefined) throw new HttpError(404, `Unknown commerce provider: ${key}`);
  return found;
}

function offer(ctx: RouteContext, key: string): CommerceOffer {
  const found = commerce(ctx).catalog.offers.find((candidate) => candidate.key === key);
  if (found === undefined) throw new HttpError(404, `Unknown commerce offer: ${key}`);
  return found;
}

function registeredProduct(offer: CommerceOffer, providerKey: string): string {
  const providerReference = offer.providerReferences[providerKey];
  if (providerReference === undefined) throw new HttpError(404, `Offer ${offer.key} is unavailable from ${providerKey}`);
  return providerReference;
}

function requireAccount(isAnonymous: boolean): void {
  if (isAnonymous) throw new HttpError(403, "Purchases require a recoverable account", "registrationRequired");
}

function trustedReturnUrl(ctx: RouteContext, env: unknown, requestUrl: string, value: string): string {
  const target = new URL(value);
  const requestOrigin = new URL(requestUrl).origin;
  if ((target.protocol !== "https:" && target.protocol !== "http:") || (target.origin !== requestOrigin && !ctx.clientOrigins(env).includes(target.origin))) {
    throw new HttpError(400, "returnUrl must use this deployment or a trusted client origin");
  }
  return target.toString();
}

async function providerCall<T>(message: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, message);
  }
}

async function snapshot(ctx: RouteContext, env: unknown, userId: string) {
  const resolved = commerce(ctx);
  const value = (await readEffectiveAccess(ctx.d1(env), resolved.catalog, userId, resolved.now())).snapshot;
  return {
    ...value,
    limits: value.limits.map((limit) => ({
      metric: limit.metric,
      maximum: limit.maximum === "noCommercialLimit" ? null : limit.maximum,
      noCommercialLimit: limit.maximum === "noCommercialLimit",
      period: limit.period?.kind ?? null,
      used: limit.used,
      remaining: limit.remaining,
      resetsAt: limit.resetsAt,
    })),
  };
}

async function claim(ctx: RouteContext, env: unknown, accountId: string, body: z.infer<typeof claimBodyShape>): Promise<void> {
  const resolved = commerce(ctx);
  const selectedOffer = offer(ctx, body.offerKey);
  const adapter = provider(ctx, body.provider);
  const expectedProviderReference = registeredProduct(selectedOffer, adapter.key);
  const transaction = await providerCall(`The ${adapter.key} provider could not verify this purchase`, async () => await adapter.verifyClaim(env, { accountId, expectedProviderReference, evidence: body.evidence }));
  const reference = await recordVerifiedTransaction(ctx.d1(env), {
    catalog: resolved.catalog,
    provider: adapter.key,
    accountId,
    expectedOfferKey: selectedOffer.key,
    transaction,
    now: resolved.now(),
  });
  if (transaction.state === "pending") throw new HttpError(409, "The purchase is still pending", "purchasePending");
  await providerCall(`The ${adapter.key} provider could not acknowledge this purchase`, async () => await acknowledgeIfNeeded(ctx.d1(env), adapter, env, reference, resolved.now));
}

export function registerCommerceRoutes(app: EngineApp, ctx: RouteContext): void {
  app.openapi(createRoute({ method: "get", path: "/commerce/catalog", operationId: "getCommerceCatalog", tags: ["Commerce"], responses: { 200: { content: { "application/json": { schema: commerceCatalogShape } }, description: "Registered offers and storefront products" }, ...commerceErrors } }), async (c) => {
    const resolved = commerce(ctx);
    const productDetails = new Map<string, { displayPrice: string; currencyCode?: string }>();
    await Promise.all(
      [...resolved.providers.values()].map(async (adapter) => {
        if (adapter.products === undefined) return;
        const ids = resolved.catalog.offers.flatMap((item) => (item.providerReferences[adapter.key] === undefined ? [] : [item.providerReferences[adapter.key]]));
        const products = await providerCall(`The ${adapter.key} provider could not load its products`, async () => (await adapter.products?.(c.env, ids)) ?? []);
        for (const item of products) productDetails.set(`${adapter.key}:${item.providerReference}`, item);
      }),
    );
    return c.json(
      {
        offers: resolved.catalog.offers.map((item) => ({
          key: item.key,
          name: item.name,
          description: item.description,
          kind: item.kind,
          entitlements: [...item.entitlements],
          repeatable: item.repeatable === true,
          products: Object.entries(item.providerReferences).map(([providerKey, providerReference]) => {
            const detail = productDetails.get(`${providerKey}:${providerReference}`);
            return { provider: providerKey, providerReference, displayPrice: detail?.displayPrice ?? null, currencyCode: detail?.currencyCode ?? null };
          }),
        })),
      },
      200,
    );
  });

  app.openapi(
    createRoute({ method: "get", path: "/commerce/access", operationId: "getCommerceAccess", tags: ["Commerce"], responses: { 200: { content: { "application/json": { schema: accessSnapshotShape } }, description: "Effective entitlements, capabilities, content, and limits" }, ...commerceErrors } }),
    async (c) => c.json(await snapshot(ctx, c.env, c.var.auth.user.id), 200),
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/commerce/claims",
      operationId: "claimCommercePurchase",
      tags: ["Commerce"],
      request: { body: { content: { "application/json": { schema: claimBodyShape } }, required: true } },
      responses: { 200: { content: { "application/json": { schema: accessSnapshotShape } }, description: "Purchase verified and effective access refreshed" }, ...commerceErrors },
    }),
    async (c) => {
      requireAccount(c.var.auth.claims.isAnonymous);
      await claim(ctx, c.env, c.var.auth.user.id, c.req.valid("json"));
      return c.json(await snapshot(ctx, c.env, c.var.auth.user.id), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/commerce/restore",
      operationId: "restoreCommercePurchases",
      tags: ["Commerce"],
      request: { body: { content: { "application/json": { schema: restoreBodyShape } }, required: true } },
      responses: { 200: { content: { "application/json": { schema: accessSnapshotShape } }, description: "Submitted purchases restored and effective access refreshed" }, ...commerceErrors },
    }),
    async (c) => {
      requireAccount(c.var.auth.claims.isAnonymous);
      for (const item of c.req.valid("json").claims) await claim(ctx, c.env, c.var.auth.user.id, item);
      return c.json(await snapshot(ctx, c.env, c.var.auth.user.id), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/commerce/checkout",
      operationId: "createCommerceCheckout",
      tags: ["Commerce"],
      request: { body: { content: { "application/json": { schema: checkoutBodyShape } }, required: true } },
      responses: { 200: { content: { "application/json": { schema: urlShape } }, description: "Provider-hosted checkout URL" }, ...commerceErrors },
    }),
    async (c) => {
      requireAccount(c.var.auth.claims.isAnonymous);
      const body = c.req.valid("json");
      const selectedOffer = offer(ctx, body.offerKey);
      const adapter = provider(ctx, body.provider);
      if (adapter.createCheckout === undefined) throw new HttpError(400, `${adapter.key} checkout is launched by its client SDK`);
      const accountId = c.var.auth.user.id;
      const d1 = ctx.d1(c.env);
      const returnUrl = trustedReturnUrl(ctx, c.env, c.req.url, body.returnUrl);
      const replay = await readCheckout(d1, adapter.key, accountId, body.operationId, selectedOffer.key, returnUrl);
      if (replay !== null) return c.json({ url: replay.url }, 200);
      if (selectedOffer.repeatable !== true) {
        const open = await readOpenCheckout(d1, adapter.key, accountId, selectedOffer.key, commerce(ctx).now());
        if (open !== null) return c.json({ url: open.url }, 200);
      }
      await assertPurchasable(d1, adapter.key, accountId, selectedOffer);
      const providerAccountId = await readProviderAccount(d1, adapter.key, accountId);
      const result = await providerCall(
        `The ${adapter.key} provider could not create checkout`,
        async () =>
          (await adapter.createCheckout?.(c.env, {
            accountId,
            offer: selectedOffer,
            providerReference: registeredProduct(selectedOffer, adapter.key),
            returnUrl,
            operationId: body.operationId,
            ...(providerAccountId === undefined ? {} : { providerAccountId }),
          })) as Awaited<ReturnType<NonNullable<typeof adapter.createCheckout>>>,
      );
      if (result.providerAccountId !== undefined) {
        await recordProviderAccount(d1, adapter.key, accountId, result.providerAccountId, commerce(ctx).now());
      }
      const recorded = await recordCheckout(d1, {
        provider: adapter.key,
        accountId,
        operationId: body.operationId,
        offerKey: selectedOffer.key,
        returnUrl,
        result,
        now: commerce(ctx).now(),
      });
      return c.json({ url: recorded.url }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/commerce/management",
      operationId: "createCommerceManagement",
      tags: ["Commerce"],
      request: { body: { content: { "application/json": { schema: managementBodyShape } }, required: true } },
      responses: { 200: { content: { "application/json": { schema: urlShape } }, description: "Provider-hosted subscription management URL" }, ...commerceErrors },
    }),
    async (c) => {
      requireAccount(c.var.auth.claims.isAnonymous);
      const body = c.req.valid("json");
      const adapter = provider(ctx, body.provider);
      if (adapter.management === undefined) throw new HttpError(400, `${adapter.key} does not expose hosted management`);
      const returnUrl = trustedReturnUrl(ctx, c.env, c.req.url, body.returnUrl);
      const providerAccountId = await readProviderAccount(ctx.d1(c.env), adapter.key, c.var.auth.user.id);
      if (providerAccountId === undefined) throw new HttpError(409, `This account has no ${adapter.key} customer to manage`, "purchaseConflict");
      return c.json(await providerCall(`The ${adapter.key} provider could not create management`, async () => (await adapter.management?.(c.env, c.var.auth.user.id, providerAccountId, returnUrl)) as { url: string }), 200);
    },
  );
}

/** Provider-authenticated notification surface, mounted outside Firebase. */
export function registerCommerceWebhookRoutes(app: EngineApp, ctx: RouteContext): void {
  app.post("/:provider/webhook", async (c) => {
    const resolved = commerce(ctx);
    const adapter = provider(ctx, c.req.param("provider"));
    if (adapter.verifyWebhook === undefined) {
      throw new HttpError(404, `The ${adapter.key} provider has no webhook`);
    }
    const event = await providerCall(`The ${adapter.key} webhook could not be verified`, async () => (await adapter.verifyWebhook?.(c.env, c.req.raw)) as Awaited<ReturnType<NonNullable<typeof adapter.verifyWebhook>>>);
    const reference = await recordVerifiedEvent(ctx.d1(c.env), {
      catalog: resolved.catalog,
      provider: adapter.key,
      event,
      now: resolved.now(),
    });
    if (reference !== null) {
      await providerCall(`The ${adapter.key} provider could not acknowledge this purchase`, async () => await acknowledgeIfNeeded(ctx.d1(c.env), adapter, c.env, reference, resolved.now));
    }
    return c.body(null, 204);
  });
}
