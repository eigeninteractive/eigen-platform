/**
 * Stripe for the EigenInteractive commerce runtime.
 *
 * Stripe is the web half of the intended pair: the player is redirected to a
 * Stripe-hosted Checkout Session and comes back, so this adapter owns a
 * checkout and a management portal that the store-SDK adapters do not have.
 *
 * Three things about the shape are deliberate:
 *
 * - **A Price, not a product.** Stripe sells a configured `price_...`, and a
 *   Product may carry several. The engine's `providerReference` is therefore
 *   the price id, which is also the only identifier that can be checked against
 *   what was actually paid for.
 * - **The Customer is ours to bind, once.** Checkout is created against the
 *   customer already bound to the account, and the customer Stripe reports back
 *   is returned to the ledger, which refuses to rebind an account to a second
 *   one. A portal session cannot be opened without that binding.
 * - **Nothing trusts the webhook body.** A notification is a signed hint; the
 *   adapter re-reads the Session, Subscription or PaymentIntent from the API
 *   before anything becomes an entitlement.
 *
 * @module @eigeninteractive/commerce-stripe
 */

import type { CommerceProvider, CommerceTransactionState, VerifiedCommerceEvent, VerifiedCommerceTransaction } from "@eigeninteractive/server";
import { basicAuth, hmacSha256Hex, providerJson, requireSecret, timingSafeEqualHex } from "@eigeninteractive/server/commerce-kit";

const API = "https://api.stripe.com/v1";
const PROVIDER = "stripe";

/** Everything this adapter needs from the Worker's environment. */
export interface StripeCommerceConfig<TEnv> {
  /** The restricted or secret API key. Never a publishable key. */
  secretKey(env: TEnv): string | undefined;
  /** The `whsec_...` signing secret for the endpoint Stripe posts to. */
  webhookSecret(env: TEnv): string | undefined;
  /** Seconds a signed payload stays acceptable. Stripe's own default is 300. */
  toleranceSeconds?: number;
  now?: () => number;
}

interface StripeSubscription {
  id: string;
  status: "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";
  customer: string;
  current_period_start?: number;
  current_period_end?: number;
  start_date?: number;
  items: { data: { price: { id: string } }[] };
}

interface StripeCheckoutSession {
  id: string;
  mode: "payment" | "setup" | "subscription";
  status?: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  customer: string | null;
  subscription: string | null;
  client_reference_id: string | null;
  created: number;
  url?: string;
  expires_at?: number;
  line_items?: { data: { price: { id: string } }[] };
}

/** Stripe's subscription vocabulary, mapped onto the engine's five states. */
function subscriptionState(status: StripeSubscription["status"]): CommerceTransactionState {
  switch (status) {
    case "trialing":
    case "active":
      return "active";
    // Stripe keeps serving during a failed renewal's retry window, which is
    // exactly what the engine calls grace. `unpaid` is past the retries.
    case "past_due":
      return "grace";
    case "incomplete":
      return "pending";
    case "paused":
    case "unpaid":
    case "incomplete_expired":
      return "expired";
    case "canceled":
      return "revoked";
  }
}

function seconds(value: number | undefined, fallback: number): number {
  return value === undefined ? fallback : value * 1000;
}

