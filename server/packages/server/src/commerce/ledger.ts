import { and, eq, notInArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { isUniqueViolation } from "../d1/errors.js";
import { orm } from "../d1/orm.js";
import { commerceEvents, commerceProviderAccounts, commerceTransactions, entitlementGrants } from "../d1/schema.js";
import { HttpError } from "../http.js";
import type { CommerceCatalog, CommerceOffer, CommerceTransactionReference, VerifiedCommerceEvent, VerifiedCommerceTransaction } from "./types.js";

export function offerForProduct(catalog: CommerceCatalog, provider: string, providerReference: string): CommerceOffer | undefined {
  return catalog.offers.find((offer) => offer.providerReferences[provider] === providerReference);
}

function safeInstant(value: number | undefined, field: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
    throw new HttpError(502, `The provider returned an invalid ${field}`);
  }
}

function validateTransaction(transaction: VerifiedCommerceTransaction, offer: CommerceOffer): void {
  if (transaction.providerTransactionId.length === 0 || transaction.providerTransactionId.length > 512) {
    throw new HttpError(502, "The provider returned an invalid transaction identity");
  }
  if (transaction.kind !== offer.kind) {
    throw new HttpError(409, "The verified purchase kind does not match the requested offer", "purchaseConflict");
  }
  safeInstant(transaction.purchasedAt, "purchase instant");
  safeInstant(transaction.validFrom, "entitlement start");
  safeInstant(transaction.validUntil, "entitlement end");
  if (transaction.validUntil !== undefined && transaction.validUntil <= transaction.validFrom) {
    throw new HttpError(502, "The provider returned an invalid entitlement period");
  }
  if (transaction.providerAccountId !== undefined && (transaction.providerAccountId.length === 0 || transaction.providerAccountId.length > 512)) {
    throw new HttpError(502, "The provider returned an invalid account identity");
  }
  if (transaction.sealedProviderState !== undefined && transaction.sealedProviderState.length > 4096) {
    throw new HttpError(502, "The provider returned oversized reconciliation state");
  }
  if (transaction.requiresAcknowledgement === true && transaction.sealedProviderState === undefined) {
    throw new HttpError(502, "The provider requires acknowledgement without sealed state");
  }
}

/** The provider customer currently bound to an Eigen account. */
export async function readProviderAccount(d1: D1Database, provider: string, accountId: string): Promise<string | undefined> {
  return (
    await orm(d1)
      .select({ providerAccountId: commerceProviderAccounts.providerAccountId })
      .from(commerceProviderAccounts)
      .where(and(eq(commerceProviderAccounts.provider, provider), eq(commerceProviderAccounts.userId, accountId)))
      .get()
  )?.providerAccountId;
}

/** Persist a verified provider customer binding without permitting rebinding. */
export async function recordProviderAccount(d1: D1Database, provider: string, accountId: string, providerAccountId: string, now: number): Promise<void> {
  const existing = await readProviderAccount(d1, provider, accountId);
  if (existing !== undefined && existing !== providerAccountId) {
    throw new HttpError(409, "This account is already associated with another provider customer", "purchaseConflict");
  }
  try {
    await orm(d1)
      .insert(commerceProviderAccounts)
      .values({ id: crypto.randomUUID(), provider, userId: accountId, providerAccountId, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [commerceProviderAccounts.provider, commerceProviderAccounts.userId],
        set: { updatedAt: now },
      });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await readProviderAccount(d1, provider, accountId);
    if (raced !== providerAccountId) {
      throw new HttpError(409, "This provider customer is associated with another account", "purchaseConflict");
    }
  }
}

