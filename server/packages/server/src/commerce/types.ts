import type { GameAccess } from "@eigeninteractive/rules";

/** The engine-owned commercial authorization vocabulary. */
export type EngineAccessCapability =
  | { kind: "app.access" }
  | { kind: "game.create"; access: GameAccess }
  | { kind: "game.join"; access: GameAccess }
  | { kind: "game.create.rated" }
  | { kind: "bot.use"; tier: string }
  | { kind: "content.use"; collection: string; id: string }
  | { kind: "replay.read" }
  | { kind: "analysis.use"; analysisType?: string };

/** A stable, game-owned noun below the engine-owned `content.use` verb. */
export interface ContentGrant {
  collection: string;
  id: string;
}

export type ContentClassification = "sharedRuleset" | "cosmetic";
export type ContentOwnershipScope = "creator" | "eachParticipant" | "viewer";

export interface ContentDefinition {
  classification: ContentClassification;
}

export type CommercialMetric = "game.create.success" | "games.openCreated" | "bot.game.success" | "analysis.run.success";

export type CommercialPeriod = { kind: "calendarMonth"; timezone: "UTC" } | { kind: "subscriptionPeriod" } | { kind: "lifetime" } | { kind: "concurrent" };

export type CommercialLimit = { metric: CommercialMetric; maximum: number; period: CommercialPeriod } | { metric: CommercialMetric; maximum: "noCommercialLimit" };

/** Permissions, content ownership, and limits contributed by one source. */
export interface AccessGrant {
  permissions?: readonly EngineAccessCapability[];
  content?: readonly ContentGrant[];
  limits?: readonly CommercialLimit[];
}

export interface EntitlementDefinition extends AccessGrant {
  /** Stable logical key, independent of any storefront product identifier. */
  key: string;
}

export interface CommerceOffer {
  /** Stable logical key used by clients and analytics. */
  key: string;
  name: string;
  description: string;
  kind: "oneTime" | "subscription";
  entitlements: readonly string[];
  /** Defaults to false. Enable only for intentionally repeatable support/tip offers. */
  repeatable?: boolean;
  /**
   * Public, provider-owned sellable references. The engine treats each value
   * as opaque; the matching adapter defines its form -- a Stripe Price, a
   * Razorpay Plan, a Google Play product id, or a Play subscription's
   * `{productId}:{basePlanId}`. Secret credentials remain in bindings.
   */
  providerReferences: Readonly<Record<string, string>>;
}

export interface CommerceCatalog {
  free: AccessGrant;
  entitlements: readonly EntitlementDefinition[];
  offers: readonly CommerceOffer[];
  content?: Readonly<Record<string, Readonly<Record<string, ContentDefinition>>>>;
  /** The bots priced differently from the rest, by registered bot id. Every bot
   * this does not list is in `standard` (`DEFAULT_BOT_TIER`). */
  botTiers?: Readonly<Record<string, string>>;
}

export type CommerceTransactionState = "pending" | "active" | "grace" | "expired" | "revoked";

/** Provider output after server-side verification. Never accepted from a client. */
export interface VerifiedCommerceTransaction {
  providerTransactionId: string;
  /** What this transaction serves now. A subscription's may change over its
   * life (a plan change), and the ledger moves it to the matching offer. */
  providerReference: string;
  /** Must match the configured logical offer kind. */
  kind: "oneTime" | "subscription";
  state: CommerceTransactionState;
  purchasedAt: number;
  validFrom: number;
  validUntil?: number;
  /** Provider customer/account id, when the provider exposes one. */
  providerAccountId?: string;
  /**
   * Adapter-sealed state needed for later verification (for example an
   * encrypted Play purchase token). It MUST be safe to persist in D1 and MUST
   * never contain a plaintext receipt, token, or payment credential.
   */
  sealedProviderState?: string;
  /** True when the provider requires a post-ledger acknowledgement. */
  requiresAcknowledgement?: boolean;
  /**
   * The transaction this one replaced at the provider, when it says so: Play
   * issues a new purchase token for every plan change and for a resubscription
   * after a lapse, and names the old token as `linkedPurchaseToken`. The ledger
   * ends the replaced transaction, so the old token's grants do not outlive it,
   * and attributes this one through it when the provider names no account.
   */
  replacesProviderTransactionId?: string;
}

export interface CommerceProduct {
  providerReference: string;
  displayPrice: string;
  currencyCode?: string;
}

