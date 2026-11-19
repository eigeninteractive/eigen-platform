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
 * - **Identity and credentials have separate lifetimes.** A digest of the
 *   purchase token identifies the transaction. The token itself is encrypted
 *   in `sealedProviderState` for later calls to Play.
 * - **A product id is not enough.** A one-time product's reference is its
 *   product id, read back from `productsv2` by token alone, so Play -- not the
 *   claim -- says which product was bought. A subscription product sells
 *   through base plans --
 *   monthly and yearly are two base plans of one product -- so its reference is
 *   `{productId}:{basePlanId}` (see {@link googlePlaySubscriptionReference}).
 *   An offer (a free trial, an introductory price) is a price on a base plan,
 *   not a different thing bought, so it is deliberately not part of the
 *   reference; its offer token is the device's business when it launches the
 *   Billing flow.
 * - **The token stays stable through payment.** An order id only exists once
 *   payment completes, so the digest identifies pending purchases too.
 * - **The device cannot say which base plan it bought.** Play's on-device
 *   purchase names the product, not the plan, so a claim may name any plan of
 *   that product; the plan Play reports here is the one recorded.
 * - **A plan change is a new purchase.** Play issues a new purchase token for
 *   every plan change, to be claimed and acknowledged like any purchase, names
 *   the old one as `linkedPurchaseToken`, and reports it expired. The ledger
 *   ends the old transaction, as Google asks. A deferred change issues it at once but
 *   keeps serving the old plan from it until renewal, so the new token holds
 *   two line items and swaps which one serves. The reference is read from
 *   whichever is serving now, and the ledger moves the transaction to the new
 *   offer when that changes.
 * - **Acknowledgement is not on the v2 resources.** Purchases are read from
 *   `productsv2` and `subscriptionsv2` but acknowledged at the v1
 *   `products/{productId}/tokens` and `subscriptions/{productId}/tokens`,
 *   which have no v2 counterpart.
 * - **A refund is a notification, not a state.** A voided one-time purchase
 *   may still read as purchased, so the voided notification itself revokes it,
 *   as Google's notification reference allows.
 * - **Notifications are authenticated by their delivery, not their body.**
 *   Google signs nothing in a Real-time Developer Notification. Pub/Sub push
 *   attaches a Google-signed token naming the service account it delivers as
 *   and the endpoint it delivers to, so a notification is read only when that
 *   token verifies, names this game's service account, and was minted for the
 *   URL it arrived at.
 *
 * There is no `createCheckout`: Play checkout is launched by the Billing
 * library on the device, and the engine answers that plainly for this provider.
 *
 * @module @eigeninteractive/server/commerce/google-play
 */

import { base64url, CompactEncrypt, compactDecrypt, createRemoteJWKSet, importPKCS8, type JWTPayload, jwtVerify, SignJWT } from "jose";
import { ProviderRefusal, providerJson, requireSecret } from "../provider-kit.js";
import type { CommerceProvider, CommerceTransactionReference, CommerceTransactionState, VerifiedCommerceEvent, VerifiedCommerceTransaction } from "../types.js";

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const PROVIDER = "google_play";
/** The keys Google signs Pub/Sub push tokens with, and who it says signed. */
const GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface GooglePlayCommerceConfig<TEnv> {
  /** The app's package name, e.g. `com.example.game`. */
  packageName(env: TEnv): string | undefined;
  /** The service account's `client_email` from its JSON key. It is also the
   * account the Pub/Sub push subscription delivers notifications as: a
   * notification delivered as anyone else is refused. */
  serviceAccountEmail(env: TEnv): string | undefined;
  /** The service account's PKCS#8 `private_key`, PEM, newlines intact. */
  serviceAccountPrivateKey(env: TEnv): string | undefined;
  /** An independent, base64url-encoded 32-byte Worker secret for purchase tokens. */
  purchaseTokenKey(env: TEnv): string | undefined;
  now?: () => number;
}

interface ProductPurchaseV2 {
  productLineItem?: { productId?: string; productOfferDetails?: { refundableQuantity?: number } }[];
  purchaseStateContext?: { purchaseState?: "PURCHASED" | "CANCELLED" | "PENDING" };
  acknowledgementState?: string;
  purchaseCompletionTime?: string;
  obfuscatedExternalAccountId?: string;
}

interface SubscriptionPurchaseV2 {
  subscriptionState?: string;
  acknowledgementState?: string;
  startTime?: string;
  linkedPurchaseToken?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  lineItems?: SubscriptionLineItem[];
}

