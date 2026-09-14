import type { GameAccess } from "@eigeninteractive/rules";

/** The engine-owned commercial authorization vocabulary. */
export type EngineAccessCapability =
  | { kind: "app.access" }
  | { kind: "game.create"; access: GameAccess }
  | { kind: "game.join"; access: GameAccess }
  | { kind: "game.create.rated" }
  | { kind: "bot.use"; tier?: string }
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
   * as opaque; the matching adapter may interpret a Stripe Price, or a Google
   * Play product/base-plan/offer tuple. Secret credentials remain in bindings.
   */
  providerReferences: Readonly<Record<string, string>>;
}

export interface CommerceCatalog {
  free: AccessGrant;
  entitlements: readonly EntitlementDefinition[];
  offers: readonly CommerceOffer[];
  content?: Readonly<Record<string, Readonly<Record<string, ContentDefinition>>>>;
  /** Optional mapping from a registered bot id to its commercial tier. */
  botTiers?: Readonly<Record<string, string>>;
}

export type CommerceTransactionState = "pending" | "active" | "grace" | "expired" | "revoked";

/** Provider output after server-side verification. Never accepted from a client. */
export interface VerifiedCommerceTransaction {
  providerTransactionId: string;
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
  accountId: string;
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
  products?(env: TEnv, providerReferences: readonly string[]): Promise<readonly CommerceProduct[]>;
  verifyClaim(env: TEnv, input: VerifyClaimInput): Promise<VerifiedCommerceTransaction>;
  /** Verifies the raw request and fetches current provider state when needed. */
  verifyWebhook?(env: TEnv, request: Request): Promise<VerifiedCommerceEvent>;
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
