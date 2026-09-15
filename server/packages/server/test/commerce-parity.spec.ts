/**
 * What every commerce adapter must agree on, whatever it wraps.
 *
 * The three shipped adapters have bespoke suites for the things only they get
 * wrong -- Play's acknowledgement window, Stripe's moving billing period,
 * Razorpay's grace-period vocabulary. This is the other half: the properties
 * the engine relies on from ALL of them, asserted the same way for each, so a
 * fourth adapter has something to conform to rather than an example to copy.
 *
 * It deliberately asserts at the NORMALIZED boundary. Nothing here knows what
 * a Price or a purchase token is; it knows what the ledger is entitled to
 * assume about whatever comes back.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { googlePlayCommerceProvider } from "../src/commerce/providers/google-play.js";
import { razorpayCommerceProvider } from "../src/commerce/providers/razorpay.js";
import { stripeCommerceProvider } from "../src/commerce/providers/stripe.js";
import type { CommerceProvider, VerifiedCommerceTransaction } from "../src/commerce/types.js";

const NOW = 1_700_000_000_000;

/** A secret each adapter is configured with, so a failure can be checked for
 * having leaked it. Distinct per adapter so a match cannot be coincidence. */
const SECRETS = {
  google_play: "play-private-key-do-not-log",
  stripe: "sk_test_do_not_log",
  razorpay: "rzp_secret_do_not_log",
} as const;