export interface CommerceCheckout {
  url: string;
  /** Provider session expiry in epoch milliseconds, when known. */
  expiresAt?: number;
  /** Returned when checkout created or resolved a provider customer. */
  providerAccountId?: string;
}

export interface CommerceManagement {
  url: string;
}

export interface VerifyClaimInput {
  accountId: string;
  /**
   * The reference of the offer the claim named. It steers verification -- Play
   * reads a one-time purchase under its product id, and tells a subscription
   * from its shape -- but the transaction returned says what was actually
   * bought, and the ledger records that.
   */
  expectedProviderReference: string;
  evidence: unknown;
}

export interface CreateCheckoutInput {
  accountId: string;
  offer: CommerceOffer;
  providerReference: string;
  returnUrl: string;
  /** Stable across retries and suitable for the provider's idempotency key. */
  operationId: string;
  /** Previously bound provider customer, if one exists. */
  providerAccountId?: string;
}

/** A provider-authenticated notification resolved to current provider state. */
export interface VerifiedCommerceEvent {
  providerEventId: string;
  /**
   * The Eigen account the provider says the purchase belongs to. Absent when
   * it names none -- a Play resubscription made from the Play Store carries no
   * obfuscated account id -- and the ledger then attributes the transaction
   * through the row it already has, or the one it replaced.
   */
  accountId?: string;
  transaction: VerifiedCommerceTransaction;
}

export interface CommerceTransactionReference {
  providerTransactionId: string;
  accountId: string;
  providerReference: string;
  kind: "oneTime" | "subscription";
  sealedProviderState?: string;
  acknowledgementPending: boolean;
}

/** A provider boundary. Implementations perform all remote verification. */
export interface CommerceProvider<TEnv = unknown> {
  readonly key: string;
  /**
   * Throws when a catalog reference cannot name anything this provider sells as
   * an offer of `kind`. Called for every offer at `createEngine`, so a
   * misspelt reference is a deploy failure rather than a refused purchase.
   */
  validateReference?(providerReference: string, kind: CommerceOffer["kind"]): void;
  products?(env: TEnv, providerReferences: readonly string[]): Promise<readonly CommerceProduct[]>;
  verifyClaim(env: TEnv, input: VerifyClaimInput): Promise<VerifiedCommerceTransaction>;
  /**
   * Verifies the raw request and fetches current provider state when needed.
   * Resolves null for an authentic notification that concerns no purchase, such
   * as a console test message, so the provider is answered and stops resending.
   */
  verifyWebhook?(env: TEnv, request: Request): Promise<VerifiedCommerceEvent | null>;
  /** Fetches current state for locally active or pending transaction refs. */
  reconcile?(env: TEnv, transactions: readonly CommerceTransactionReference[]): Promise<readonly VerifiedCommerceTransaction[]>;
  /** Runs only after the normalized transaction and grants commit. */
  acknowledge?(env: TEnv, transaction: CommerceTransactionReference): Promise<void>;
  createCheckout?(env: TEnv, input: CreateCheckoutInput): Promise<CommerceCheckout>;
  management?(env: TEnv, accountId: string, providerAccountId: string, returnUrl: string): Promise<CommerceManagement>;
}

export interface CommerceConfig<TEnv> {
  catalog: CommerceCatalog;
  providers: readonly CommerceProvider<TEnv>[];
  /** Test seam. Production uses `Date.now`. */
  now?: () => number;
  /** Maximum nonterminal transactions checked per provider and invocation. */
  reconcileBatch?: number;
  /** Consecutive failed sweeps after which a transaction stops being swept and
   * is surfaced to the operator instead. Defaults to 10. */
  reconcileMaxFailures?: number;
}

export interface ResolvedCommerce {
  catalog: CommerceCatalog;
  providers: ReadonlyMap<string, CommerceProvider<unknown>>;
  now(): number;
  reconcileBatch: number;
  reconcileMaxFailures: number;
}

/** One content choice snapshotted onto a game at creation. */
export interface SelectedContent extends ContentGrant {
  ownership: ContentOwnershipScope;
  classification: ContentClassification;
}

export interface ActiveEntitlement {
  key: string;
  validFrom: number;
  validUntil: number | null;
}

export interface LimitAccess {
  metric: CommercialMetric;
  maximum: number | "noCommercialLimit";
  period: CommercialPeriod | null;
  used: number;
  remaining: number | null;
  resetsAt: number | null;
}

export interface AccessSnapshot {
  entitlements: ActiveEntitlement[];
  permissions: EngineAccessCapability[];
  content: ContentGrant[];
  limits: LimitAccess[];
}
