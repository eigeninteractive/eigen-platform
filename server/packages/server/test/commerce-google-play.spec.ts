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

const PRODUCT_PATH = "/androidpublisher/v3/applications/com.example.game/purchases/products/supporter_once/tokens/tok_1";
const SUBSCRIPTION_PATH = "/androidpublisher/v3/applications/com.example.game/purchases/subscriptionsv2/tokens/tok_sub";

afterEach(() => vi.unstubAllGlobals());

describe("google play one-time purchases", () => {
  it("reports an unacknowledged purchase as needing acknowledgement, carrying its token", async () => {
    await testPrivateKey();
    scriptFetch({ [PRODUCT_PATH]: { purchaseState: 0, acknowledgementState: 0, purchaseTimeMillis: "1699000000000", orderId: "GPA.1", obfuscatedExternalAccountId: "alice" } });
    const provider = await makeProvider();
    const verified = await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { purchaseToken: "tok_1" } });
    expect(verified).toMatchObject({ providerTransactionId: "GPA.1", providerReference: "supporter_once", kind: "oneTime", state: "active", requiresAcknowledgement: true });
    // The token is the handle every later call needs, so it rides in sealed
    // state rather than being the transaction's public identity.
    expect(JSON.parse(verified.sealedProviderState as string)).toEqual({ productId: "supporter_once", token: "tok_1" });
  });

  it.each([
    [0, 1, "active", false],
    [2, 0, "pending", false],
    [1, 0, "revoked", false],
  ])("maps purchaseState %i / ack %i onto %s", async (purchaseState, acknowledgementState, expected, needsAck) => {
    await testPrivateKey();
    scriptFetch({ [PRODUCT_PATH]: { purchaseState, acknowledgementState, purchaseTimeMillis: "1699000000000", orderId: "GPA.1" } });
    const provider = await makeProvider();
    const verified = await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { purchaseToken: "tok_1" } });
    expect(verified.state).toBe(expected);
    expect(verified.requiresAcknowledgement).toBe(needsAck);
  });

  it("refuses a token minted against another player's account", async () => {
    await testPrivateKey();
    scriptFetch({ [PRODUCT_PATH]: { purchaseState: 0, acknowledgementState: 1, orderId: "GPA.1", obfuscatedExternalAccountId: "mallory" } });
    const provider = await makeProvider();
    await expect(provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { purchaseToken: "tok_1" } })).rejects.toThrow(/another account/);
  });

  it("acknowledges through the product path and reuses one access token", async () => {
    await testPrivateKey();
    const state = scriptFetch({ [`${PRODUCT_PATH}:acknowledge`]: null, [PRODUCT_PATH]: { purchaseState: 0, acknowledgementState: 0, orderId: "GPA.1" } });
    const provider = await makeProvider();
    await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { purchaseToken: "tok_1" } });
    await provider.acknowledge?.(null, { providerTransactionId: "GPA.1", accountId: "alice", providerReference: "supporter_once", kind: "oneTime", sealedProviderState: JSON.stringify({ productId: "supporter_once", token: "tok_1" }), acknowledgementPending: true });
    expect(state.seen).toContain(`POST ${PRODUCT_PATH}:acknowledge`);
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
    await expect((await makeProvider()).verifyClaim(null, { accountId: "alice", expectedProviderReference: "pro:monthly", evidence: { purchaseToken: "tok_sub" } })).rejects.toThrow(/add-on/);
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

  it("refuses a notification that names no purchase", async () => {
    await testPrivateKey();
    scriptFetch({});
    const provider = await makeProvider();
    const data = btoa(JSON.stringify({ packageName: "com.example.game", testNotification: { version: "1.0" } }));
    await expect(provider.verifyWebhook?.(null, new Request("https://x/rtdn", { method: "POST", body: JSON.stringify({ message: { data, messageId: "msg-2" } }) }))).rejects.toThrow(/names no purchase/);
  });
});

describe("google play boundaries", () => {
  it("launches no checkout, because the Billing library owns that on the device", async () => {
    const provider = await makeProvider();
    expect(provider.createCheckout).toBeUndefined();
    expect(provider.management).toBeUndefined();
  });
});
