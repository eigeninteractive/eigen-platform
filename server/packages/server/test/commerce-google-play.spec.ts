/**
 * The Google Play adapter against a scripted Play Developer API.
 *
 * The risks here are the ones Play's refund policy creates: an acknowledgement
 * that never happens loses the purchase after three days, and an
 * acknowledgement that happens before the grant is durable loses it the other
 * way. So the adapter must report `requiresAcknowledgement` honestly, carry the
 * purchase token forward so the engine can retry, and never put that token
 * anywhere a log would see it.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCommerce } from "../src/commerce/catalog.js";
import { ProviderRefusal } from "../src/commerce/provider-kit.js";
import { googlePlayCommerceProvider, googlePlaySubscriptionReference } from "../src/commerce/providers/google-play.js";

// A throwaway PKCS#8 RSA key, generated for this test and used nowhere else:
// the adapter signs a service-account assertion with it, so the test needs a
// real key to prove the OAuth exchange happens at all.
let cachedKey: string | null = null;
async function testPrivateKey(): Promise<string> {
  if (cachedKey !== null) return cachedKey;
  const pair = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
  const base64 = btoa(String.fromCharCode(...pkcs8)).replace(/(.{64})/g, "$1\n");
  cachedKey = `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;
  return cachedKey;
}

function makeProviderSync() {
  return googlePlayCommerceProvider<unknown>({ packageName: () => "com.example.game", serviceAccountEmail: () => undefined, serviceAccountPrivateKey: () => undefined });
}

async function makeProvider() {
  return googlePlayCommerceProvider<unknown>({
    packageName: () => "com.example.game",
    serviceAccountEmail: () => "svc@example.iam.gserviceaccount.com",
    serviceAccountPrivateKey: () => cachedKey as string,
    now: () => 1_700_000_000_000,
  });
}

function scriptFetch(routes: Record<string, unknown>): { seen: string[]; tokenCalls: number } {
  const state = { seen: [] as string[], tokenCalls: 0 };
  vi.stubGlobal("fetch", async (request: Request) => {
    const url = new URL(request.url);
    if (url.hostname === "oauth2.googleapis.com") {
      state.tokenCalls += 1;
      return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }), { headers: { "content-type": "application/json" } });
    }
    state.seen.push(`${request.method} ${url.pathname}`);
    const body = routes[url.pathname];
    if (body === undefined) return new Response("not found", { status: 404 });
    if (body === null) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  });
  return state;
}

const PRODUCT_PATH = "/androidpublisher/v3/applications/com.example.game/purchases/productsv2/tokens/tok_1";
const PRODUCT_ACKNOWLEDGE_PATH = "/androidpublisher/v3/applications/com.example.game/purchases/products/supporter_once/tokens/tok_1:acknowledge";
const SUBSCRIPTION_PATH = "/androidpublisher/v3/applications/com.example.game/purchases/subscriptionsv2/tokens/tok_sub";

/** A `productsv2` purchase of one product. */
const productPurchase = (purchaseState: string, overrides: Record<string, unknown> = {}) => ({
  productLineItem: [{ productId: "supporter_once", productOfferDetails: { quantity: 1, refundableQuantity: 1 } }],
  purchaseStateContext: { purchaseState },
  acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  purchaseCompletionTime: "2023-11-03T08:26:40Z",
  orderId: "GPA.1",
  obfuscatedExternalAccountId: "alice",
  ...overrides,
});

const notify = (notification: Record<string, unknown>, messageId = "msg-1") => new Request("https://x/rtdn", { method: "POST", body: JSON.stringify({ message: { data: btoa(JSON.stringify({ packageName: "com.example.game", ...notification })), messageId } }) });

afterEach(() => vi.unstubAllGlobals());

