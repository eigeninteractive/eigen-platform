/**
 * Razorpay for the EigenInteractive commerce runtime.
 *
 * Razorpay is the third storefront because India is a card-hostile market that
 * runs on UPI, netbanking and mandates, and neither Play nor Stripe covers it
 * the same way. The integration differs from Stripe in three ways worth
 * knowing before reading further:
 *
 * - **There is no Price object.** A one-time sale is an Order carrying an
 *   amount, and a recurring one is a Plan. The engine's `providerReference` is
 *   therefore a `plan_...` for a subscription and the engine's own offer key
 *   for a one-time sale, whose amount comes from the catalog rather than the
 *   provider. `amounts` carries those, in the minor unit, because Razorpay has
 *   nothing to read them from.
 * - **Hosted checkout is a Payment Link.** There is no Checkout Session; a link
 *   is created server-side and the player is sent to its `short_url`.
 * - **There is no customer portal.** Razorpay has no Stripe-style billing
 *   portal, so `management` is deliberately absent and the engine's management
 *   route answers that this provider is managed elsewhere.
 *
 * @module
 */

import type { CommerceProvider, CommerceTransactionState, VerifiedCommerceEvent, VerifiedCommerceTransaction } from "@eigeninteractive/server";
import { basicAuth, hmacSha256Hex, providerJson, requireSecret, timingSafeEqualHex } from "@eigeninteractive/server/commerce-kit";

const API = "https://api.razorpay.com/v1";
const PROVIDER = "razorpay";

export interface RazorpayCommerceConfig<TEnv> {
  keyId(env: TEnv): string | undefined;
  keySecret(env: TEnv): string | undefined;
  /** The secret configured on the webhook, not the API key secret. */
  webhookSecret(env: TEnv): string | undefined;
  /**
   * Amount in the minor unit and currency per one-time `providerReference`.
   * Razorpay has no priced product to read, so a payment link must be told.
   */
  amounts?: Readonly<Record<string, { amount: number; currency: string }>>;
  now?: () => number;
}

interface RazorpaySubscription {
  id: string;
  plan_id: string;
  customer_id?: string;
  status: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "expired" | "paused";
  current_start?: number | null;
  current_end?: number | null;
  start_at?: number | null;
  created_at: number;
}

interface RazorpayPayment {
  id: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  order_id: string | null;
  customer_id?: string | null;
  created_at: number;
  notes?: Record<string, string>;
}

/**
 * Razorpay's subscription vocabulary, mapped onto the engine's five states.
 *
 * `pending` is the interesting one: Razorpay means "an auto-charge failed and
 * we are retrying", which is a grace period the player should keep playing
 * through, not the engine's `pending`, which means "not paid for yet".
 */
function subscriptionState(status: RazorpaySubscription["status"]): CommerceTransactionState {
  switch (status) {
    case "active":
    case "authenticated":
      return "active";
    case "pending":
      return "grace";
    case "created":
      return "pending";
    case "halted":
    case "completed":
    case "expired":
    case "paused":
      return "expired";
    case "cancelled":
      return "revoked";
  }
}

function instantOf(seconds: number | null | undefined, fallback: number): number {
  return seconds === null || seconds === undefined ? fallback : seconds * 1000;
}

