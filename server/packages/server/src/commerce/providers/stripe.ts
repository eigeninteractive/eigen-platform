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
 * - **A refund changes the charge, not the session.** A one-time purchase is
 *   read with its payment's charge, so a full refund or a lost dispute revokes
 *   it, and the charge's own events find the session it paid for.
 *
 * @module @eigeninteractive/server/commerce/stripe
 */

import { basicAuth, hmacSha256Hex, ProviderRefusal, providerJson, requireSecret, timingSafeEqualHex } from "../provider-kit.js";
import type { CommerceProvider, CommerceTransactionState, VerifiedCommerceEvent, VerifiedCommerceTransaction } from "../types.js";

const API = "https://api.stripe.com/v1";
const PROVIDER = "stripe";

/**
 * The API version every request pins.
 *
 * Unpinned, Stripe answers in whatever version the merchant's dashboard is set
 * to, which they can change without telling anyone who wrote code against it.
 * That is not hypothetical here: Basil (2025-03-31) moved a subscription's
 * billing period onto its line items, and an adapter reading the old field
 * would quietly stop knowing when a subscription ends.
 */
const API_VERSION = "2026-08-26.dahlia";

/** Everything this adapter needs from the Worker's environment. */
export interface StripeCommerceConfig<TEnv> {
  /** The restricted or secret API key. Never a publishable key. */
  secretKey(env: TEnv): string | undefined;
  /** The `whsec_...` signing secret for the endpoint Stripe posts to. */
  webhookSecret(env: TEnv): string | undefined;
  /** Seconds a signed payload stays acceptable. Stripe's own default is 300. */
  toleranceSeconds?: number;
  /**
   * Override the pinned API version. Set the webhook endpoint to the same
   * version, and expect to revisit the field mapping below if you move back
   * past Basil.
   */
  apiVersion?: string;
  now?: () => number;
}

interface StripeSubscriptionItem {
  price: { id: string };
  /** Basil and later. Each item bills on its own period. */
  current_period_start?: number;
  current_period_end?: number;
}

interface StripeSubscription {
  id: string;
  status: "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";
  customer: string;
  /** Pre-Basil only; read through `periodOf` rather than directly. */
  current_period_start?: number;
  current_period_end?: number;
  start_date?: number;
  items: { data: StripeSubscriptionItem[] };
}

/**
 * The subscription's billing period, from wherever this API version keeps it.
 *
 * Basil moved these onto the line items. A subscription may now hold items on
 * different intervals, so "the" period is the one that ends last: that is when
 * the account stops being paid up, which is the only question an entitlement
 * asks. The subscription-level fields are the pre-Basil fallback.
 */
function periodOf(subscription: StripeSubscription): { start?: number; end?: number } {
  const ends = subscription.items.data.flatMap((item) => (item.current_period_end === undefined ? [] : [item.current_period_end]));
  const starts = subscription.items.data.flatMap((item) => (item.current_period_start === undefined ? [] : [item.current_period_start]));
  return {
    start: starts.length > 0 ? Math.min(...starts) : subscription.current_period_start,
    end: ends.length > 0 ? Math.max(...ends) : subscription.current_period_end,
  };
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
  /** Expanded to its latest charge when a one-time session is read. */
  payment_intent?: string | { id: string; latest_charge?: string | StripeCharge | null } | null;
}

interface StripeCharge {
  /** Fully refunded; a partial refund leaves it false. */
  refunded?: boolean;
  disputed?: boolean;
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
    const version = config.apiVersion ?? API_VERSION;
    const request =
      init === undefined
        ? new Request(`${API}${path}`, { headers: { authorization: basicAuth(key, ""), "stripe-version": version } })
        : new Request(`${API}${path}`, {
            method: "POST",
            headers: { authorization: basicAuth(key, ""), "stripe-version": version, "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(init.form).toString(),
          });
    return await providerJson<T>(PROVIDER, request);
  };

  const fromSubscription = (subscription: StripeSubscription): VerifiedCommerceTransaction => {
    const price = subscription.items.data[0]?.price.id;
    if (price === undefined) throw new Error("stripe subscription has no line item");
    const instant = now();
    const period = periodOf(subscription);
    return {
      providerTransactionId: subscription.id,
      providerReference: price,
      kind: "subscription",
      state: subscriptionState(subscription.status),
      purchasedAt: seconds(subscription.start_date, instant),
      validFrom: seconds(period.start ?? subscription.start_date, instant),
      ...(period.end === undefined ? {} : { validUntil: period.end * 1000 }),
      providerAccountId: subscription.customer,
    };
  };