let playKey: string | null = null;
async function playPrivateKey(): Promise<string> {
  if (playKey !== null) return playKey;
  const pair = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
  playKey = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8)).replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----`;
  return playKey;
}

/** Answers Play's OAuth exchange, then a table keyed by path. */
function scriptFetch(routes: Record<string, unknown>, fail = new Set<string>()): void {
  vi.stubGlobal("fetch", async (request: Request) => {
    const url = new URL(request.url);
    if (url.hostname === "oauth2.googleapis.com") {
      return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }), { headers: { "content-type": "application/json" } });
    }
    if (fail.has(url.pathname)) return new Response("upstream is unwell", { status: 500 });
    const body = routes[url.pathname];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  });
}

interface ParityCase {
  provider: CommerceProvider<unknown>;
  /** Two independent purchases this adapter can read back. */
  routes: Record<string, unknown>;
  /** Claim evidence for the first purchase, and its provider reference. */
  claim: { evidence: Record<string, unknown>; providerReference: string };
  /** References to sweep, in order; the first one's read is made to fail.
   * `sealedProviderState` is carried because an adapter may need its own
   * handle back -- Play cannot read a purchase without its token. */
  references: { providerTransactionId: string; providerReference: string; kind: "oneTime" | "subscription"; sealedProviderState?: string }[];
  /** The path whose failure must not take the rest of the sweep with it. */
  failingPath: string;
  /** Storefront capabilities this provider genuinely has. */
  supports: { checkout: boolean; management: boolean; webhook: boolean };
}

async function cases(): Promise<Record<string, ParityCase>> {
  const key = await playPrivateKey();
  return {
    google_play: {
      provider: googlePlayCommerceProvider<unknown>({
        packageName: () => "com.example.game",
        serviceAccountEmail: () => "svc@example.iam.gserviceaccount.com",
        serviceAccountPrivateKey: () => key,
        now: () => NOW,
      }),
      routes: {
        "/androidpublisher/v3/applications/com.example.game/purchases/products/supporter_once/tokens/tok_a": { purchaseState: 0, acknowledgementState: 1, purchaseTimeMillis: "1699000000000", orderId: "GPA.A", obfuscatedExternalAccountId: "alice" },
        "/androidpublisher/v3/applications/com.example.game/purchases/products/supporter_once/tokens/tok_b": { purchaseState: 0, acknowledgementState: 1, purchaseTimeMillis: "1699000001000", orderId: "GPA.B", obfuscatedExternalAccountId: "alice" },
      },
      claim: { evidence: { purchaseToken: "tok_a" }, providerReference: "supporter_once" },
      references: [
        { providerTransactionId: "GPA.A", providerReference: "supporter_once", kind: "oneTime", sealedProviderState: JSON.stringify({ productId: "supporter_once", token: "tok_a" }) },
        { providerTransactionId: "GPA.B", providerReference: "supporter_once", kind: "oneTime", sealedProviderState: JSON.stringify({ productId: "supporter_once", token: "tok_b" }) },
      ],
      failingPath: "/androidpublisher/v3/applications/com.example.game/purchases/products/supporter_once/tokens/tok_a",
      supports: { checkout: false, management: false, webhook: true },
    },
    stripe: {
      provider: stripeCommerceProvider<unknown>({
        secretKey: () => SECRETS.stripe,
        webhookSecret: () => "whsec_parity",
        now: () => NOW,
      }),
      routes: {
        "/v1/checkout/sessions/cs_a": { id: "cs_a", mode: "payment", payment_status: "paid", customer: "cus_1", subscription: null, client_reference_id: "alice", created: 1_699_000_000, line_items: { data: [{ price: { id: "price_supporter" } }] } },
        "/v1/checkout/sessions/cs_b": { id: "cs_b", mode: "payment", payment_status: "paid", customer: "cus_1", subscription: null, client_reference_id: "alice", created: 1_699_000_001, line_items: { data: [{ price: { id: "price_supporter" } }] } },
      },
      claim: { evidence: { sessionId: "cs_a" }, providerReference: "price_supporter" },
      references: [
        { providerTransactionId: "cs_a", providerReference: "price_supporter", kind: "oneTime" },
        { providerTransactionId: "cs_b", providerReference: "price_supporter", kind: "oneTime" },
      ],
      failingPath: "/v1/checkout/sessions/cs_a",
      supports: { checkout: true, management: true, webhook: true },
    },
    razorpay: {
      provider: razorpayCommerceProvider<unknown>({
        keyId: () => "rzp_key",
        keySecret: () => SECRETS.razorpay,
        webhookSecret: () => "rzp_webhook",
        amounts: { supporter: { amount: 49900, currency: "INR" } },
        now: () => NOW,
      }),
      routes: {
        "/v1/payments/pay_a": { id: "pay_a", status: "captured", order_id: null, created_at: 1_699_000_000, notes: { eigenAccountId: "alice", eigenProviderReference: "supporter" } },
        "/v1/payments/pay_b": { id: "pay_b", status: "captured", order_id: null, created_at: 1_699_000_001, notes: { eigenAccountId: "alice", eigenProviderReference: "supporter" } },
      },
      claim: { evidence: { paymentId: "pay_a" }, providerReference: "supporter" },
      references: [
        { providerTransactionId: "pay_a", providerReference: "supporter", kind: "oneTime" },
        { providerTransactionId: "pay_b", providerReference: "supporter", kind: "oneTime" },
      ],
      failingPath: "/v1/payments/pay_a",
      supports: { checkout: true, management: false, webhook: true },
    },
  };
}

/** Everything the ledger is entitled to assume about a verified transaction,
 * whichever adapter produced it. */
function expectNormalized(transaction: VerifiedCommerceTransaction, providerReference: string): void {
  expect(transaction.providerTransactionId.length).toBeGreaterThan(0);
  // The engine matches this against the catalog to decide WHAT was bought, so
  // an adapter inventing or dropping it sells the wrong thing.
  expect(transaction.providerReference).toBe(providerReference);
  expect(["oneTime", "subscription"]).toContain(transaction.kind);
  expect(["pending", "active", "grace", "expired", "revoked"]).toContain(transaction.state);
  // Epoch MILLISECONDS. Every provider here speaks seconds somewhere, and a
  // transaction validated in 1970 is the shape that mistake takes.
  for (const instant of [transaction.purchasedAt, transaction.validFrom]) {
    expect(Number.isSafeInteger(instant)).toBe(true);
    expect(instant).toBeGreaterThan(1_000_000_000_000);
  }
  if (transaction.validUntil !== undefined) {
    expect(Number.isSafeInteger(transaction.validUntil)).toBe(true);
    expect(transaction.validUntil).toBeGreaterThan(transaction.validFrom);
  }
}

describe("every commerce adapter agrees on", () => {
  afterEach(() => void vi.unstubAllGlobals());

  it("naming itself with a stable, non-empty key", async () => {
    for (const [name, parity] of Object.entries(await cases())) {
      expect(parity.provider.key).toBe(name);
    }
  });

  it("the shape of a verified transaction", async () => {
    for (const parity of Object.values(await cases())) {
      scriptFetch(parity.routes);
      const verified = await parity.provider.verifyClaim(null, {
        accountId: "alice",
        expectedProviderReference: parity.claim.providerReference,
        evidence: parity.claim.evidence,
      });
      expectNormalized(verified, parity.claim.providerReference);
      vi.unstubAllGlobals();
    }
  });

  it("refusing evidence that names no purchase", async () => {
    for (const [name, parity] of Object.entries(await cases())) {
      scriptFetch(parity.routes);
      for (const evidence of [null, undefined, {}, { nonsense: 1 }, "a string", []]) {
        await expect(parity.provider.verifyClaim(null, { accountId: "alice", expectedProviderReference: parity.claim.providerReference, evidence }), `${name} accepted ${JSON.stringify(evidence)}`).rejects.toThrow();
      }
      vi.unstubAllGlobals();
    }
  });

  it("answering for the rest of a sweep when one read fails", async () => {
    // The sweep hands an adapter a batch. One dead transaction must cost that
    // transaction its turn, not the batch -- otherwise a single unreadable row
    // freezes reconciliation for every account behind it.
    for (const [name, parity] of Object.entries(await cases())) {
      scriptFetch(parity.routes, new Set([parity.failingPath]));
      const swept = await parity.provider.reconcile?.(
        null,
        parity.references.map((reference) => ({ ...reference, accountId: "alice", acknowledgementPending: false })),
      );
      expect(swept, `${name} dropped the whole batch`).toHaveLength(1);
      expect(swept?.[0]?.providerTransactionId).toBe(parity.references[1]?.providerTransactionId);
      vi.unstubAllGlobals();
    }
  });

  it("declaring only the storefront capabilities it really has", async () => {
    // Absence is the contract: the engine answers 400 for a provider that
    // cannot open a checkout or a portal, rather than an adapter inventing a
    // page that does not exist.
    for (const [name, parity] of Object.entries(await cases())) {
      expect(parity.provider.createCheckout !== undefined, `${name} checkout`).toBe(parity.supports.checkout);
      expect(parity.provider.management !== undefined, `${name} management`).toBe(parity.supports.management);
      expect(parity.provider.verifyWebhook !== undefined, `${name} webhook`).toBe(parity.supports.webhook);
    }
  });

  it("never quoting its own credential when a provider fails", async () => {
    // An adapter's error text reaches a log and an operator surface. A secret
    // that travels with it is a secret in a log for as long as logs are kept.
    for (const [name, parity] of Object.entries(await cases())) {
      scriptFetch({}, new Set([parity.failingPath]));
      const failure = await parity.provider
        .verifyClaim(null, { accountId: "alice", expectedProviderReference: parity.claim.providerReference, evidence: parity.claim.evidence })
        .then(() => null)
        .catch((error: unknown) => error);
      expect(failure, `${name} did not fail`).not.toBeNull();
      const text = `${String(failure)} ${failure instanceof Error ? (failure.stack ?? "") : ""}`;
      for (const secret of Object.values(SECRETS)) {
        expect(text, `${name} leaked a credential`).not.toContain(secret);
      }
      vi.unstubAllGlobals();
    }
  });

  it("rejecting a webhook whose signature does not verify", async () => {
    for (const [name, parity] of Object.entries(await cases())) {
      if (parity.provider.verifyWebhook === undefined) continue;
      scriptFetch(parity.routes);
      const request = new Request("https://worker.example/api/commerce/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef", "x-razorpay-signature": "deadbeef" },
        body: JSON.stringify({ id: "evt_forged", type: "checkout.session.completed", data: { object: { id: "cs_a" } } }),
      });
      await expect(parity.provider.verifyWebhook(null, request), `${name} accepted a forged notification`).rejects.toThrow();
      vi.unstubAllGlobals();
    }
  });
});