describe("google play one-time purchases", () => {
  it("reports an unacknowledged purchase as needing acknowledgement, carrying its token", async () => {
    await testPrivateKey();
    scriptFetch({ [PRODUCT_PATH]: productPurchase("PURCHASED", { acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING" }) });
    const provider = await makeProvider();
    const verified = await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { purchaseToken: "tok_1" } });
    // The token, not the order id: a pending purchase has no order yet, and
    // the transaction must be the same row before and after it is paid.
    expect(verified).toMatchObject({ providerTransactionId: "tok_1", providerReference: "supporter_once", kind: "oneTime", state: "active", purchasedAt: Date.parse("2023-11-03T08:26:40Z"), requiresAcknowledgement: true });
    expect(JSON.parse(verified.sealedProviderState as string)).toEqual({ kind: "oneTime", token: "tok_1" });
  });

  it.each([
    ["PURCHASED", "active"],
    ["PENDING", "pending"],
    ["CANCELLED", "revoked"],
  ])("maps %s onto %s", async (purchaseState, expected) => {
    await testPrivateKey();
    scriptFetch({ [PRODUCT_PATH]: productPurchase(purchaseState) });
    const verified = await (await makeProvider()).verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { purchaseToken: "tok_1" } });
    expect(verified.state).toBe(expected);
    expect(verified.requiresAcknowledgement).toBe(false);
  });

  it("reports the product Play says was bought, not the one the claim named", async () => {
    await testPrivateKey();
    scriptFetch({ [PRODUCT_PATH]: productPurchase("PURCHASED", { productLineItem: [{ productId: "supporter_plus" }] }) });
    const verified = await (await makeProvider()).verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { purchaseToken: "tok_1" } });
    expect(verified.providerReference).toBe("supporter_plus");
  });

  it("refuses a purchase of several products, which no one offer describes", async () => {
    await testPrivateKey();
    scriptFetch({ [PRODUCT_PATH]: productPurchase("PURCHASED", { productLineItem: [{ productId: "supporter_once" }, { productId: "supporter_plus" }] }) });
    await expect((await makeProvider()).verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { purchaseToken: "tok_1" } })).rejects.toThrow(ProviderRefusal);
  });

  it("refuses a token minted against another player's account", async () => {
    await testPrivateKey();
    scriptFetch({ [PRODUCT_PATH]: productPurchase("PURCHASED", { obfuscatedExternalAccountId: "mallory" }) });
    const provider = await makeProvider();
    await expect(provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { purchaseToken: "tok_1" } })).rejects.toThrow(/another account/);
  });

  it("acknowledges through the v1 product path and reuses one access token", async () => {
    await testPrivateKey();
    const state = scriptFetch({ [PRODUCT_ACKNOWLEDGE_PATH]: null, [PRODUCT_PATH]: productPurchase("PURCHASED", { acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING" }) });
    const provider = await makeProvider();
    await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { purchaseToken: "tok_1" } });
    await provider.acknowledge?.(null, { providerTransactionId: "tok_1", accountId: "alice", providerReference: "supporter_once", kind: "oneTime", sealedProviderState: JSON.stringify({ kind: "oneTime", token: "tok_1" }), acknowledgementPending: true });
    expect(state.seen).toContain(`POST ${PRODUCT_ACKNOWLEDGE_PATH}`);
    // Minting is an RS256 signature plus a round trip; once per isolate.
    expect(state.tokenCalls).toBe(1);
  });
});