/** A Real-time Developer Notification, decoded from its Pub/Sub envelope. */
interface DeveloperNotification {
  subscriptionNotification?: { purchaseToken?: string };
  oneTimeProductNotification?: { purchaseToken?: string };
  /** `productType` 1 is a subscription and 2 a one-time product; `refundType`
   * 1 voids the whole purchase and 2 part of a multi-quantity one. */
  voidedPurchaseNotification?: { purchaseToken?: string; productType?: number; refundType?: number };
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

/** Play's own id rules: a product id is lowercase letters, digits,
 * underscores and periods; a base plan id is lowercase letters, digits and
 * hyphens. Both start with a letter or digit. */
const PRODUCT_ID = /^[a-z0-9][a-z0-9_.]*$/;
const BASE_PLAN_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

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
  if (serving.length > 1) throw new ProviderRefusal("google play subscription serves several line items; add-on subscriptions are not supported");
  // Nothing serving: an expired purchase answers with its latest item, and a
  // pending one, which has no expiry anywhere, with its only item.
  return serving[0] ?? items.reduce((latest, item) => ((expiry(item) ?? 0) > (expiry(latest) ?? 0) ? item : latest));
}

/** Play's subscription vocabulary, mapped onto the engine's five states. */
function subscriptionState(state: string | undefined, paidThrough: boolean): CommerceTransactionState {
  switch (state) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return "active";
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "grace";
    case "SUBSCRIPTION_STATE_PENDING":
      return "pending";
    // Cancellation stops renewal. The verified line supplies the date when
    // paid access ends, which can already be past after an account hold.
    case "SUBSCRIPTION_STATE_CANCELED":
      return paidThrough ? "active" : "expired";
    case "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED":
    case "SUBSCRIPTION_STATE_ON_HOLD":
    case "SUBSCRIPTION_STATE_PAUSED":
    case "SUBSCRIPTION_STATE_EXPIRED":
      return "expired";
    default:
      return "expired";
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const tokenEncryption = { alg: "dir", enc: "A256GCM" } as const;

async function transactionId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return base64url.encode(new Uint8Array(digest));
}

