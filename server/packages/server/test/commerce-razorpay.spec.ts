/**
 * The Razorpay adapter against a scripted API.
 *
 * The two Razorpay-specific risks are the state mapping -- its `pending` means
 * the opposite of the engine's -- and the signature, which covers the raw body
 * with no timestamp, so there is nothing but the bytes to get right.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderRefusal } from "../src/commerce/provider-kit.js";
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

const subscription = (status: string, notes: unknown = { eigenAccountId: "alice" }) => ({ id: "sub_rz", plan_id: "plan_pro", customer_id: "cust_rz", status, created_at: 1_699_000_000, start_at: 1_699_000_000, current_start: 1_699_000_000, current_end: 1_701_000_000, notes });

const payment = (overrides: Record<string, unknown> = {}) => ({ id: "pay_1", status: "captured", amount: 49900, currency: "INR", order_id: "order_1", customer_id: "cust_rz", created_at: 1_699_000_000, notes: { eigenAccountId: "alice", eigenProviderReference: "supporter_once" }, ...overrides });

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

  it.each([
    ["another account's", { eigenAccountId: "mallory" }],
    // Every subscription checkout creates carries the note, so one without it
    // was made elsewhere, and its id alone says nothing about whose it is.
    ["no account's", []],
  ])("refuses a subscription made for %s", async (_label, notes) => {
    scriptFetch({ "/v1/subscriptions/sub_rz": subscription("active", notes) });
    await expect(provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "plan_pro", evidence: { subscriptionId: "sub_rz" } })).rejects.toThrow(ProviderRefusal);
  });
});

describe("razorpay payments", () => {
  it("authenticates with the key pair and reads the offer from the payment notes", async () => {
    const { auth } = scriptFetch({ "/v1/payments/pay_1": payment() });
    const verified = await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { paymentId: "pay_1" } });
    expect(verified).toMatchObject({ providerTransactionId: "pay_1", providerReference: "supporter_once", kind: "oneTime", state: "active" });
    expect(auth[0]).toBe(`Basic ${btoa("rzp_test:rzp_secret")}`);
  });

  it("refuses a payment whose notes name another account", async () => {
    scriptFetch({ "/v1/payments/pay_1": payment({ notes: { eigenAccountId: "mallory", eigenProviderReference: "supporter_once" } }) });
    await expect(provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { paymentId: "pay_1" } })).rejects.toThrow(ProviderRefusal);
  });

  it("refuses a payment that names no account", async () => {
    scriptFetch({ "/v1/payments/pay_1": payment({ notes: { eigenProviderReference: "supporter_once" } }) });
    await expect(provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { paymentId: "pay_1" } })).rejects.toThrow(ProviderRefusal);
  });

  it.each([
    // Notes are whatever the payer's checkout said: a one-rupee payment
    // carrying the supporter offer's notes must not become the supporter offer.
    ["less than the offer's price", { amount: 100 }],
    ["the right amount in another currency", { currency: "USD" }],
  ])("refuses a payment of %s", async (_label, overrides) => {
    scriptFetch({ "/v1/payments/pay_1": payment(overrides) });
    await expect(provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { paymentId: "pay_1" } })).rejects.toThrow(ProviderRefusal);
  });

  it("refuses a payment that names no Eigen offer", async () => {
    scriptFetch({ "/v1/payments/pay_1": payment({ notes: { eigenAccountId: "alice" } }) });
    await expect(provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { paymentId: "pay_1" } })).rejects.toThrow(ProviderRefusal);
  });

  it.each([
    ["refunded", "revoked"],
    ["failed", "revoked"],
    ["authorized", "pending"],
  ])("maps a %s payment onto %s", async (status, expected) => {
    scriptFetch({ "/v1/payments/pay_1": payment({ status }) });
    const verified = await provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: "supporter_once", evidence: { paymentId: "pay_1" } });
    expect(verified.state).toBe(expected);
  });
});

describe("razorpay webhooks", () => {
  const event = JSON.stringify({ event: "subscription.charged", payload: { subscription: { entity: { id: "sub_rz", notes: { eigenAccountId: "alice" } } } } });
  const deliver = async (body: string, eventId = "evt_1", signature?: string) => await provider.verifyWebhook?.(null, new Request("https://x/hook", { method: "POST", headers: { "x-razorpay-signature": signature ?? (await sign(body)), "x-razorpay-event-id": eventId }, body }));

  it("takes the account from the subscription it re-read, not from the event body", async () => {
    scriptFetch({ "/v1/subscriptions/sub_rz": subscription("active", { eigenAccountId: "bob" }) });
    expect(await deliver(event)).toMatchObject({ accountId: "bob" });
  });

  it("accepts a correct signature and re-reads the subscription", async () => {
    scriptFetch({ "/v1/subscriptions/sub_rz": subscription("active") });
    const verified = await deliver(event, "evt_charged");
    expect(verified).toMatchObject({ accountId: "alice", providerEventId: "evt_charged" });
    expect(verified?.transaction.state).toBe("active");
  });

  it("tells one renewal from the next", async () => {
    // Each month's charge leaves the subscription active, so only Razorpay's
    // own event id keeps the second from reading as a redelivery of the first.
    scriptFetch({ "/v1/subscriptions/sub_rz": subscription("active") });
    const first = await deliver(event, "evt_october");
    const second = await deliver(event, "evt_november");
    expect(first?.providerEventId).not.toBe(second?.providerEventId);
  });

  it("refuses an event without Razorpay's event id", async () => {
    scriptFetch({ "/v1/subscriptions/sub_rz": subscription("active") });
    await expect(deliver(event, "")).rejects.toThrow(/x-razorpay-event-id/);
  });

  it("re-reads a payment the event carries", async () => {
    scriptFetch({ "/v1/payments/pay_1": payment() });
    const captured = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });
    expect(await deliver(captured)).toMatchObject({ accountId: "alice", transaction: { providerReference: "supporter_once", state: "active" } });
  });

  it("records nothing for a payment that names no Eigen offer, such as a renewal", async () => {
    // A renewal's payment.captured carries the invoice and no notes; the
    // subscription.charged sent with it is the one that says what changed.
    scriptFetch({ "/v1/payments/pay_renewal": payment({ id: "pay_renewal", invoice_id: "inv_1", notes: [] }) });
    const captured = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_renewal" } } } });
    expect(await deliver(captured)).toBeNull();
  });

  it("records nothing for an event about neither a subscription nor a payment", async () => {
    const seen = scriptFetch({});
    expect(await deliver(JSON.stringify({ event: "payment_link.expired", payload: { payment_link: { entity: { id: "plink_1" } } } }))).toBeNull();
    expect(seen.seen).toEqual([]);
  });

  it("leaves a subscription that names no account for the ledger to attribute", async () => {
    scriptFetch({ "/v1/subscriptions/sub_rz": subscription("active", []) });
    const verified = await deliver(event);
    expect(verified).not.toHaveProperty("accountId");
  });

  it("refuses a forged signature", async () => {
    scriptFetch({ "/v1/subscriptions/sub_rz": subscription("active") });
    await expect(deliver(event, "evt_1", "0".repeat(64))).rejects.toThrow(/did not verify/);
  });

  it("refuses a body altered after signing", async () => {
    scriptFetch({ "/v1/subscriptions/sub_rz": subscription("active") });
    const tampered = event.replace("alice", "mallory");
    await expect(deliver(tampered, "evt_1", await sign(event))).rejects.toThrow(/did not verify/);
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

  it.each([
    ["plan_pro", "subscription", undefined],
    ["supporter_once", "oneTime", undefined],
    ["pro_monthly", "subscription", /Plan/],
    ["unpriced", "oneTime", /amounts/],
  ] as const)("checks %s as a %s reference", (reference, kind, problem) => {
    const check = () => provider.validateReference?.(reference, kind);
    if (problem === undefined) expect(check).not.toThrow();
    else expect(check).toThrow(problem);
  });

  it("has no management portal, because Razorpay has none", () => {
    expect(provider.management).toBeUndefined();
  });
});
