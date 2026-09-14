/**
 * Google Play Billing for the EigenInteractive commerce runtime.
 *
 * Play is the adapter the engine's acknowledgement machinery exists for. Play
 * requires a purchase to be acknowledged within three days or it is
 * automatically refunded, and the acknowledgement must happen only after the
 * entitlement is durable -- which is exactly the order
 * `acknowledgeIfNeeded` enforces: ledger first, provider second, and the
 * reconciliation sweep repairs an acknowledgement lost in between.
 *
 * Two Play-specific facts shape the rest:
 *
 * - **The purchase token is the identity and the handle.** Every later call
 *   about a purchase needs it again, so it is returned as the transaction's
 *   `sealedProviderState` and the engine stores it for the sweep. It is a
 *   credential: it never appears in a log, an error, or a client response.
 * - **A product id is not enough.** A one-time purchase is read at
 *   `products/{productId}/tokens/{token}`, so the engine's `providerReference`
 *   is the product id; a subscription is read at `subscriptionsv2/tokens/{token}`
 *   with no product in the path, and the line item names the plan afterwards.
 *
 * There is no `createCheckout`: Play checkout is launched by the Billing
 * library on the device, and the engine answers that plainly for this provider.
 *
 * @module
 */

import type { CommerceProvider, CommerceTransactionState, VerifiedCommerceEvent, VerifiedCommerceTransaction } from "@eigeninteractive/server";
import { providerJson, requireSecret } from "@eigeninteractive/server/commerce-kit";

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const PROVIDER = "google_play";

export interface GooglePlayCommerceConfig<TEnv> {
  /** The app's package name, e.g. `com.example.game`. */
  packageName(env: TEnv): string | undefined;
  /** The service account's `client_email` from its JSON key. */
  serviceAccountEmail(env: TEnv): string | undefined;
  /** The service account's PKCS#8 `private_key`, PEM, newlines intact. */
  serviceAccountPrivateKey(env: TEnv): string | undefined;
  now?: () => number;
}

interface ProductPurchase {
  purchaseState?: number;
  acknowledgementState?: number;
  purchaseTimeMillis?: string;
  orderId?: string;
  obfuscatedExternalAccountId?: string;
}

interface SubscriptionPurchaseV2 {
  subscriptionState?: string;
  acknowledgementState?: string;
  startTime?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  lineItems?: { productId?: string; expiryTime?: string; offerDetails?: { basePlanId?: string } }[];
}