export function googlePlayCommerceProvider<TEnv>(config: GooglePlayCommerceConfig<TEnv>): CommerceProvider<TEnv> {
  const now = config.now ?? Date.now;
  // One access token per isolate, reused until shortly before it expires.
  // Minting is an RS256 signature plus a round trip; doing it per verification
  // would put that on the purchase path for no benefit.
  let cached: { token: string; expiresAt: number } | null = null;
  // jose caches the fetched keys inside this resolver and refetches when Google
  // rotates them, so it lives as long as the adapter does.
  const googleKeys = createRemoteJWKSet(new URL(GOOGLE_CERTS));

  const tokenKey = (env: TEnv): Uint8Array => {
    const secret = requireSecret(config.purchaseTokenKey(env), "google play purchaseTokenKey");
    if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) throw new Error("google play purchaseTokenKey must be 32 bytes encoded as unpadded base64url");
    return base64url.decode(secret);
  };

  const purchaseIdentity = async (env: TEnv, token: string) => ({
    providerTransactionId: await transactionId(token),
    sealedProviderState: await new CompactEncrypt(encoder.encode(token)).setProtectedHeader(tokenEncryption).encrypt(tokenKey(env)),
  });

  const openPurchaseToken = async (env: TEnv, reference: CommerceTransactionReference): Promise<string> => {
    if (reference.sealedProviderState === undefined) throw new Error("google play purchase has no sealed token");
    const { plaintext } = await compactDecrypt(reference.sealedProviderState, tokenKey(env), {
      keyManagementAlgorithms: [tokenEncryption.alg],
      contentEncryptionAlgorithms: [tokenEncryption.enc],
    });
    const token = decoder.decode(plaintext);
    if ((await transactionId(token)) !== reference.providerTransactionId) throw new Error("google play sealed token belongs to a different transaction");
    return token;
  };

  const accessToken = async (env: TEnv): Promise<string> => {
    if (cached !== null && cached.expiresAt > now() + 60_000) return cached.token;
    const email = requireSecret(config.serviceAccountEmail(env), "google play serviceAccountEmail");
    const pem = requireSecret(config.serviceAccountPrivateKey(env), "google play serviceAccountPrivateKey");
    const issued = Math.floor(now() / 1000);
    const signingKey = await importPKCS8(pem, "RS256");
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(email)
      .setAudience(TOKEN_URL)
      .setIssuedAt(issued)
      .setExpirationTime(issued + 3600)
      .sign(signingKey);
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
    const response = await fetch(request).catch(() => {
      // The request path can contain a purchase token.
      throw new Error("google play API request failed");
    });
    // Acknowledge returns an empty body on success, so it is read separately
    // from the JSON path rather than being parsed into nothing.
    if (!response.ok) throw new Error(`${PROVIDER} responded ${response.status}`);
    if (response.status === 204 || response.headers.get("content-length") === "0") return null;
    return (await response.json()) as T;
  };

  const fetchProduct = async (env: TEnv, token: string): Promise<ProductPurchaseV2> => (await call<ProductPurchaseV2>(env, `/purchases/productsv2/tokens/${encodeURIComponent(token)}`)) as ProductPurchaseV2;

  const productTransaction = async (env: TEnv, purchase: ProductPurchaseV2, token: string): Promise<VerifiedCommerceTransaction> => {
    const lines = purchase.productLineItem ?? [];
    if (lines.length > 1) throw new ProviderRefusal("google play purchase holds several products; one transaction grants one offer");
    const productId = lines[0]?.productId;
    if (productId === undefined) throw new Error("google play purchase names no product");
    // Absent until a pending purchase is paid for.
    const purchasedAt = purchase.purchaseCompletionTime === undefined ? now() : Date.parse(purchase.purchaseCompletionTime);
    const reported = purchase.purchaseStateContext?.purchaseState;
    const state: CommerceTransactionState = reported === "PURCHASED" ? "active" : reported === "PENDING" ? "pending" : "revoked";
    return {
      ...(await purchaseIdentity(env, token)),
      providerReference: productId,
      kind: "oneTime",
      state,
      purchasedAt,
      validFrom: purchasedAt,
      // Pending means Play is still waiting to be told, and will refund if it
      // never is.
      requiresAcknowledgement: state === "active" && purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING",
      ...(purchase.obfuscatedExternalAccountId === undefined ? {} : { providerAccountId: purchase.obfuscatedExternalAccountId }),
    };
  };

  const readProduct = async (env: TEnv, token: string): Promise<VerifiedCommerceTransaction> => productTransaction(env, await fetchProduct(env, token), token);

  /** A one-time purchase a voided notification names. A full refund ends it
   * whatever the read says; a partial one only once nothing is left. */
  const readVoidedProduct = async (env: TEnv, token: string, refundType: number | undefined): Promise<VerifiedCommerceTransaction> => {
    const purchase = await fetchProduct(env, token);
    const transaction = await productTransaction(env, purchase, token);
    const remaining = purchase.productLineItem?.[0]?.productOfferDetails?.refundableQuantity;
    if (refundType === 2 && remaining !== undefined && remaining > 0) return transaction;
    return { ...transaction, state: "revoked", requiresAcknowledgement: false };
  };

  const readSubscription = async (env: TEnv, token: string): Promise<VerifiedCommerceTransaction> => {
    const purchase = (await call<SubscriptionPurchaseV2>(env, `/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`)) as SubscriptionPurchaseV2;
    const instant = now();
    const line = servingLine(purchase.lineItems ?? [], instant);
    const validUntil = line.expiryTime === undefined ? undefined : Date.parse(line.expiryTime);
    const state = subscriptionState(purchase.subscriptionState, validUntil !== undefined && validUntil > instant);
    if ((state === "active" || state === "grace") && !Number.isFinite(validUntil)) {
      throw new Error("google play serving subscription has no valid expiry");
    }
    const startedAt = purchase.startTime === undefined ? now() : Date.parse(purchase.startTime);
    return {
      ...(await purchaseIdentity(env, token)),
      providerReference: lineReference(line),
      kind: "subscription",
      state,
      purchasedAt: startedAt,
      validFrom: startedAt,
      ...(validUntil === undefined ? {} : { validUntil }),
      requiresAcknowledgement: (state === "active" || state === "grace") && purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING",
      ...(purchase.linkedPurchaseToken === undefined ? {} : { replacesProviderTransactionId: await transactionId(purchase.linkedPurchaseToken) }),
      ...(purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId === undefined ? {} : { providerAccountId: purchase.externalAccountIdentifiers.obfuscatedExternalAccountId }),
    };
  };

  /** Throws unless Pub/Sub delivered [request] as this game's service account,
   * to the URL it arrived at. */
  const verifyDelivery = async (env: TEnv, request: Request): Promise<void> => {
    const serviceAccount = requireSecret(config.serviceAccountEmail(env), "google play serviceAccountEmail");
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) throw new Error("google play notification carries no Pub/Sub token");
    // Pub/Sub mints the token for the push endpoint as configured, which is
    // the URL the notification arrives at.
    const endpoint = new URL(request.url);
    endpoint.search = "";
    endpoint.hash = "";
    let claims: JWTPayload;
    try {
      ({ payload: claims } = await jwtVerify(authorization.slice("Bearer ".length), googleKeys, {
        issuer: GOOGLE_ISSUERS,
        audience: endpoint.toString(),
        algorithms: ["RS256"],
        currentDate: new Date(now()),
      }));
    } catch {
      throw new Error("google play notification token does not verify");
    }
    // Any Google service account can have a token minted for this URL; only
    // the game's own can be the one its subscription delivers as.
    if (claims.email !== serviceAccount || claims.email_verified !== true) {
      throw new Error("google play notification was not delivered as this game's service account");
    }
  };

  return {
    key: PROVIDER,

    // No `products`: the Play Billing library on the device already holds the
    // localized price, and it is the only copy the player will ever be shown.

    validateReference: (reference, kind) => {
      const { productId, basePlanId } = parseReference(reference);
      if (!PRODUCT_ID.test(productId)) throw new Error(`${JSON.stringify(productId)} is not a Play product id`);
      if (kind === "oneTime" && basePlanId !== undefined) throw new Error("a one-time product is referenced by its product id alone");
      if (kind === "subscription" && (basePlanId === undefined || !BASE_PLAN_ID.test(basePlanId))) {
        throw new Error("a subscription is referenced as productId:basePlanId, because the base plan is what a player buys");
      }
    },

    verifyClaim: async (env, input) => {
      const evidence = input.evidence as { purchaseToken?: unknown } | null;
      const token = evidence?.purchaseToken;
      if (typeof token !== "string" || token.length === 0) throw new Error("google play evidence needs a purchaseToken");
      // The reference's shape says which API holds the purchase, so the device
      // never has to. What was bought is Play's to say: the device can name any
      // plan of a subscription, and the product Play reports is the one
      // recorded.
      const transaction = parseReference(input.expectedProviderReference).basePlanId === undefined ? await readProduct(env, token) : await readSubscription(env, token);
      // Play's obfuscated account id is the only link back to the buyer, so a
      // token minted for someone else must not become this account's grant.
      if (transaction.providerAccountId === undefined && transaction.replacesProviderTransactionId === undefined) {
        throw new ProviderRefusal("google play purchase has no Eigen account binding");
      }
      if (transaction.providerAccountId !== undefined && transaction.providerAccountId !== input.accountId) {
        throw new ProviderRefusal("google play purchase belongs to another account");
      }
      return transaction;
    },

    /**
     * Real-time Developer Notifications, delivered by Pub/Sub push.
     *
     * The message is a change signal and nothing more -- it carries a token, not
     * a state -- so the current purchase is always read back from the API.
     * Nothing is read until the delivery itself verifies: Google does not sign
     * the body, so the Pub/Sub token is the only proof it came from Play.
     */
    verifyWebhook: async (env, request) => {
      await verifyDelivery(env, request);
      const envelope = (await request.json()) as { message?: { data?: string; messageId?: string } };
      const encoded = envelope.message?.data;
      if (typeof encoded !== "string") throw new Error("google play notification has no message data");
      const notification = JSON.parse(atob(encoded)) as DeveloperNotification;
      const transaction = await (async (): Promise<VerifiedCommerceTransaction | undefined> => {
        const voided = notification.voidedPurchaseNotification;
        if (voided?.purchaseToken !== undefined) {
          return voided.productType === 2 ? await readVoidedProduct(env, voided.purchaseToken, voided.refundType) : await readSubscription(env, voided.purchaseToken);
        }
        const oneTime = notification.oneTimeProductNotification?.purchaseToken;
        if (oneTime !== undefined) return await readProduct(env, oneTime);
        const subscription = notification.subscriptionNotification?.purchaseToken;
        return subscription === undefined ? undefined : await readSubscription(env, subscription);
      })();
      // A test notification sent from the Play Console, or one about no
      // purchase this adapter reads: authentic, and about nothing to record.
      if (transaction === undefined) return null;
      return {
        providerEventId: envelope.message?.messageId ?? `${transaction.providerTransactionId}:${transaction.state}`,
        // A resubscription from the Play Store carries no account id; the
        // ledger attributes it through the token it replaced.
        ...(transaction.providerAccountId === undefined ? {} : { accountId: transaction.providerAccountId }),
        transaction,
      } satisfies VerifiedCommerceEvent;
    },

    reconcile: async (env, transactions) => {
      const results: VerifiedCommerceTransaction[] = [];
      for (const reference of transactions) {
        if (reference.sealedProviderState === undefined) continue;
        try {
          const token = await openPurchaseToken(env, reference);
          results.push(reference.kind === "subscription" ? await readSubscription(env, token) : await readProduct(env, token));
        } catch {
          // Unanswered: the engine counts it against that row and moves on.
        }
      }
      return results;
    },

    acknowledge: async (env, transaction) => {
      const token = await openPurchaseToken(env, transaction);
      // The v2 resources have no acknowledge method; the v1 ones do, and take
      // the product the transaction's reference names.
      const resource = transaction.kind === "subscription" ? "subscriptions" : "products";
      const productId = encodeURIComponent(parseReference(transaction.providerReference).productId);
      await call(env, `/purchases/${resource}/${productId}/tokens/${encodeURIComponent(token)}:acknowledge`, "POST");
    },

    // No `createCheckout` or `management`: Play's purchase flow is launched by
    // the Billing library on the device, and subscriptions are managed in the
    // Play app.
  };
}