describe("google play subscriptions", () => {
  const purchase = (subscriptionState: string, acknowledgementState = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") => ({
    subscriptionState,
    acknowledgementState,
    startTime: "2026-09-01T00:00:00Z",
    externalAccountIdentifiers: { obfuscatedExternalAccountId: "alice" },
    lineItems: [{ productId: "pro", expiryTime: "2026-10-01T00:00:00Z", offerDetails: { basePlanId: "monthly" } }],
  });

  it.each([
    ["SUBSCRIPTION_STATE_ACTIVE", "active"],
    ["SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "grace"],
    ["SUBSCRIPTION_STATE_PENDING", "pending"],
    ["SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED", "pending"],
    // Play's CANCELED means "will not renew", and it keeps serving until
    // expiry. validUntil is what actually ends it.
    ["SUBSCRIPTION_STATE_CANCELED", "expired"],
    ["SUBSCRIPTION_STATE_ON_HOLD", "expired"],
    ["SUBSCRIPTION_STATE_PAUSED", "expired"],
    ["SUBSCRIPTION_STATE_EXPIRED", "expired"],
  ])("maps %s onto %s", async (playState, expected) => {
    await testPrivateKey();
    scriptFetch({ [SUBSCRIPTION_PATH]: purchase(playState) });
    const provider = await makeProvider();
    const verified = await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "pro:monthly", evidence: { purchaseToken: "tok_sub" } });
    expect(verified.state).toBe(expected);
    expect(verified.validUntil).toBe(Date.parse("2026-10-01T00:00:00Z"));
  });

  it("names a subscription by product and base plan, never by offer", async () => {
    await testPrivateKey();
    scriptFetch({ [SUBSCRIPTION_PATH]: { ...purchase("SUBSCRIPTION_STATE_ACTIVE"), lineItems: [{ productId: "pro", expiryTime: "2026-10-01T00:00:00Z", offerDetails: { basePlanId: "monthly", offerId: "free-trial" } }] } });
    const provider = await makeProvider();
    const verified = await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "pro:monthly", evidence: { purchaseToken: "tok_sub" } });
    // A free trial is a price on the monthly plan, not a different thing bought.
    expect(verified.providerReference).toBe("pro:monthly");
    expect(googlePlaySubscriptionReference("pro", "monthly")).toBe("pro:monthly");
  });

  it("reads a subscription by the reference's shape, and reports the plan Play says, not the one named", async () => {
    await testPrivateKey();
    const state = scriptFetch({ [SUBSCRIPTION_PATH]: { ...purchase("SUBSCRIPTION_STATE_ACTIVE"), lineItems: [{ productId: "pro", expiryTime: "2026-10-01T00:00:00Z", offerDetails: { basePlanId: "yearly" } }] } });
    // The device saw product `pro` and guessed monthly; the evidence carries no
    // kind, because the device need not know one.
    const verified = await (await makeProvider()).verifyClaim(null, { accountId: "alice", expectedProviderReference: "pro:monthly", evidence: { purchaseToken: "tok_sub" } });
    expect(state.seen).toEqual([`GET ${SUBSCRIPTION_PATH}`]);
    expect(verified).toMatchObject({ kind: "subscription", providerReference: "pro:yearly" });
  });

  describe("the token a deferred plan change issues, which swaps its line item at renewal", () => {
    // Play's documented shapes for the new token: before renewal the old item
    // still serves with a future expiry and names its replacement, and the new
    // item has no expiry; after renewal the old item's expiry is past and the
    // new one's is in the future. The test clock is 2023-11-14.
    const deferred = (lineItems: unknown[]) => ({ ...purchase("SUBSCRIPTION_STATE_ACTIVE"), lineItems });
    const monthly = { productId: "pro", offerDetails: { basePlanId: "monthly" } };
    const yearly = { productId: "pro", offerDetails: { basePlanId: "yearly" } };

    it("serves the old plan until renewal, in either item order", async () => {
      await testPrivateKey();
      const before = [{ ...monthly, expiryTime: "2026-10-01T00:00:00Z", deferredItemReplacement: { productId: "pro" } }, yearly];
      for (const lineItems of [before, [...before].reverse()]) {
        scriptFetch({ [SUBSCRIPTION_PATH]: deferred(lineItems) });
        const verified = await (await makeProvider()).verifyClaim(null, { accountId: "alice", expectedProviderReference: "pro:yearly", evidence: { purchaseToken: "tok_sub" } });
        expect(verified).toMatchObject({ providerReference: "pro:monthly", validUntil: Date.parse("2026-10-01T00:00:00Z") });
      }
    });

    it("still serves the old plan if Play has already dated the new item", async () => {
      // Play's docs disagree on when the new item gets its expiry; a waiting
      // replacement must not read as a second, add-on item either way.
      await testPrivateKey();
      scriptFetch({
        [SUBSCRIPTION_PATH]: deferred([
          { ...monthly, expiryTime: "2026-10-01T00:00:00Z", deferredItemReplacement: { productId: "pro" } },
          { ...yearly, expiryTime: "2027-10-01T00:00:00Z" },
        ]),
      });
      const verified = await (await makeProvider()).verifyClaim(null, { accountId: "alice", expectedProviderReference: "pro:yearly", evidence: { purchaseToken: "tok_sub" } });
      expect(verified).toMatchObject({ providerReference: "pro:monthly", validUntil: Date.parse("2026-10-01T00:00:00Z") });
    });

    it("serves the new plan once the replacement has taken effect", async () => {
      await testPrivateKey();
      scriptFetch({
        [SUBSCRIPTION_PATH]: deferred([
          { ...monthly, expiryTime: "2023-11-01T00:00:00Z" },
          { ...yearly, expiryTime: "2024-11-01T00:00:00Z" },
        ]),
      });
      const verified = await (await makeProvider()).verifyClaim(null, { accountId: "alice", expectedProviderReference: "pro:yearly", evidence: { purchaseToken: "tok_sub" } });
      expect(verified).toMatchObject({ providerReference: "pro:yearly", validUntil: Date.parse("2024-11-01T00:00:00Z") });
    });
  });

  it("answers an expired multi-item purchase with the item that served last", async () => {
    await testPrivateKey();
    scriptFetch({
      [SUBSCRIPTION_PATH]: {
        ...purchase("SUBSCRIPTION_STATE_EXPIRED"),
        lineItems: [
          { productId: "pro", expiryTime: "2023-01-01T00:00:00Z", offerDetails: { basePlanId: "monthly" } },
          { productId: "pro", expiryTime: "2023-06-01T00:00:00Z", offerDetails: { basePlanId: "yearly" } },
        ],
      },
    });
    const verified = await (await makeProvider()).verifyClaim(null, { accountId: "alice", expectedProviderReference: "pro:yearly", evidence: { purchaseToken: "tok_sub" } });
    expect(verified).toMatchObject({ providerReference: "pro:yearly", state: "expired" });
  });

  it("refuses add-on subscriptions rather than granting only the first item", async () => {
    await testPrivateKey();
    scriptFetch({
      [SUBSCRIPTION_PATH]: {
        ...purchase("SUBSCRIPTION_STATE_ACTIVE"),
        lineItems: [
          { productId: "pro", expiryTime: "2026-10-01T00:00:00Z", offerDetails: { basePlanId: "monthly" } },
          { productId: "themes", expiryTime: "2026-10-01T00:00:00Z", offerDetails: { basePlanId: "monthly" } },
        ],
      },
    });
    await expect((await makeProvider()).verifyClaim(null, { accountId: "alice", expectedProviderReference: "pro:monthly", evidence: { purchaseToken: "tok_sub" } })).rejects.toThrow(ProviderRefusal);
  });

  it("refuses a line item with no base plan rather than guessing one", async () => {
    await testPrivateKey();
    scriptFetch({ [SUBSCRIPTION_PATH]: { ...purchase("SUBSCRIPTION_STATE_ACTIVE"), lineItems: [{ productId: "pro", expiryTime: "2026-10-01T00:00:00Z" }] } });
    await expect((await makeProvider()).verifyClaim(null, { accountId: "alice", expectedProviderReference: "pro:monthly", evidence: { purchaseToken: "tok_sub" } })).rejects.toThrow(/no base plan/);
  });

  it("acknowledges on the v1 subscriptions resource, which is the only one that can", async () => {
    // `subscriptionsv2` has get, cancel, defer and revoke, and no acknowledge:
    // posting there is a 404, and an unacknowledged subscription is refunded.
    await testPrivateKey();
    const acknowledgePath = "/androidpublisher/v3/applications/com.example.game/purchases/subscriptions/pro/tokens/tok_sub:acknowledge";
    const state = scriptFetch({ [acknowledgePath]: null });
    await (await makeProvider()).acknowledge?.(null, { providerTransactionId: "tok_sub", accountId: "alice", providerReference: "pro:monthly", kind: "subscription", sealedProviderState: JSON.stringify({ kind: "subscription", token: "tok_sub" }), acknowledgementPending: true });
    expect(state.seen).toEqual([`POST ${acknowledgePath}`]);
  });

  it("needs acknowledgement while Play is still waiting to be told", async () => {
    await testPrivateKey();
    scriptFetch({ [SUBSCRIPTION_PATH]: purchase("SUBSCRIPTION_STATE_ACTIVE", "ACKNOWLEDGEMENT_STATE_PENDING") });
    const provider = await makeProvider();
    const verified = await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "pro:monthly", evidence: { purchaseToken: "tok_sub" } });
    expect(verified.requiresAcknowledgement).toBe(true);
  });
});