/** Play's subscription vocabulary, mapped onto the engine's five states. */
function subscriptionState(state: string | undefined): CommerceTransactionState {
  switch (state) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return "active";
    // Play keeps serving through both of these; the player should keep playing.
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "grace";
    case "SUBSCRIPTION_STATE_PENDING":
    case "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED":
      return "pending";
    // CANCELED means "will not renew", not "is over": Play keeps the
    // subscription serving until its expiry, and the engine's validUntil is
    // what ends it. ON_HOLD and PAUSED are not serving.
    case "SUBSCRIPTION_STATE_CANCELED":
    case "SUBSCRIPTION_STATE_ON_HOLD":
    case "SUBSCRIPTION_STATE_PAUSED":
    case "SUBSCRIPTION_STATE_EXPIRED":
      return "expired";
    default:
      return "expired";
  }
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function base64Url(bytes: Uint8Array | string): string {
  const binary = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function googlePlayCommerceProvider<TEnv>(config: GooglePlayCommerceConfig<TEnv>): CommerceProvider<TEnv> {
  const now = config.now ?? Date.now;
  // One access token per isolate, reused until shortly before it expires.
  // Minting is an RS256 signature plus a round trip; doing it per verification
  // would put that on the purchase path for no benefit.
  let cached: { token: string; expiresAt: number } | null = null;

  const accessToken = async (env: TEnv): Promise<string> => {
    if (cached !== null && cached.expiresAt > now() + 60_000) return cached.token;
    const email = requireSecret(config.serviceAccountEmail(env), "google play serviceAccountEmail");
    const pem = requireSecret(config.serviceAccountPrivateKey(env), "google play serviceAccountPrivateKey");
    const issued = Math.floor(now() / 1000);
    const claim = { iss: email, scope: SCOPE, aud: TOKEN_URL, iat: issued, exp: issued + 3600 };
    const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify(claim))}`;
    const key = await crypto.subtle.importKey("pkcs8", pemToPkcs8(pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
    const assertion = `${unsigned}.${base64Url(signature)}`;
    const granted = await providerJson<{ access_token: string; expires_in: number }>(
      PROVIDER,
      new Request(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
      }),
    );
    cached = { token: granted.access_token, expiresAt: now() + granted.expires_in * 1000 };
    return cached.token;
  };

  const call = async <T>(env: TEnv, path: string, method: "GET" | "POST" = "GET"): Promise<T | null> => {
    const packageName = requireSecret(config.packageName(env), "google play packageName");
    const request = new Request(`${API}/applications/${packageName}${path}`, {
      method,
      headers: { authorization: `Bearer ${await accessToken(env)}`, ...(method === "POST" ? { "content-type": "application/json" } : {}) },
      ...(method === "POST" ? { body: "{}" } : {}),
    });
    const response = await fetch(request);
    // Acknowledge returns an empty body on success, so it is read separately
    // from the JSON path rather than being parsed into nothing.
    if (response.status === 204 || response.headers.get("content-length") === "0") return null;
    if (!response.ok) throw new Error(`${PROVIDER} responded ${response.status}`);
    return (await response.json()) as T;
  };

  const readProduct = async (env: TEnv, productId: string, token: string): Promise<VerifiedCommerceTransaction> => {
    const purchase = (await call<ProductPurchase>(env, `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`)) as ProductPurchase;
    const purchasedAt = purchase.purchaseTimeMillis === undefined ? now() : Number(purchase.purchaseTimeMillis);
    // 0 purchased, 1 canceled, 2 pending.
    const state: CommerceTransactionState = purchase.purchaseState === 0 ? "active" : purchase.purchaseState === 2 ? "pending" : "revoked";
    return {
      // The order id is the stable financial identity; the token is a handle
      // that can be replaced by Play, so it is not the transaction identity.
      providerTransactionId: purchase.orderId ?? token,
      providerReference: productId,
      kind: "oneTime",
      state,
      purchasedAt,
      validFrom: purchasedAt,
      // 0 means Play is still waiting to be told, and will refund if it never is.
      requiresAcknowledgement: state === "active" && purchase.acknowledgementState === 0,
      sealedProviderState: JSON.stringify({ productId, token }),
      ...(purchase.obfuscatedExternalAccountId === undefined ? {} : { providerAccountId: purchase.obfuscatedExternalAccountId }),
    };
  };

  const readSubscription = async (env: TEnv, token: string): Promise<VerifiedCommerceTransaction> => {
    const purchase = (await call<SubscriptionPurchaseV2>(env, `/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`)) as SubscriptionPurchaseV2;
    const line = purchase.lineItems?.[0];
    const productId = line?.productId;
    if (productId === undefined) throw new Error("google play subscription has no line item");
    const state = subscriptionState(purchase.subscriptionState);
    const startedAt = purchase.startTime === undefined ? now() : Date.parse(purchase.startTime);
    return {
      providerTransactionId: token,
      providerReference: productId,
      kind: "subscription",
      state,
      purchasedAt: startedAt,
      validFrom: startedAt,
      ...(line?.expiryTime === undefined ? {} : { validUntil: Date.parse(line.expiryTime) }),
      requiresAcknowledgement: (state === "active" || state === "grace") && purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING",
      sealedProviderState: JSON.stringify({ kind: "subscription", token }),
      ...(purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId === undefined ? {} : { providerAccountId: purchase.externalAccountIdentifiers.obfuscatedExternalAccountId }),
    };
  };

  const readSealed = async (env: TEnv, sealed: string): Promise<VerifiedCommerceTransaction> => {
    const handle = JSON.parse(sealed) as { kind?: string; productId?: string; token: string };
    return handle.kind === "subscription" || handle.productId === undefined ? await readSubscription(env, handle.token) : await readProduct(env, handle.productId, handle.token);
  };

  return {
    key: PROVIDER,

    // No `products`: the Play Billing library on the device already holds the
    // localized price, and it is the only copy the player will ever be shown.

    verifyClaim: async (env, input) => {
      const evidence = input.evidence as { purchaseToken?: unknown; kind?: unknown } | null;
      const token = evidence?.purchaseToken;
      if (typeof token !== "string" || token.length === 0) throw new Error("google play evidence needs a purchaseToken");
      const transaction = evidence?.kind === "subscription" ? await readSubscription(env, token) : await readProduct(env, input.expectedProviderReference, token);
      // Play's obfuscated account id is the only link back to the buyer, so a
      // token minted for someone else must not become this account's grant.
      if (transaction.providerAccountId !== undefined && transaction.providerAccountId !== input.accountId) {
        throw new Error("google play purchase belongs to another account");
      }
      return transaction;
    },

    /**
     * Real-time Developer Notifications, delivered by Pub/Sub push.
     *
     * The message is a change signal and nothing more -- it carries a token, not
     * a state -- so the current purchase is always read back from the API. The
     * push endpoint itself must be authenticated by the deployment (a Pub/Sub
     * OIDC token, or an unguessable path), which is why there is no signature
     * to check here: Google does not sign the body.
     */
    verifyWebhook: async (env, request) => {
      const envelope = (await request.json()) as { message?: { data?: string; messageId?: string } };
      const encoded = envelope.message?.data;
      if (typeof encoded !== "string") throw new Error("google play notification has no message data");
      const notification = JSON.parse(atob(encoded)) as {
        packageName?: string;
        subscriptionNotification?: { purchaseToken?: string };
        oneTimeProductNotification?: { purchaseToken?: string; sku?: string };
        voidedPurchaseNotification?: { purchaseToken?: string };
      };
      const subscriptionToken = notification.subscriptionNotification?.purchaseToken ?? notification.voidedPurchaseNotification?.purchaseToken;
      const oneTime = notification.oneTimeProductNotification;
      const transaction = oneTime?.purchaseToken !== undefined && oneTime.sku !== undefined ? await readProduct(env, oneTime.sku, oneTime.purchaseToken) : subscriptionToken !== undefined ? await readSubscription(env, subscriptionToken) : undefined;
      if (transaction === undefined) throw new Error("google play notification names no purchase");
      if (transaction.providerAccountId === undefined) throw new Error("google play purchase carries no obfuscated account id");
      return {
        providerEventId: envelope.message?.messageId ?? `${transaction.providerTransactionId}:${transaction.state}`,
        accountId: transaction.providerAccountId,
        transaction,
      } satisfies VerifiedCommerceEvent;
    },

    reconcile: async (env, transactions) => {
      const results: VerifiedCommerceTransaction[] = [];
      for (const reference of transactions) {
        if (reference.sealedProviderState === undefined) continue;
        try {
          results.push(await readSealed(env, reference.sealedProviderState));
        } catch {
          // Unanswered: the engine counts it against that row and moves on.
        }
      }
      return results;
    },

    acknowledge: async (env, transaction) => {
      if (transaction.sealedProviderState === undefined) throw new Error("google play acknowledgement needs the purchase token");
      const handle = JSON.parse(transaction.sealedProviderState) as { kind?: string; productId?: string; token: string };
      const path = handle.kind === "subscription" || handle.productId === undefined ? `/purchases/subscriptionsv2/tokens/${encodeURIComponent(handle.token)}:acknowledge` : `/purchases/products/${encodeURIComponent(handle.productId)}/tokens/${encodeURIComponent(handle.token)}:acknowledge`;
      await call(env, path, "POST");
    },

    // No `createCheckout` or `management`: Play's purchase flow is launched by
    // the Billing library on the device, and subscriptions are managed in the
    // Play app.
  };
}