/** Apply one server-verified provider object to the normalized ledger. */
export async function recordVerifiedTransaction(
  d1: D1Database,
  input: {
    catalog: CommerceCatalog;
    provider: string;
    accountId: string;
    expectedOfferKey: string;
    transaction: VerifiedCommerceTransaction;
    now: number;
    reconciled?: boolean;
  },
  allowRaceRetry = true,
): Promise<CommerceTransactionReference> {
  const offer = offerForProduct(input.catalog, input.provider, input.transaction.providerReference);
  if (offer === undefined || offer.key !== input.expectedOfferKey) {
    throw new HttpError(409, "The verified product does not match the requested offer", "purchaseConflict");
  }
  validateTransaction(input.transaction, offer);

  const db = orm(d1);
  const existing = await db
    .select()
    .from(commerceTransactions)
    .where(and(eq(commerceTransactions.provider, input.provider), eq(commerceTransactions.providerTransactionId, input.transaction.providerTransactionId)))
    .get();
  if (existing !== undefined) {
    if (existing.userId !== input.accountId) {
      throw new HttpError(409, "This purchase is associated with another account", "purchaseConflict");
    }
    if (existing.providerReference !== input.transaction.providerReference || existing.offerKey !== offer.key || existing.kind !== input.transaction.kind) {
      throw new HttpError(409, "The provider transaction changed product identity", "purchaseConflict");
    }
  }
  const boundProviderAccount = await readProviderAccount(d1, input.provider, input.accountId);
  if (input.transaction.providerAccountId !== undefined && boundProviderAccount !== undefined && boundProviderAccount !== input.transaction.providerAccountId) {
    throw new HttpError(409, "The provider customer changed account identity", "purchaseConflict");
  }

  const transactionId = existing?.id ?? crypto.randomUUID();
  const active = input.transaction.state === "active" || input.transaction.state === "grace";
  const acknowledgementState = existing?.acknowledgementState === "acknowledged" ? "acknowledged" : active && input.transaction.requiresAcknowledgement === true ? "pending" : "notRequired";
  const sealedProviderState = input.transaction.sealedProviderState ?? existing?.sealedProviderState ?? null;
  const transactionWrite =
    existing === undefined
      ? db.insert(commerceTransactions).values({
          id: transactionId,
          provider: input.provider,
          providerTransactionId: input.transaction.providerTransactionId,
          userId: input.accountId,
          providerReference: input.transaction.providerReference,
          offerKey: offer.key,
          kind: input.transaction.kind,
          state: input.transaction.state,
          purchasedAt: input.transaction.purchasedAt,
          validFrom: input.transaction.validFrom,
          validUntil: input.transaction.validUntil ?? null,
          sealedProviderState,
          acknowledgementState,
          lastReconciledAt: input.reconciled === true ? input.now : null,
          createdAt: input.now,
          updatedAt: input.now,
        })
      : db
          .update(commerceTransactions)
          .set({
            state: input.transaction.state,
            purchasedAt: input.transaction.purchasedAt,
            validFrom: input.transaction.validFrom,
            validUntil: input.transaction.validUntil ?? null,
            sealedProviderState,
            acknowledgementState,
            ...(input.reconciled === true ? { lastReconciledAt: input.now } : {}),
            updatedAt: input.now,
          })
          .where(eq(commerceTransactions.id, transactionId));

  const statements: BatchItem<"sqlite">[] = [
    transactionWrite,
    db
      .update(entitlementGrants)
      .set({ revokedAt: input.now, updatedAt: input.now })
      .where(and(eq(entitlementGrants.sourceTransactionId, transactionId), notInArray(entitlementGrants.entitlementKey, [...offer.entitlements]))),
    ...offer.entitlements.map((entitlementKey) =>
      db
        .insert(entitlementGrants)
        .values({
          id: crypto.randomUUID(),
          userId: input.accountId,
          entitlementKey,
          sourceTransactionId: transactionId,
          validFrom: input.transaction.validFrom,
          validUntil: input.transaction.validUntil ?? null,
          revokedAt: active ? null : input.now,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .onConflictDoUpdate({
          target: [entitlementGrants.sourceTransactionId, entitlementGrants.entitlementKey],
          set: {
            userId: input.accountId,
            validFrom: input.transaction.validFrom,
            validUntil: input.transaction.validUntil ?? null,
            revokedAt: active ? null : input.now,
            updatedAt: input.now,
          },
        }),
    ),
  ];
  if (input.transaction.providerAccountId !== undefined && boundProviderAccount === undefined) {
    statements.push(
      db.insert(commerceProviderAccounts).values({
        id: crypto.randomUUID(),
        provider: input.provider,
        userId: input.accountId,
        providerAccountId: input.transaction.providerAccountId,
        createdAt: input.now,
        updatedAt: input.now,
      }),
    );
  }

  try {
    await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  } catch (error) {
    if (existing === undefined && allowRaceRetry && isUniqueViolation(error)) {
      return await recordVerifiedTransaction(d1, input, false);
    }
    throw error;
  }
  return {
    providerTransactionId: input.transaction.providerTransactionId,
    accountId: input.accountId,
    providerReference: input.transaction.providerReference,
    kind: input.transaction.kind,
    ...(sealedProviderState === null ? {} : { sealedProviderState }),
    acknowledgementPending: acknowledgementState === "pending",
  };
}

export async function markTransactionAcknowledged(d1: D1Database, provider: string, providerTransactionId: string, now: number): Promise<void> {
  await orm(d1)
    .update(commerceTransactions)
    .set({ acknowledgementState: "acknowledged", updatedAt: now })
    .where(and(eq(commerceTransactions.provider, provider), eq(commerceTransactions.providerTransactionId, providerTransactionId)));
}

/** Deduplicate one verified notification and converge it on transaction state. */
export async function recordVerifiedEvent(
  d1: D1Database,
  input: {
    catalog: CommerceCatalog;
    provider: string;
    event: VerifiedCommerceEvent;
    now: number;
  },
): Promise<CommerceTransactionReference | null> {
  const db = orm(d1);
  const existing = await db
    .select()
    .from(commerceEvents)
    .where(and(eq(commerceEvents.provider, input.provider), eq(commerceEvents.providerEventId, input.event.providerEventId)))
    .get();
  if (existing?.processedAt !== null && existing !== undefined) return null;

  if (existing === undefined) {
    await db
      .insert(commerceEvents)
      .values({
        id: crypto.randomUUID(),
        provider: input.provider,
        providerEventId: input.event.providerEventId,
        providerTransactionId: input.event.transaction.providerTransactionId,
        receivedAt: input.now,
        processedAt: null,
      })
      .onConflictDoNothing();
  }

  const offer = offerForProduct(input.catalog, input.provider, input.event.transaction.providerReference);
  if (offer === undefined) {
    throw new HttpError(409, "The verified webhook product is not registered", "purchaseConflict");
  }
  const reference = await recordVerifiedTransaction(d1, {
    catalog: input.catalog,
    provider: input.provider,
    accountId: input.event.accountId,
    expectedOfferKey: offer.key,
    transaction: input.event.transaction,
    now: input.now,
  });
  await db
    .update(commerceEvents)
    .set({ processedAt: input.now })
    .where(and(eq(commerceEvents.provider, input.provider), eq(commerceEvents.providerEventId, input.event.providerEventId)));
  return reference;
}