describe("google play notifications", () => {
  it("treats a developer notification as a signal and reads the purchase back", async () => {
    await testPrivateKey();
    scriptFetch({
      [SUBSCRIPTION_PATH]: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
        startTime: "2026-09-01T00:00:00Z",
        externalAccountIdentifiers: { obfuscatedExternalAccountId: "alice" },
        lineItems: [{ productId: "pro", expiryTime: "2026-10-01T00:00:00Z", offerDetails: { basePlanId: "monthly" } }],
      },
    });
    const provider = await makeProvider();
    const data = btoa(JSON.stringify({ packageName: "com.example.game", subscriptionNotification: { purchaseToken: "tok_sub" } }));
    const verified = await provider.verifyWebhook?.(null, new Request("https://x/rtdn", { method: "POST", body: JSON.stringify({ message: { data, messageId: "msg-1" } }) }));
    expect(verified).toMatchObject({ providerEventId: "msg-1", accountId: "alice" });
    expect(verified?.transaction).toMatchObject({ state: "active", providerReference: "pro:monthly" });
  });

  it("reads a one-time purchase notification back by its token alone", async () => {
    await testPrivateKey();
    scriptFetch({ [PRODUCT_PATH]: productPurchase("PURCHASED") });
    const verified = await (await makeProvider()).verifyWebhook?.(null, notify({ oneTimeProductNotification: { notificationType: 1, purchaseToken: "tok_1", sku: "supporter_once" } }));
    expect(verified).toMatchObject({ accountId: "alice", transaction: { providerTransactionId: "tok_1", providerReference: "supporter_once", state: "active" } });
  });

  it("revokes a refunded one-time purchase, even while Play still reads it as purchased", async () => {
    // The refund was routed to the subscription API, which knows nothing of a
    // one-time token, so a refunded player kept what they bought.
    await testPrivateKey();
    const state = scriptFetch({ [PRODUCT_PATH]: productPurchase("PURCHASED") });
    const verified = await (await makeProvider()).verifyWebhook?.(null, notify({ voidedPurchaseNotification: { purchaseToken: "tok_1", orderId: "GPA.1", productType: 2, refundType: 1 } }));
    expect(state.seen).toEqual([`GET ${PRODUCT_PATH}`]);
    expect(verified?.transaction).toMatchObject({ providerTransactionId: "tok_1", state: "revoked", requiresAcknowledgement: false });
  });

  it("keeps a partly refunded purchase while some of it is left, and revokes it when none is", async () => {
    await testPrivateKey();
    const partial = { voidedPurchaseNotification: { purchaseToken: "tok_1", productType: 2, refundType: 2 } };
    scriptFetch({ [PRODUCT_PATH]: productPurchase("PURCHASED", { productLineItem: [{ productId: "supporter_once", productOfferDetails: { quantity: 3, refundableQuantity: 2 } }] }) });
    expect((await (await makeProvider()).verifyWebhook?.(null, notify(partial)))?.transaction.state).toBe("active");
    scriptFetch({ [PRODUCT_PATH]: productPurchase("PURCHASED", { productLineItem: [{ productId: "supporter_once", productOfferDetails: { quantity: 3, refundableQuantity: 0 } }] }) });
    expect((await (await makeProvider()).verifyWebhook?.(null, notify(partial)))?.transaction.state).toBe("revoked");
  });

  it("reads a voided subscription back from the subscription API", async () => {
    await testPrivateKey();
    scriptFetch({ [SUBSCRIPTION_PATH]: { subscriptionState: "SUBSCRIPTION_STATE_EXPIRED", startTime: "2026-09-01T00:00:00Z", externalAccountIdentifiers: { obfuscatedExternalAccountId: "alice" }, lineItems: [{ productId: "pro", expiryTime: "2023-11-01T00:00:00Z", offerDetails: { basePlanId: "monthly" } }] } });
    const verified = await (await makeProvider()).verifyWebhook?.(null, notify({ voidedPurchaseNotification: { purchaseToken: "tok_sub", productType: 1, refundType: 1 } }));
    expect(verified?.transaction).toMatchObject({ kind: "subscription", state: "expired" });
  });

  it("names the token a resubscription replaced, and no account when Play has none", async () => {
    // Resubscribing from the Play Store after a lapse: a new token, linked to
    // the old one, and no obfuscated account id because the app was not there.
    await testPrivateKey();
    scriptFetch({ [SUBSCRIPTION_PATH]: { subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", startTime: "2026-09-01T00:00:00Z", linkedPurchaseToken: "tok_old", lineItems: [{ productId: "pro", expiryTime: "2026-10-01T00:00:00Z", offerDetails: { basePlanId: "monthly" } }] } });
    const verified = await (await makeProvider()).verifyWebhook?.(null, notify({ subscriptionNotification: { notificationType: 4, purchaseToken: "tok_sub" } }));
    expect(verified).not.toHaveProperty("accountId");
    expect(verified?.transaction).toMatchObject({ providerTransactionId: "tok_sub", replacesProviderTransactionId: "tok_old" });
  });

  it("answers a console test notification with nothing to record", async () => {
    await testPrivateKey();
    const state = scriptFetch({});
    await expect((await makeProvider()).verifyWebhook?.(null, notify({ testNotification: { version: "1.0" } }))).resolves.toBeNull();
    expect(state.seen).toEqual([]);
  });

  it("refuses a notification that names no purchase", async () => {
    await testPrivateKey();
    scriptFetch({});
    await expect((await makeProvider()).verifyWebhook?.(null, notify({}))).rejects.toThrow(/names no purchase/);
  });
});

describe("google play catalog references", () => {
  it.each([
    ["supporter_once", "oneTime"],
    ["com.example.coins_100", "oneTime"],
    ["pro:monthly", "subscription"],
    ["pro:p1y-auto", "subscription"],
  ] as const)("accepts %s as a %s reference", async (reference, kind) => {
    expect(() => makeProviderSync().validateReference?.(reference, kind)).not.toThrow();
  });

  it.each([
    ["pro", "subscription", /productId:basePlanId/],
    ["pro:", "subscription", /productId:basePlanId/],
    ["pro:Monthly", "subscription", /productId:basePlanId/],
    ["supporter:once", "oneTime", /product id alone/],
    ["Supporter", "oneTime", /not a Play product id/],
  ] as const)("refuses %s as a %s reference", async (reference, kind, message) => {
    expect(() => makeProviderSync().validateReference?.(reference, kind)).toThrow(message);
  });

  it("fails the deploy, not the first purchase, on a subscription missing its base plan", () => {
    const catalog = { free: {}, entitlements: [{ key: "pro" }], offers: [{ key: "pro_monthly", name: "Pro", description: "", kind: "subscription" as const, entitlements: ["pro"], providerReferences: { google_play: "pro" } }] };
    expect(() => resolveCommerce({ catalog, providers: [makeProviderSync()] })).toThrow(/offer pro_monthly has an invalid google_play reference "pro": .*productId:basePlanId/);
  });
});

describe("google play boundaries", () => {
  it("launches no checkout, because the Billing library owns that on the device", async () => {
    const provider = await makeProvider();
    expect(provider.createCheckout).toBeUndefined();
    expect(provider.management).toBeUndefined();
  });
});
