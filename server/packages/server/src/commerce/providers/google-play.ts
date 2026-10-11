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
 * Play-specific facts shape the rest:
 *
 * - **The purchase token is the identity and the handle.** Every later call
 *   about a purchase needs it again, so it is returned as the transaction's
 *   `sealedProviderState` and the engine stores it for the sweep. It is a
 *   credential: it never appears in a log, an error, or a client response.
 * - **A product id is not enough.** A one-time purchase is read at
 *   `products/{productId}/tokens/{token}`, so the engine's `providerReference`
 *   is the product id. A subscription product sells through base plans --
 *   monthly and yearly are two base plans of one product -- so its reference is
 *   `{productId}:{basePlanId}` (see {@link googlePlaySubscriptionReference}).
 *   An offer (a free trial, an introductory price) is a price on a base plan,
 *   not a different thing bought, so it is deliberately not part of the
 *   reference; its offer token is the device's business when it launches the
 *   Billing flow.
 * - **The device cannot say which base plan it bought.** Play's on-device
 *   purchase names the product, not the plan, so a claim may name any plan of
 *   that product; the plan Play reports here is the one recorded.
 * - **A plan change is a new purchase.** Play issues a new purchase token for
 *   every plan change, to be claimed and acknowledged like any purchase, and
 *   reports the old token expired. A deferred change issues it at once but
 *   keeps serving the old plan from it until renewal, so the new token holds
 *   two line items and swaps which one serves. The reference is read from
 *   whichever is serving now, and the ledger moves the transaction to the new
 *   offer when that changes.
 * - **Acknowledgement is not on the v2 resource.** Subscriptions are read from
 *   `subscriptionsv2` but acknowledged at `subscriptions/{productId}/tokens`,
 *   which has no v2 counterpart.
 *
 * There is no `createCheckout`: Play checkout is launched by the Billing
 * library on the device, and the engine answers that plainly for this provider.
 *
 * @module @eigeninteractive/server/commerce/google-play
 */

import { providerJson, requireSecret } from "../provider-kit.js";
import type { CommerceProvider, CommerceTransactionState, VerifiedCommerceEvent, VerifiedCommerceTransaction } from "../types.js";

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
  lineItems?: SubscriptionLineItem[];
}

interface SubscriptionLineItem {
  productId?: string;
  expiryTime?: string;
  offerDetails?: { basePlanId?: string };
  deferredItemReplacement?: { productId?: string };
}

/**
 * The `providerReference` a catalog names for a Play subscription base plan.
 *
 * Play product ids are lowercase letters, digits, underscores and periods, and
 * base plan ids are lowercase letters, digits and hyphens, so the colon cannot
 * occur in either half.
 */
export function googlePlaySubscriptionReference(productId: string, basePlanId: string): string {
  return `${productId}:${basePlanId}`;
}

/** A catalog reference read back: a base plan means a subscription. */
function parseReference(reference: string): { productId: string; basePlanId?: string } {
  const separator = reference.indexOf(":");
  return separator < 0 ? { productId: reference } : { productId: reference.slice(0, separator), basePlanId: reference.slice(separator + 1) };
}

function lineReference(line: SubscriptionLineItem): string {
  const productId = line.productId;
  const basePlanId = line.offerDetails?.basePlanId;
  if (productId === undefined) throw new Error("google play subscription line item has no product");
  if (basePlanId === undefined) throw new Error("google play subscription line item has no base plan");
  return googlePlaySubscriptionReference(productId, basePlanId);
}

/**
 * Which line item the purchase is serving now.
 *
 * A purchase holds several line items in two cases. The token a deferred plan
 * change issues keeps the old item, which names its replacement in
 * `deferredItemReplacement`, beside the new one until renewal; after it the old
 * item's expiry is in the past and the new one's in the future. Until then the
 * old item serves, even if Play has already given the new one an expiry. Add-on
 * subscriptions hold several items serving at once; one transaction grants one
 * offer, so those are refused rather than silently granting the first.
 */
function servingLine(items: readonly SubscriptionLineItem[], now: number): SubscriptionLineItem {
  if (items.length === 0) throw new Error("google play subscription has no line item");
  const expiry = (item: SubscriptionLineItem) => (item.expiryTime === undefined ? undefined : Date.parse(item.expiryTime));
  const live = items.filter((item) => (expiry(item) ?? 0) > now);
  // An item still waiting to replace a live one does not serve yet.
  const replacing = live.filter((item) => item.deferredItemReplacement !== undefined);
  const waiting = (item: SubscriptionLineItem) => replacing.some((old) => old !== item && old.deferredItemReplacement?.productId === item.productId);
  const serving = live.filter((item) => !waiting(item));
  if (serving.length > 1) throw new Error("google play subscription serves several line items; add-on subscriptions are not supported");
  // Nothing serving: an expired purchase answers with its latest item, and a
  // pending one, which has no expiry anywhere, with its only item.
  return serving[0] ?? items.reduce((latest, item) => ((expiry(item) ?? 0) > (expiry(latest) ?? 0) ? item : latest));
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
    const line = servingLine(purchase.lineItems ?? [], now());
    const state = subscriptionState(purchase.subscriptionState);
    const startedAt = purchase.startTime === undefined ? now() : Date.parse(purchase.startTime);
    return {
      providerTransactionId: token,
      providerReference: lineReference(line),
      kind: "subscription",
      state,
      purchasedAt: startedAt,
      validFrom: startedAt,
      ...(line.expiryTime === undefined ? {} : { validUntil: Date.parse(line.expiryTime) }),
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
      const evidence = input.evidence as { purchaseToken?: unknown } | null;
      const token = evidence?.purchaseToken;
      if (typeof token !== "string" || token.length === 0) throw new Error("google play evidence needs a purchaseToken");
      // The reference's shape says which API holds the purchase, so the device
      // never has to. Which base plan it was is the subscription's to say: the
      // device can name any plan of the product, and the one Play reports is
      // the one recorded.
      const expected = parseReference(input.expectedProviderReference);
      const transaction = expected.basePlanId === undefined ? await readProduct(env, expected.productId, token) : await readSubscription(env, token);
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
      const token = encodeURIComponent(handle.token);
      // `subscriptionsv2` has no acknowledge method; the v1 resource does, and
      // takes the product the transaction's reference names.
      const path = handle.kind === "subscription" || handle.productId === undefined ? `/purchases/subscriptions/${encodeURIComponent(parseReference(transaction.providerReference).productId)}/tokens/${token}:acknowledge` : `/purchases/products/${encodeURIComponent(handle.productId)}/tokens/${token}:acknowledge`;
      await call(env, path, "POST");
    },

    // No `createCheckout` or `management`: Play's purchase flow is launched by
    // the Billing library on the device, and subscriptions are managed in the
    // Play app.
  };
}
