/**
 * The Stripe adapter against a scripted API.
 *
 * What is worth testing here is the boundary, not Stripe: that a signature is
 * actually checked and actually rejected, that a status Stripe invented maps
 * onto the five states the engine has, and that nothing in a webhook body is
 * believed without reading the object back.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { stripeCommerceProvider } from "../src/index.js";

const SECRET = "whsec_test_secret";
const config = { secretKey: () => "sk_test", webhookSecret: () => SECRET, now: () => 1_700_000_000_000 };
const provider = stripeCommerceProvider<unknown>(config);

/** Answer each request from a table keyed by the path it asks for. */
function scriptFetch(routes: Record<string, unknown>): string[] {
  const seen: string[] = [];
  vi.stubGlobal("fetch", async (request: Request) => {
    const url = new URL(request.url);
    seen.push(`${request.method} ${url.pathname}`);
    const body = routes[url.pathname];
    if (body === undefined) return new Response("no such object", { status: 404 });
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  return seen;
}

async function sign(body: string, timestamp: number, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Basil (2025-03-31) and later: the billing period lives on the line item. */
const subscription = (status: string) => ({
  id: "sub_1",
  status,
  customer: "cus_1",
  start_date: 1_699_000_000,
  items: { data: [{ price: { id: "price_pro" }, current_period_start: 1_699_000_000, current_period_end: 1_701_000_000 }] },
});

/** Before Basil, the same period sat on the subscription itself. */
const legacySubscription = (status: string) => ({
  id: "sub_1",
  status,
  customer: "cus_1",
  start_date: 1_699_000_000,
  current_period_start: 1_699_000_000,
  current_period_end: 1_701_000_000,
  items: { data: [{ price: { id: "price_pro" } }] },
});

afterEach(() => vi.unstubAllGlobals());

describe("stripe subscriptions", () => {
  it.each([
    ["active", "active"],
    ["trialing", "active"],
    ["past_due", "grace"],
    ["incomplete", "pending"],
    ["unpaid", "expired"],
    ["paused", "expired"],
    ["canceled", "revoked"],
  ])("maps %s onto %s", async (stripeStatus, expected) => {
    scriptFetch({ "/v1/subscriptions/sub_1": subscription(stripeStatus) });
    const verified = await provider.reconcile?.(null, [{ providerTransactionId: "sub_1", accountId: "a", providerReference: "price_pro", kind: "subscription", acknowledgementPending: false }]);
    expect(verified?.[0]?.state).toBe(expected);
    expect(verified?.[0]?.providerReference).toBe("price_pro");
    expect(verified?.[0]?.providerAccountId).toBe("cus_1");
  });

  it.each([
    ["item-level, as Basil and later report it", subscription("active")],
    ["subscription-level, as versions before Basil did", legacySubscription("active")],
  ])("reads the billing period %s", async (_shape, body) => {
    scriptFetch({ "/v1/subscriptions/sub_1": body });
    const verified = await provider.reconcile?.(null, [{ providerTransactionId: "sub_1", accountId: "a", providerReference: "price_pro", kind: "subscription", acknowledgementPending: false }]);
    // Without this, validUntil is absent and the grant never expires: a
    // cancelled subscription would keep paying out forever.
    expect(verified?.[0]?.validUntil).toBe(1_701_000_000_000);
    expect(verified?.[0]?.validFrom).toBe(1_699_000_000_000);
  });

  it("pins the API version on every request, so the merchant's dashboard cannot reshape the response", async () => {
    const versions: string[] = [];
    vi.stubGlobal("fetch", async (request: Request) => {
      versions.push(request.headers.get("stripe-version") ?? "(none)");
      return new Response(JSON.stringify(subscription("active")), { headers: { "content-type": "application/json" } });
    });
    await provider.reconcile?.(null, [{ providerTransactionId: "sub_1", accountId: "a", providerReference: "price_pro", kind: "subscription", acknowledgementPending: false }]);
    expect(versions).toEqual(["2026-08-26.dahlia"]);
  });

  it("leaves a transaction unanswered rather than failing the whole sweep", async () => {
    scriptFetch({ "/v1/subscriptions/sub_1": subscription("active") });
    const verified = await provider.reconcile?.(null, [
      { providerTransactionId: "sub_gone", accountId: "a", providerReference: "price_pro", kind: "subscription", acknowledgementPending: false },
      { providerTransactionId: "sub_1", accountId: "a", providerReference: "price_pro", kind: "subscription", acknowledgementPending: false },
    ]);
    expect(verified?.map((entry) => entry.providerTransactionId)).toEqual(["sub_1"]);
  });
});

describe("stripe claims", () => {
  it("refuses a session opened by another account", async () => {
    scriptFetch({ "/v1/checkout/sessions/cs_1": { id: "cs_1", mode: "payment", payment_status: "paid", customer: "cus_1", subscription: null, client_reference_id: "someone-else", created: 1_699_000_000 } });
    await expect(provider.verifyClaim(null, { accountId: "alice", offer: { key: "supporter" } as never, expectedProviderReference: "price_supporter", evidence: { sessionId: "cs_1" } })).rejects.toThrow(/another account/);
  });

  it("reads the price from the expanded session rather than the client", async () => {
    scriptFetch({
      "/v1/checkout/sessions/cs_1": { id: "cs_1", mode: "payment", payment_status: "paid", customer: "cus_1", subscription: null, client_reference_id: "alice", created: 1_699_000_000, line_items: { data: [{ price: { id: "price_supporter" } }] } },
    });
    const verified = await provider.verifyClaim(null, { accountId: "alice", offer: { key: "supporter" } as never, expectedProviderReference: "price_supporter", evidence: { sessionId: "cs_1" } });
    expect(verified).toMatchObject({ providerTransactionId: "cs_1", providerReference: "price_supporter", kind: "oneTime", state: "active", providerAccountId: "cus_1" });
  });
});

describe("stripe webhook signatures", () => {
  const event = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", data: { object: { id: "sub_1", client_reference_id: "alice" } } });

  it("accepts a current signature and re-reads the object", async () => {
    scriptFetch({ "/v1/subscriptions/sub_1": subscription("active") });
    const timestamp = Math.floor(config.now() / 1000);
    const verified = await provider.verifyWebhook?.(null, new Request("https://x/hook", { method: "POST", headers: { "stripe-signature": `t=${timestamp},v1=${await sign(event, timestamp)}` }, body: event }));
    expect(verified).toMatchObject({ providerEventId: "evt_1", accountId: "alice" });
    expect(verified?.transaction.state).toBe("active");
  });

  it("refuses a forged signature", async () => {
    scriptFetch({ "/v1/subscriptions/sub_1": subscription("active") });
    const timestamp = Math.floor(config.now() / 1000);
    await expect(provider.verifyWebhook?.(null, new Request("https://x/hook", { method: "POST", headers: { "stripe-signature": `t=${timestamp},v1=${"0".repeat(64)}` }, body: event }))).rejects.toThrow(/did not verify/);
  });

  it("refuses a correctly signed payload that is too old to be fresh", async () => {
    scriptFetch({ "/v1/subscriptions/sub_1": subscription("active") });
    const stale = Math.floor(config.now() / 1000) - 3600;
    await expect(provider.verifyWebhook?.(null, new Request("https://x/hook", { method: "POST", headers: { "stripe-signature": `t=${stale},v1=${await sign(event, stale)}` }, body: event }))).rejects.toThrow(/tolerance/);
  });

  it("ignores a v0 scheme rather than accepting a downgrade", async () => {
    scriptFetch({ "/v1/subscriptions/sub_1": subscription("active") });
    const timestamp = Math.floor(config.now() / 1000);
    await expect(provider.verifyWebhook?.(null, new Request("https://x/hook", { method: "POST", headers: { "stripe-signature": `t=${timestamp},v0=${await sign(event, timestamp)}` }, body: event }))).rejects.toThrow(/did not verify/);
  });
});

describe("stripe checkout", () => {
  it("sends the engine's operation identity as Stripe's idempotency key", async () => {
    let seenKey: string | null = null;
    let seenForm = "";
    vi.stubGlobal("fetch", async (request: Request) => {
      seenKey = request.headers.get("idempotency-key");
      seenForm = await request.text();
      return new Response(JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1", customer: "cus_1", mode: "payment", payment_status: "unpaid", subscription: null, client_reference_id: "alice", created: 1, expires_at: 1_700_003_600 }), { headers: { "content-type": "application/json" } });
    });
    const checkout = await provider.createCheckout?.(null, {
      accountId: "alice",
      offer: { key: "supporter", kind: "oneTime", name: "Supporter" } as never,
      providerReference: "price_supporter",
      returnUrl: "https://game.example/store",
      operationId: "op-42",
    });
    expect(seenKey).toBe("op-42");
    expect(seenForm).toContain("client_reference_id=alice");
    expect(checkout).toMatchObject({ url: "https://checkout.stripe.com/c/pay/cs_1", providerAccountId: "cus_1" });
  });
});