  const disputeLost = async (env: TEnv, paymentIntent: string): Promise<boolean> => (await call<{ data: { status: string }[] }>(env, `/disputes?payment_intent=${encodeURIComponent(paymentIntent)}`)).data.some((dispute) => dispute.status === "lost");

  const fromSession = async (env: TEnv, session: StripeCheckoutSession): Promise<VerifiedCommerceTransaction> => {
    if (session.mode === "subscription") {
      if (session.subscription === null) throw new Error("stripe subscription session has no subscription");
      return fromSubscription(await call<StripeSubscription>(env, `/subscriptions/${session.subscription}`));
    }
    // A one-time session's line items are not expanded by default, and the
    // price is the only thing that says WHAT was bought. The charge is what
    // says whether the money was given back, which the session never records.
    const expanded = await call<StripeCheckoutSession>(env, `/checkout/sessions/${session.id}?expand[]=line_items&expand[]=payment_intent.latest_charge`);
    const price = expanded.line_items?.data[0]?.price.id;
    if (price === undefined) throw new Error("stripe session has no line item");
    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    const intent = typeof expanded.payment_intent === "object" ? expanded.payment_intent : null;
    const charge = typeof intent?.latest_charge === "object" ? intent.latest_charge : null;
    // A dispute only takes the money once it is lost; until then the player
    // keeps what they bought.
    const reversed = charge !== null && (charge.refunded === true || (charge.disputed === true && intent !== null && (await disputeLost(env, intent.id))));
    const purchasedAt = session.created * 1000;
    return {
      providerTransactionId: session.id,
      providerReference: price,
      kind: "oneTime",
      state: reversed ? "revoked" : paid ? "active" : "pending",
      purchasedAt,
      validFrom: purchasedAt,
      ...(session.customer === null ? {} : { providerAccountId: session.customer }),
    };
  };

  return {
    key: PROVIDER,

    // Only the mistake worth catching: a Product id where a Price belongs. A
    // Price created from a legacy Plan keeps whatever id the Plan had, so the
    // positive form cannot be checked.
    validateReference: (reference) => {
      if (reference.startsWith("prod_")) throw new Error("a Stripe offer is sold through a Price (price_...), not a Product");
    },

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
        throw new ProviderRefusal("stripe session belongs to another account");
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
      const transaction = await (async (): Promise<VerifiedCommerceTransaction | undefined> => {
        if (event.type.startsWith("customer.subscription.")) {
          // Re-read rather than trust: the notification is a change signal, and
          // an out-of-order delivery would otherwise resurrect a dead state.
          return fromSubscription(await call<StripeSubscription>(env, `/subscriptions/${object.id as string}`));
        }
        if (event.type.startsWith("checkout.session.")) {
          return await fromSession(env, await call<StripeCheckoutSession>(env, `/checkout/sessions/${object.id as string}`));
        }
        if (event.type === "charge.refunded" || event.type === "charge.dispute.closed") {
          // Both name the payment; the session that took it is the
          // transaction. A charge no Checkout Session took -- a subscription
          // invoice's -- is about no purchase this adapter records.
          const paymentIntent = object.payment_intent;
          if (typeof paymentIntent !== "string") return undefined;
          const sessions = await call<{ data: StripeCheckoutSession[] }>(env, `/checkout/sessions?payment_intent=${encodeURIComponent(paymentIntent)}`);
          const session = sessions.data[0];
          return session?.mode === "payment" ? await fromSession(env, session) : undefined;
        }
        return undefined;
      })();
      // An endpoint subscribed to more than the lifecycle events is told about
      // invoices, customers and the rest. Authentic, and about no purchase.
      if (transaction === undefined) return null;
      const accountId = (object.client_reference_id ?? object.metadata) as string | { eigenAccountId?: string } | undefined;
      const resolved = typeof accountId === "string" ? accountId : accountId?.eigenAccountId;
      return { providerEventId: event.id, ...(resolved === undefined ? {} : { accountId: resolved }), transaction } satisfies VerifiedCommerceEvent;
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
      // Stripe substitutes the session id into this placeholder on the way
      // back, and it is the only thing the returning client can present as
      // claim evidence -- `verifyClaim` reads the session from it. The braces
      // must reach Stripe unescaped, so this is string concatenation rather
      // than `URL.searchParams`, which would percent-encode them.
      const successUrl = `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
      const form: Record<string, string> = {
        mode,
        "line_items[0][price]": input.providerReference,
        "line_items[0][quantity]": "1",
        success_url: successUrl,
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
            "stripe-version": config.apiVersion ?? API_VERSION,
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