export function razorpayCommerceProvider<TEnv>(config: RazorpayCommerceConfig<TEnv>): CommerceProvider<TEnv> {
  const now = config.now ?? Date.now;

  const auth = (env: TEnv): string => basicAuth(requireSecret(config.keyId(env), "razorpay keyId"), requireSecret(config.keySecret(env), "razorpay keySecret"));

  const call = async <T>(env: TEnv, path: string): Promise<T> => await providerJson<T>(PROVIDER, new Request(`${API}${path}`, { headers: { authorization: auth(env) } }));

  const fromSubscription = (subscription: RazorpaySubscription): VerifiedCommerceTransaction => ({
    providerTransactionId: subscription.id,
    providerReference: subscription.plan_id,
    kind: "subscription",
    state: subscriptionState(subscription.status),
    purchasedAt: instantOf(subscription.start_at ?? subscription.created_at, now()),
    validFrom: instantOf(subscription.current_start ?? subscription.start_at ?? subscription.created_at, now()),
    ...(subscription.current_end === null || subscription.current_end === undefined ? {} : { validUntil: subscription.current_end * 1000 }),
    ...(subscription.customer_id === undefined || subscription.customer_id === null ? {} : { providerAccountId: subscription.customer_id }),
  });

  /** A one-time payment. The offer it paid for rides in `notes`, because a
   * Razorpay payment has no product identity of its own to read back. */
  const fromPayment = (payment: RazorpayPayment): VerifiedCommerceTransaction => {
    const providerReference = payment.notes?.eigenProviderReference;
    if (providerReference === undefined) throw new Error("razorpay payment does not name an Eigen offer");
    const purchasedAt = payment.created_at * 1000;
    return {
      providerTransactionId: payment.id,
      providerReference,
      kind: "oneTime",
      state: payment.status === "captured" ? "active" : payment.status === "refunded" || payment.status === "failed" ? "revoked" : "pending",
      purchasedAt,
      validFrom: purchasedAt,
      ...(payment.customer_id === undefined || payment.customer_id === null ? {} : { providerAccountId: payment.customer_id }),
    };
  };

  return {
    key: PROVIDER,

    // Razorpay has no priced product to read, so only the references the
    // deployment gave an amount for can be shown at all.
    products: async (_env, providerReferences) =>
      providerReferences.flatMap((providerReference) => {
        const priced = config.amounts?.[providerReference];
        return priced === undefined ? [] : [{ providerReference, displayPrice: String(priced.amount), currencyCode: priced.currency }];
      }),

    verifyClaim: async (env, input) => {
      const evidence = input.evidence as { paymentId?: unknown; subscriptionId?: unknown } | null;
      if (typeof evidence?.subscriptionId === "string" && evidence.subscriptionId.length > 0) {
        return fromSubscription(await call<RazorpaySubscription>(env, `/subscriptions/${evidence.subscriptionId}`));
      }
      if (typeof evidence?.paymentId !== "string" || evidence.paymentId.length === 0) {
        throw new Error("razorpay evidence needs a paymentId or a subscriptionId");
      }
      const payment = await call<RazorpayPayment>(env, `/payments/${evidence.paymentId}`);
      // The link was created for one account; a payment carrying another
      // account's note is not this caller's to claim.
      if (payment.notes?.eigenAccountId !== undefined && payment.notes.eigenAccountId !== input.accountId) {
        throw new Error("razorpay payment belongs to another account");
      }
      return fromPayment(payment);
    },

    verifyWebhook: async (env, request) => {
      const secret = requireSecret(config.webhookSecret(env), "razorpay webhookSecret");
      const signature = request.headers.get("x-razorpay-signature") ?? "";
      // Razorpay signs the raw body alone -- no timestamp, unlike Stripe -- so
      // the engine's event-identity deduplication is what stops a replay.
      const body = await request.text();
      const expected = await hmacSha256Hex(secret, body);
      if (!timingSafeEqualHex(expected, signature)) throw new Error("razorpay signature did not verify");

      const event = JSON.parse(body) as {
        event: string;
        payload: { subscription?: { entity: RazorpaySubscription }; payment?: { entity: RazorpayPayment } };
      };
      const subscription = event.payload.subscription?.entity;
      const payment = event.payload.payment?.entity;
      const transaction = subscription !== undefined ? fromSubscription(await call<RazorpaySubscription>(env, `/subscriptions/${subscription.id}`)) : payment !== undefined ? fromPayment(await call<RazorpayPayment>(env, `/payments/${payment.id}`)) : undefined;
      if (transaction === undefined) throw new Error(`razorpay event ${event.event} carries no subscription or payment`);
      const accountId = payment?.notes?.eigenAccountId ?? (subscription as unknown as { notes?: Record<string, string> } | undefined)?.notes?.eigenAccountId;
      if (accountId === undefined) throw new Error("razorpay event does not name an Eigen account");
      // Razorpay sends no event id of its own, so the identity is the event
      // name and the object it concerns -- stable under redelivery, which is
      // all the ledger's deduplication needs.
      return { providerEventId: `${event.event}:${transaction.providerTransactionId}:${transaction.state}`, accountId, transaction } satisfies VerifiedCommerceEvent;
    },

    reconcile: async (env, transactions) => {
      const results: VerifiedCommerceTransaction[] = [];
      for (const reference of transactions) {
        try {
          results.push(reference.kind === "subscription" ? fromSubscription(await call<RazorpaySubscription>(env, `/subscriptions/${reference.providerTransactionId}`)) : fromPayment(await call<RazorpayPayment>(env, `/payments/${reference.providerTransactionId}`)));
        } catch {
          // Unanswered: the engine counts it against that row and moves on.
        }
      }
      return results;
    },

    createCheckout: async (env, input) => {
      if (input.offer.kind === "subscription") {
        const subscription = await providerJson<RazorpaySubscription & { short_url?: string }>(
          PROVIDER,
          new Request(`${API}/subscriptions`, {
            method: "POST",
            headers: { authorization: auth(env), "content-type": "application/json" },
            body: JSON.stringify({
              plan_id: input.providerReference,
              total_count: 120,
              customer_notify: 1,
              notes: { eigenAccountId: input.accountId, eigenOperationId: input.operationId, eigenProviderReference: input.providerReference },
            }),
          }),
        );
        if (subscription.short_url === undefined) throw new Error("razorpay subscription has no short_url");
        return { url: subscription.short_url, ...(subscription.customer_id === undefined ? {} : { providerAccountId: subscription.customer_id }) };
      }
      const priced = config.amounts?.[input.providerReference];
      if (priced === undefined) throw new Error(`razorpay: no amount configured for ${input.providerReference}`);
      const link = await providerJson<{ id: string; short_url: string; expire_by?: number }>(
        PROVIDER,
        new Request(`${API}/payment_links`, {
          method: "POST",
          headers: { authorization: auth(env), "content-type": "application/json" },
          body: JSON.stringify({
            amount: priced.amount,
            currency: priced.currency,
            description: input.offer.name,
            // Razorpay rejects a duplicate reference_id, which makes the
            // engine's operation identity the link's identity too.
            reference_id: input.operationId,
            callback_url: input.returnUrl,
            callback_method: "get",
            notes: { eigenAccountId: input.accountId, eigenProviderReference: input.providerReference },
          }),
        }),
      );
      return { url: link.short_url, ...(link.expire_by === undefined ? {} : { expiresAt: link.expire_by * 1000 }) };
    },

    // Deliberately no `management`: Razorpay has no customer-facing billing
    // portal, and the engine answers 400 for a provider that cannot open one
    // rather than this adapter inventing a page that does not exist.
  };
}
