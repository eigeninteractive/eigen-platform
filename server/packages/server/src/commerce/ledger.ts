import { and, eq, isNull, lte, notInArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { isUniqueViolation } from "../d1/errors.js";
import { orm } from "../d1/orm.js";
import { commerceEvents, commerceProviderAccounts, commerceTransactions, entitlementGrants, users } from "../d1/schema.js";
import { HttpError } from "../http.js";
import type { CommerceCatalog, CommerceOffer, CommerceTransactionReference, CommerceTransactionState, VerifiedCommerceEvent, VerifiedCommerceTransaction } from "./types.js";

/**
 * The named account is gone, so there is nothing to write.
 *
 * Distinguished from every other conflict because it is not an error the
 * provider can retry its way out of: the account will not come back. The
 * webhook path answers it by accepting the notification and recording nothing.
 */
export class ErasedAccountError extends HttpError {
  constructor() {
    super(409, "This purchase names an account that no longer exists", "purchaseConflict");
  }
}

export function offerForProduct(catalog: CommerceCatalog, provider: string, providerReference: string): CommerceOffer | undefined {
  return catalog.offers.find((offer) => offer.providerReferences[provider] === providerReference);
}

function safeInstant(value: number | undefined, field: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
    throw new HttpError(502, `The provider returned an invalid ${field}`);
  }
}

