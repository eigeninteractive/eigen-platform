/**
 * The Razorpay adapter against a scripted API.
 *
 * The two Razorpay-specific risks are the state mapping -- its `pending` means
 * the opposite of the engine's -- and the signature, which covers the raw body
 * with no timestamp, so there is nothing but the bytes to get right.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { razorpayCommerceProvider } from "../src/commerce/providers/razorpay.js";

const SECRET = "wh_secret";
const provider = razorpayCommerceProvider<unknown>({
  keyId: () => "rzp_test",
  keySecret: () => "rzp_secret",
  webhookSecret: () => SECRET,
  amounts: { supporter_once: { amount: 49900, currency: "INR" } },
  now: () => 1_700_000_000_000,
});

function scriptFetch(routes: Record<string, unknown>): { seen: string[]; auth: string[] } {
  const seen: string[] = [];
  const auth: string[] = [];
  vi.stubGlobal("fetch", async (request: Request) => {
    const url = new URL(request.url);
    seen.push(`${request.method} ${url.pathname}`);
    auth.push(request.headers.get("authorization") ?? "");
    const body = routes[url.pathname];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  return { seen, auth };
}

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const subscription = (status: string) => ({ id: "sub_rz", plan_id: "plan_pro", customer_id: "cust_rz", status, created_at: 1_699_000_000, start_at: 1_699_000_000, current_start: 1_699_000_000, current_end: 1_701_000_000 });

afterEach(() => vi.unstubAllGlobals());

describe("razorpay subscriptions", () => {
  it.each([
    ["active", "active"],
    ["authenticated", "active"],
    // Razorpay's `pending` is a failed auto-charge being retried, which is the
    // engine's grace, not its pending. Getting this backwards would cut off a
    // paying player mid-retry.
    ["pending", "grace"],
    ["created", "pending"],
    ["halted", "expired"],
    ["completed", "expired"],
    ["expired", "expired"],
    ["paused", "expired"],
    ["cancelled", "revoked"],
  ])("maps %s onto %s", async (status, expected) => {
    scriptFetch({ "/v1/subscriptions/sub_rz": subscription(status) });
    const verified = await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "plan_pro", evidence: { subscriptionId: "sub_rz" } });
    expect(verified.state).toBe(expected);
    expect(verified).toMatchObject({ providerReference: "plan_pro", kind: "subscription", providerAccountId: "cust_rz" });
  });
});

describe("razorpay payments", () => {
  it("authenticates with the key pair and reads the offer from the payment notes", async () => {
    const { auth } = scriptFetch({ "/v1/payments/pay_1": { id: "pay_1", status: "captured", order_id: "order_1", customer_id: "cust_rz", created_at: 1_699_000_000, notes: { eigenAccountId: "alice", eigenProviderReference: "supporter_once" } } });
    const verified = await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { paymentId: "pay_1" } });
    expect(verified).toMatchObject({ providerTransactionId: "pay_1", providerReference: "supporter_once", kind: "oneTime", state: "active" });
    expect(auth[0]).toBe(`Basic ${btoa("rzp_test:rzp_secret")}`);
  });

  it("refuses a payment whose notes name another account", async () => {
    scriptFetch({ "/v1/payments/pay_1": { id: "pay_1", status: "captured", order_id: null, created_at: 1, notes: { eigenAccountId: "mallory", eigenProviderReference: "supporter_once" } } });
    await expect(provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { paymentId: "pay_1" } })).rejects.toThrow(/another account/);
  });

  it.each([
    ["refunded", "revoked"],
    ["failed", "revoked"],
    ["authorized", "pending"],
  ])("maps a %s payment onto %s", async (status, expected) => {
    scriptFetch({ "/v1/payments/pay_1": { id: "pay_1", status, order_id: null, created_at: 1, notes: { eigenProviderReference: "supporter_once" } } });
    const verified = await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { paymentId: "pay_1" } });
    expect(verified.state).toBe(expected);
  });
});

describe("razorpay webhooks", () => {
  const event = JSON.stringify({ event: "subscription.charged", payload: { subscription: { entity: { id: "sub_rz", notes: { eigenAccountId: "alice" } } } } });

  it("accepts a correct signature and re-reads the subscription", async () => {
    scriptFetch({ "/v1/subscriptions/sub_rz": subscription("active") });
    const verified = await provider.verifyWebhook?.(null, new Request("https://x/hook", { method: "POST", headers: { "x-razorpay-signature": await sign(event) }, body: event }));
    expect(verified).toMatchObject({ accountId: "alice" });
    expect(verified?.transaction.state).toBe("active");
    // Razorpay sends no event id, so the identity has to be derived and stable.
    expect(verified?.providerEventId).toBe("subscription.charged:sub_rz:active");
  });

  it("refuses a forged signature", async () => {
    scriptFetch({ "/v1/subscriptions/sub_rz": subscription("active") });
    await expect(provider.verifyWebhook?.(null, new Request("https://x/hook", { method: "POST", headers: { "x-razorpay-signature": "0".repeat(64) }, body: event }))).rejects.toThrow(/did not verify/);
  });

  it("refuses a body altered after signing", async () => {
    scriptFetch({ "/v1/subscriptions/sub_rz": subscription("active") });
    const signature = await sign(event);
    const tampered = event.replace("alice", "mallory");
    await expect(provider.verifyWebhook?.(null, new Request("https://x/hook", { method: "POST", headers: { "x-razorpay-signature": signature }, body: tampered }))).rejects.toThrow(/did not verify/);
  });
});

describe("razorpay checkout", () => {
  it("creates a payment link carrying the operation identity as its reference", async () => {
    let sent: Record<string, unknown> = {};
    vi.stubGlobal("fetch", async (request: Request) => {
      sent = JSON.parse(await request.text()) as Record<string, unknown>;
      return new Response(JSON.stringify({ id: "plink_1", short_url: "https://rzp.io/i/abc", expire_by: 1_700_003_600 }), { headers: { "content-type": "application/json" } });
    });
    const checkout = await provider.createCheckout?.(null, {
      accountId: "alice",
      offer: { key: "supporter", kind: "oneTime", name: "Supporter" } as never,
      providerReference: "supporter_once",
      returnUrl: "https://game.example/store",
      operationId: "op-7",
    });
    expect(checkout?.url).toBe("https://rzp.io/i/abc");
    expect(sent).toMatchObject({ amount: 49900, currency: "INR", reference_id: "op-7" });
    expect((sent.notes as Record<string, string>).eigenAccountId).toBe("alice");
  });

  it("refuses a one-time offer the deployment never priced", async () => {
    scriptFetch({});
    await expect(
      provider.createCheckout?.(null, {
        accountId: "alice",
        offer: { key: "other", kind: "oneTime", name: "Other" } as never,
        providerReference: "unpriced",
        returnUrl: "https://game.example/store",
        operationId: "op-8",
      }),
    ).rejects.toThrow(/no amount configured/);
  });

  it("has no management portal, because Razorpay has none", () => {
    expect(provider.management).toBeUndefined();
  });
});