export function stripeCommerceProvider<TEnv>(config: StripeCommerceConfig<TEnv>): CommerceProvider<TEnv> {
  const now = config.now ?? Date.now;
  const tolerance = (config.toleranceSeconds ?? 300) * 1000;

  const call = async <T>(env: TEnv, path: string, init?: { method: "POST"; form: Record<string, string> }): Promise<T> => {
    const key = requireSecret(config.secretKey(env), "stripe secretKey");
    const request =
      init === undefined
        ? new Request(`${API}${path}`, { headers: { authorization: basicAuth(key, "") } })
        : new Request(`${API}${path}`, {
            method: "POST",
            headers: { authorization: basicAuth(key, ""), "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(init.form).toString(),
          });
    return await providerJson<T>(PROVIDER, request);
  };

  const fromSubscription = (subscription: StripeSubscription): VerifiedCommerceTransaction => {
    const price = subscription.items.data[0]?.price.id;
    if (price === undefined) throw new Error("stripe subscription has no line item");
    const instant = now();
    return {
      providerTransactionId: subscription.id,
      providerReference: price,
      kind: "subscription",
      state: subscriptionState(subscription.status),
      purchasedAt: seconds(subscription.start_date, instant),
      validFrom: seconds(subscription.current_period_start ?? subscription.start_date, instant),
      ...(subscription.current_period_end === undefined ? {} : { validUntil: subscription.current_period_end * 1000 }),
      providerAccountId: subscription.customer,
    };
  };

  const fromSession = async (env: TEnv, session: StripeCheckoutSession): Promise<VerifiedCommerceTransaction> => {
    if (session.mode === "subscription") {
      if (session.subscription === null) throw new Error("stripe subscription session has no subscription");
      return fromSubscription(await call<StripeSubscription>(env, `/subscriptions/${session.subscription}`));
    }
    // A one-time session's line items are not expanded by default, and the
    // price is the only thing that says WHAT was bought.
    const expanded = await call<StripeCheckoutSession>(env, `/checkout/sessions/${session.id}?expand[]=line_items`);
    const price = expanded.line_items?.data[0]?.price.id;
    if (price === undefined) throw new Error("stripe session has no line item");
    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    const purchasedAt = session.created * 1000;
    return {
      providerTransactionId: session.id,
      providerReference: price,
      kind: "oneTime",
      state: paid ? "active" : "pending",
      purchasedAt,
      validFrom: purchasedAt,
      ...(session.customer === null ? {} : { providerAccountId: session.customer }),
    };
  };

  return {
    key: PROVIDER,

    products: async (env, providerReferences) => {
      const priced = await Promise.all(providerReferences.map(async (providerReference) => await call<{ id: string; unit_amount: number | null; currency: string }>(env, `/prices/${providerReference}`)));
      // A price with no unit amount is tiered or metered, which this catalog
      // cannot show as one number. Omitted rather than displayed wrongly.
      return priced.flatMap((price) =>
        price.unit_amount === null
          ? []
          : [
              {
                providerReference: price.id,
                // The minor unit, as Stripe states it. Rendering it is the
                // storefront's job: zero-decimal currencies exist.
                displayPrice: String(price.unit_amount),
                currencyCode: price.currency.toUpperCase(),
              },
            ],
      );
    },

    // The client returns from Checkout with a session id and nothing else that
    // matters. Everything below is read from Stripe.
    verifyClaim: async (env, input) => {
      const sessionId = (input.evidence as { sessionId?: unknown } | null)?.sessionId;
      if (typeof sessionId !== "string" || sessionId.length === 0) throw new Error("stripe evidence needs a sessionId");
      const session = await call<StripeCheckoutSession>(env, `/checkout/sessions/${sessionId}`);
      // The account that opened the session is the only account it can pay for.
      if (session.client_reference_id !== null && session.client_reference_id !== input.accountId) {
        throw new Error("stripe session belongs to another account");
      }
      return await fromSession(env, session);
    },

    verifyWebhook: async (env, request) => {
      const secret = requireSecret(config.webhookSecret(env), "stripe webhookSecret");
      const header = request.headers.get("stripe-signature") ?? "";
      // Raw body, before any parsing: the signature covers the exact bytes.
      const body = await request.text();
      const parts = new Map(header.split(",").map((part) => part.split("=", 2) as [string, string]));
      const timestamp = parts.get("t");
      if (timestamp === undefined) throw new Error("stripe signature has no timestamp");
      // The timestamp is inside the signed payload, so an attacker cannot move
      // it; rejecting an old one is what stops a replay of a valid capture.
      if (Math.abs(now() - Number(timestamp) * 1000) > tolerance) throw new Error("stripe signature is outside the tolerance window");
      const expected = await hmacSha256Hex(secret, `${timestamp}.${body}`);
      // `v1` only: honouring any other scheme is a downgrade waiting to happen.
      const signatures = header
        .split(",")
        .map((part) => part.split("=", 2))
        .filter(([scheme]) => scheme?.trim() === "v1")
        .map(([, value]) => value ?? "");
      if (!signatures.some((signature) => timingSafeEqualHex(expected, signature))) throw new Error("stripe signature did not verify");

      const event = JSON.parse(body) as { id: string; type: string; data: { object: Record<string, unknown> } };
      const object = event.data.object;
      const transaction = await (async (): Promise<VerifiedCommerceTransaction> => {
        if (event.type.startsWith("customer.subscription.")) {
          // Re-read rather than trust: the notification is a change signal, and
          // an out-of-order delivery would otherwise resurrect a dead state.
          return fromSubscription(await call<StripeSubscription>(env, `/subscriptions/${object.id as string}`));
        }
        if (event.type.startsWith("checkout.session.")) {
          return await fromSession(env, await call<StripeCheckoutSession>(env, `/checkout/sessions/${object.id as string}`));
        }
        throw new Error(`stripe event ${event.type} is not a commerce lifecycle event`);
      })();
      const accountId = (object.client_reference_id ?? object.metadata) as string | { eigenAccountId?: string } | undefined;
      const resolved = typeof accountId === "string" ? accountId : accountId?.eigenAccountId;
      if (resolved === undefined) throw new Error("stripe event does not name an Eigen account");
      return { providerEventId: event.id, accountId: resolved, transaction } satisfies VerifiedCommerceEvent;
    },

    reconcile: async (env, transactions) => {
      const results: VerifiedCommerceTransaction[] = [];
      for (const reference of transactions) {
        // One failure is that transaction's failure. The sweep counts it and
        // moves on, so a single dead object cannot hold up the batch.
        try {
          results.push(reference.kind === "subscription" ? fromSubscription(await call<StripeSubscription>(env, `/subscriptions/${reference.providerTransactionId}`)) : await fromSession(env, await call<StripeCheckoutSession>(env, `/checkout/sessions/${reference.providerTransactionId}`)));
        } catch {
          // Deliberately swallowed: the engine treats an unanswered reference
          // as a failure for that row, which is exactly what this is.
        }
      }
      return results;
    },

    createCheckout: async (env, input) => {
      const mode = input.offer.kind === "subscription" ? "subscription" : "payment";
      const form: Record<string, string> = {
        mode,
        "line_items[0][price]": input.providerReference,
        "line_items[0][quantity]": "1",
        success_url: input.returnUrl,
        cancel_url: input.returnUrl,
        // Binds the session to the Eigen account in both directions: the claim
        // checks it, and a webhook that arrives first can still name the owner.
        client_reference_id: input.accountId,
        "metadata[eigenAccountId]": input.accountId,
        ...(input.providerAccountId === undefined ? { customer_creation: mode === "payment" ? "always" : "if_required" } : { customer: input.providerAccountId }),
      };
      // Stripe deduplicates on this key, so the engine's operation identity and
      // Stripe's own retry protection are the same identity.
      const session = await providerJson<StripeCheckoutSession>(
        PROVIDER,
        new Request(`${API}/checkout/sessions`, {
          method: "POST",
          headers: {
            authorization: basicAuth(requireSecret(config.secretKey(env), "stripe secretKey"), ""),
            "content-type": "application/x-www-form-urlencoded",
            "idempotency-key": input.operationId,
          },
          body: new URLSearchParams(form).toString(),
        }),
      );
      if (session.url === undefined) throw new Error("stripe checkout session has no url");
      return {
        url: session.url,
        ...(session.customer === null ? {} : { providerAccountId: session.customer }),
        ...(session.expires_at === undefined ? {} : { expiresAt: session.expires_at * 1000 }),
      };
    },

    management: async (env, _accountId, providerAccountId, returnUrl) => {
      const session = await call<{ url: string }>(env, "/billing_portal/sessions", {
        method: "POST",
        form: { customer: providerAccountId, return_url: returnUrl },
      });
      return { url: session.url };
    },
  };
}