function validateTransaction(transaction: VerifiedCommerceTransaction, kind: CommerceOffer["kind"]): void {
  if (transaction.providerTransactionId.length === 0 || transaction.providerTransactionId.length > 512) {
    throw new HttpError(502, "The provider returned an invalid transaction identity");
  }
  if (transaction.kind !== kind) {
    throw new HttpError(409, "The verified purchase kind does not match its offer", "purchaseConflict");
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
  if (transaction.replacesProviderTransactionId !== undefined && (transaction.replacesProviderTransactionId.length === 0 || transaction.replacesProviderTransactionId.length > 512)) {
    throw new HttpError(502, "The provider returned an invalid replaced transaction identity");
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
    transaction: VerifiedCommerceTransaction;
    now: number;
    /** When the provider was asked, before the call. Defaults to `now`, which
     * is only right when nothing could have raced the read. */
    observedAt?: number;
    reconciled?: boolean;
  },
  allowRaceRetry = true,
): Promise<CommerceTransactionReference> {
  const db = orm(d1);
  const observedAt = input.observedAt ?? input.now;
  const existing = await db
    .select()
    .from(commerceTransactions)
    .where(and(eq(commerceTransactions.provider, input.provider), eq(commerceTransactions.providerTransactionId, input.transaction.providerTransactionId)))
    .get();

  // The offer is whatever the provider verified, never what a caller asked
  // for. A store SDK cannot always tell: Play reports a subscription's product
  // but not its base plan, and a restore on a fresh install has nothing to
  // remember it from. The provider can, so its answer is the one recorded.
  const offer = offerForProduct(input.catalog, input.provider, input.transaction.providerReference);
  // A product the catalog stopped selling can still end. Its refund or expiry
  // is the provider reporting on something the ledger already holds, and
  // refusing it would leave the grant standing; it grants nothing new.
  const ending = offer === undefined && existing !== undefined && existing.providerReference === input.transaction.providerReference && !isServing(input.transaction.state);
  if (offer === undefined && !ending) {
    throw new HttpError(409, "The verified product is not registered", "purchaseConflict");
  }
  const offerKey = offer?.key ?? (existing?.offerKey as string);
  const entitlements = offer?.entitlements ?? [];
  validateTransaction(input.transaction, offer?.kind ?? (existing?.kind as CommerceOffer["kind"]));

  if (existing !== undefined) {
    // A null user is not a mismatch with somebody else's account: it is what
    // the purge leaves behind, so this transaction belonged to an account that
    // has been erased.
    if (existing.userId === null) throw new ErasedAccountError();
    if (existing.userId !== input.accountId) {
      throw new HttpError(409, "This purchase is associated with another account", "purchaseConflict");
    }
    // A subscription changes plan in place -- a deferred Play replacement's
    // token swaps its line item at renewal, Stripe swaps the price when the
    // player switches in the Billing Portal -- and the transaction follows it:
    // the grants batch below revokes what the old offer granted and the new one
    // does not. A one-time purchase never changes what was bought, and nothing
    // changes its kind.
    const changedPlan = existing.providerReference !== input.transaction.providerReference || existing.offerKey !== offerKey;
    if (existing.kind !== input.transaction.kind || (changedPlan && existing.kind !== "subscription")) {
      throw new HttpError(409, "The provider transaction changed product identity", "purchaseConflict");
    }
  }
  // Erasure has to survive the provider. A claim is made by an authenticated
  // caller, whose row the auth middleware has just ensured; a webhook is not,
  // and names an account from provider metadata that outlives the account
  // itself. A cancellation or a final renewal arriving weeks after
  // `DELETE /api/engine/me` would otherwise write a grant, and a user id, back
  // for someone who asked to be forgotten.
  //
  // A transaction that already exists is refused earlier: the purge nulls its
  // user, and a webhook naming an account no longer matches it. This is the
  // other half -- the transaction the ledger has never seen.
  if (existing === undefined) {
    const account = await db.select({ id: users.id }).from(users).where(eq(users.id, input.accountId)).get();
    if (account === undefined) throw new ErasedAccountError();
  }
  const boundProviderAccount = await readProviderAccount(d1, input.provider, input.accountId);
  if (input.transaction.providerAccountId !== undefined && boundProviderAccount !== undefined && boundProviderAccount !== input.transaction.providerAccountId) {
    throw new HttpError(409, "The provider customer changed account identity", "purchaseConflict");
  }
  const replaced = await readReplaced(d1, input.provider, input.transaction);
  // A purchase that replaced someone else's carries that subscription's
  // history, and only an account the provider names can take it over: a
  // resubscription that names nobody stays with the account it continues.
  if (replaced?.userId !== null && replaced !== undefined && replaced.userId !== input.accountId && input.transaction.providerAccountId === undefined) {
    throw new HttpError(409, "This purchase continues one associated with another account", "purchaseConflict");
  }

  const transactionId = existing?.id ?? crypto.randomUUID();
  const revision = crypto.randomUUID();
  const active = isServing(input.transaction.state);
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
          offerKey,
          kind: input.transaction.kind,
          state: input.transaction.state,
          purchasedAt: input.transaction.purchasedAt,
          validFrom: input.transaction.validFrom,
          validUntil: input.transaction.validUntil ?? null,
          sealedProviderState,
          acknowledgementState,
          lastReconciledAt: input.reconciled === true ? input.now : null,
          observedAt,
          revision,
          createdAt: input.now,
          updatedAt: input.now,
        })
      : db
          .update(commerceTransactions)
          .set({
            providerReference: input.transaction.providerReference,
            offerKey,
            state: input.transaction.state,
            purchasedAt: input.transaction.purchasedAt,
            validFrom: input.transaction.validFrom,
            validUntil: input.transaction.validUntil ?? null,
            sealedProviderState,
            // Read inside the statement, not from `existing`: an
            // acknowledgement that landed since the read must not be undone.
            acknowledgementState: sql`case when ${commerceTransactions.acknowledgementState} = 'acknowledged' then 'acknowledged' else ${acknowledgementState} end`,
            ...(input.reconciled === true ? { lastReconciledAt: input.now } : {}),
            // A webhook or a claim that lands on a row the sweep had given up
            // on is current provider truth, so the row rejoins the sweep.
            reconcileFailures: 0,
            reconcileError: null,
            observedAt,
            revision,
            updatedAt: input.now,
          })
          // Only over an older observation. Two verifications of one purchase
          // can finish in either order, and the provider's later answer is the
          // one that must stand.
          .where(and(eq(commerceTransactions.id, transactionId), lte(commerceTransactions.observedAt, observedAt)));

  // Everything after the row's write restates its guard: a batch statement
  // that matches nothing does not fail the batch, so a write that lost the
  // race above must not still move grants.
  const written = (id: string) => sql`exists (select 1 from ${commerceTransactions} where ${commerceTransactions.id} = ${id} and ${commerceTransactions.revision} = ${revision})`;
  const statements: BatchItem<"sqlite">[] = [
    transactionWrite,
    db
      .update(entitlementGrants)
      .set({ revokedAt: input.now, updatedAt: input.now })
      .where(and(eq(entitlementGrants.sourceTransactionId, transactionId), entitlements.length === 0 ? undefined : notInArray(entitlementGrants.entitlementKey, [...entitlements]), written(transactionId))),
    ...entitlements.map((entitlementKey) =>
      db
        .insert(entitlementGrants)
        .select(
          db
            .select({
              id: sql<string>`${crypto.randomUUID()}`.as("id"),
              userId: sql<string>`${input.accountId}`.as("user_id"),
              entitlementKey: sql<string>`${entitlementKey}`.as("entitlement_key"),
              sourceTransactionId: commerceTransactions.id,
              validFrom: sql<number>`${input.transaction.validFrom}`.as("valid_from"),
              validUntil: sql<number | null>`${input.transaction.validUntil ?? null}`.as("valid_until"),
              revokedAt: sql<number | null>`${active ? null : input.now}`.as("revoked_at"),
              createdAt: sql<number>`${input.now}`.as("created_at"),
              updatedAt: sql<number>`${input.now}`.as("updated_at"),
            })
            .from(commerceTransactions)
            .where(and(eq(commerceTransactions.id, transactionId), eq(commerceTransactions.revision, revision))),
        )
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
  if (active && replaced !== undefined && replaced.userId === input.accountId && isLive(replaced.state)) {
    // Google's instruction for `linkedPurchaseToken`: the old token must stop
    // granting access. The provider reports it over too, but the sweep may be
    // hours from reading it, and until then a downgrade would keep what only
    // the old plan granted. Not while the new purchase is still pending: Play
    // keeps the old one serving until the new one is paid for.
    statements.push(
      db
        .update(commerceTransactions)
        .set({ state: "expired", validUntil: sql`min(coalesce(${commerceTransactions.validUntil}, ${input.now}), ${input.now})`, updatedAt: input.now })
        .where(and(eq(commerceTransactions.id, replaced.id), written(transactionId))),
      db
        .update(entitlementGrants)
        .set({ revokedAt: input.now, updatedAt: input.now })
        .where(and(eq(entitlementGrants.sourceTransactionId, replaced.id), isNull(entitlementGrants.revokedAt), written(transactionId))),
    );
  }
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

  let results: unknown[];
  try {
    results = await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  } catch (error) {
    if (existing === undefined && allowRaceRetry && isUniqueViolation(error)) {
      return await recordVerifiedTransaction(d1, input, false);
    }
    throw error;
  }
  // A newer observation already stands, and whoever wrote it owns the
  // acknowledgement that went with it.
  const superseded = existing !== undefined && ((results[0] as D1Result).meta.changes ?? 0) === 0;
  return {
    providerTransactionId: input.transaction.providerTransactionId,
    accountId: input.accountId,
    providerReference: input.transaction.providerReference,
    kind: input.transaction.kind,
    ...(sealedProviderState === null ? {} : { sealedProviderState }),
    acknowledgementPending: !superseded && acknowledgementState === "pending",
  };
}

/** The provider is still serving it: the player keeps access. */
function isServing(state: CommerceTransactionState): boolean {
  return state === "active" || state === "grace";
}

/** Not over yet, from the ledger's side: serving, or waiting to be paid. */
function isLive(state: CommerceTransactionState): boolean {
  return state !== "expired" && state !== "revoked";
}

async function readReplaced(d1: D1Database, provider: string, transaction: VerifiedCommerceTransaction) {
  const replaces = transaction.replacesProviderTransactionId;
  if (replaces === undefined || replaces === transaction.providerTransactionId) return undefined;
  return await orm(d1)
    .select({ id: commerceTransactions.id, userId: commerceTransactions.userId, state: commerceTransactions.state })
    .from(commerceTransactions)
    .where(and(eq(commerceTransactions.provider, provider), eq(commerceTransactions.providerTransactionId, replaces)))
    .get();
}

/**
 * Who a notification's purchase belongs to when the provider names nobody: the
 * account that already holds the transaction, or the one holding the purchase
 * it replaced. Undefined when the ledger knows neither.
 */
async function attributedAccount(d1: D1Database, provider: string, transaction: VerifiedCommerceTransaction): Promise<string | undefined> {
  const ids = [transaction.providerTransactionId, ...(transaction.replacesProviderTransactionId === undefined ? [] : [transaction.replacesProviderTransactionId])];
  for (const providerTransactionId of ids) {
    const row = await orm(d1)
      .select({ userId: commerceTransactions.userId })
      .from(commerceTransactions)
      .where(and(eq(commerceTransactions.provider, provider), eq(commerceTransactions.providerTransactionId, providerTransactionId)))
      .get();
    if (row?.userId !== null && row?.userId !== undefined) return row.userId;
  }
  return undefined;
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
    /** When the adapter began reading the provider for this event. */
    observedAt?: number;
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

  // A purchase that names no account and continues nothing the ledger holds
  // has nobody to belong to yet. The player's own claim will attribute it --
  // a restore presents the token with an account attached -- so the
  // notification is handled, not retried.
  const accountId = input.event.accountId ?? (await attributedAccount(d1, input.provider, input.event.transaction));
  // An erased account is the one conflict a provider cannot retry its way out
  // of, and a 5xx would have Stripe redelivering this for three days. The
  // notification was received and understood; there is simply nothing left to
  // write it against, so it is marked handled like any other.
  const reference =
    accountId === undefined
      ? null
      : await recordVerifiedTransaction(d1, {
          catalog: input.catalog,
          provider: input.provider,
          accountId,
          transaction: input.event.transaction,
          now: input.now,
          ...(input.observedAt === undefined ? {} : { observedAt: input.observedAt }),
        }).catch((error) => {
          if (error instanceof ErasedAccountError) return null;
          throw error;
        });
  await db
    .update(commerceEvents)
    .set({ processedAt: input.now })
    .where(and(eq(commerceEvents.provider, input.provider), eq(commerceEvents.providerEventId, input.event.providerEventId)));
  return reference;
}
