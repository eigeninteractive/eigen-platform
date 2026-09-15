import { and, asc, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { orm } from "../d1/orm.js";
import { commerceTransactions } from "../d1/schema.js";
import { recordVerifiedTransaction } from "./ledger.js";
import { acknowledgeIfNeeded } from "./provider-lifecycle.js";
import type { CommerceProvider, ResolvedCommerce } from "./types.js";

/** Operator-facing text only. Adapters must keep tokens out of error messages,
 * and the length cap keeps a runaway provider message out of the row. */
function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
}

type SweepRow = {
  id: string;
  providerTransactionId: string;
  accountId: string | null;
  providerReference: string;
  offerKey: string;
  kind: "oneTime" | "subscription";
  sealedProviderState: string | null;
  acknowledgementState: "notRequired" | "pending" | "acknowledged";
};

async function countFailure(d1: D1Database, ids: readonly string[], now: number, reason: string): Promise<void> {
  if (ids.length === 0) return;
  await orm(d1)
    .update(commerceTransactions)
    .set({
      reconcileFailures: sql`${commerceTransactions.reconcileFailures} + 1`,
      reconcileError: reason,
      updatedAt: now,
    })
    .where(inArray(commerceTransactions.id, [...ids]));
}

async function clearFailure(d1: D1Database, id: string, now: number): Promise<void> {
  await orm(d1).update(commerceTransactions).set({ reconcileFailures: 0, reconcileError: null, updatedAt: now }).where(eq(commerceTransactions.id, id));
}

async function sweepProvider(d1: D1Database, commerce: ResolvedCommerce, env: unknown, adapter: CommerceProvider<unknown>): Promise<void> {
  const db = orm(d1);
  const rows: SweepRow[] = await db
    .select({
      id: commerceTransactions.id,
      providerTransactionId: commerceTransactions.providerTransactionId,
      accountId: commerceTransactions.userId,
      providerReference: commerceTransactions.providerReference,
      offerKey: commerceTransactions.offerKey,
      kind: commerceTransactions.kind,
      sealedProviderState: commerceTransactions.sealedProviderState,
      acknowledgementState: commerceTransactions.acknowledgementState,
    })
    .from(commerceTransactions)
    .where(
      and(
        eq(commerceTransactions.provider, adapter.key),
        isNotNull(commerceTransactions.userId),
        lt(commerceTransactions.reconcileFailures, commerce.reconcileMaxFailures),
        or(inArray(commerceTransactions.state, ["pending", "grace"]), and(eq(commerceTransactions.kind, "subscription"), eq(commerceTransactions.state, "active")), eq(commerceTransactions.acknowledgementState, "pending")),
      ),
    )
    // Least-recently-LOOKED-AT first. Paired with the unconditional stamp
    // below, every selected row leaves the front of the queue this pass.
    .orderBy(asc(sql`coalesce(${commerceTransactions.reconcileAttemptedAt}, 0)`), asc(commerceTransactions.createdAt))
    .limit(commerce.reconcileBatch)
    .all();
  if (rows.length === 0) return;

  const now = commerce.now();
  // Liveness, and before the provider is called at all: whatever happens next
  // -- an outage, a throw, a transaction this provider will never answer for
  // again -- these rows have had their turn and the next sweep moves past them.
  await db
    .update(commerceTransactions)
    .set({ reconcileAttemptedAt: now })
    .where(
      inArray(
        commerceTransactions.id,
        rows.map((row) => row.id),
      ),
    );

  const references = rows.map((row) => ({
    providerTransactionId: row.providerTransactionId,
    accountId: row.accountId as string,
    providerReference: row.providerReference,
    kind: row.kind,
    ...(row.sealedProviderState === null ? {} : { sealedProviderState: row.sealedProviderState }),
    acknowledgementPending: row.acknowledgementState === "pending",
  }));

  let updates: readonly Awaited<ReturnType<NonNullable<CommerceProvider<unknown>["reconcile"]>>>[number][];
  try {
    updates = [...(await (adapter.reconcile as NonNullable<CommerceProvider<unknown>["reconcile"]>)(env, references))];
  } catch (error) {
    // The whole call failed, so every row in the batch is unanswered. One
    // provider outage must not starve another provider's repairs, and a
    // provider that is down must not stop this one advancing next sweep.
    const reason = describe(error);
    await countFailure(
      d1,
      rows.map((row) => row.id),
      now,
      reason,
    );
    console.error(`commerce reconciliation failed for ${adapter.key}`, error);
    return;
  }

  const unanswered = new Map(rows.map((row) => [row.providerTransactionId, row]));
  for (const transaction of updates) {
    const row = unanswered.get(transaction.providerTransactionId);
    if (row === undefined) {
      // An adapter bug, not a transaction problem: report it and keep going,
      // because the rows that WERE answered still deserve their update.
      console.error(`commerce reconciliation: ${adapter.key} returned unrequested transaction ${transaction.providerTransactionId}`);
      continue;
    }
    unanswered.delete(transaction.providerTransactionId);
    try {
      const reference = await recordVerifiedTransaction(d1, {
        catalog: commerce.catalog,
        provider: adapter.key,
        accountId: row.accountId as string,
        expectedOfferKey: row.offerKey,
        transaction,
        now: commerce.now(),
        reconciled: true,
      });
      await acknowledgeIfNeeded(d1, adapter, env, reference, commerce.now);
      await clearFailure(d1, row.id, commerce.now());
    } catch (error) {
      // One transaction the ledger or the acknowledgement refused. Counted
      // against that row alone; the rest of the batch is unaffected.
      await countFailure(d1, [row.id], commerce.now(), describe(error));
      console.error(`commerce reconciliation: ${adapter.key} could not apply ${row.providerTransactionId}`, error);
    }
  }

  if (unanswered.size > 0) {
    await countFailure(
      d1,
      [...unanswered.values()].map((row) => row.id),
      commerce.now(),
      "The provider did not answer for this transaction",
    );
  }
}

/** Repair missed notifications with a fair, bounded, non-starving sweep. */
export async function reconcileCommerce(d1: D1Database, commerce: ResolvedCommerce, env: unknown): Promise<void> {
  for (const adapter of commerce.providers.values()) {
    if (adapter.reconcile === undefined) continue;
    await sweepProvider(d1, commerce, env, adapter);
  }
}

/** Transactions the sweep has given up on, newest failure first. */
export async function stalledTransactions(d1: D1Database, commerce: ResolvedCommerce, limit = 100): Promise<{ provider: string; providerTransactionId: string; offerKey: string; state: string; failures: number; error: string | null; attemptedAt: number | null; reconciledAt: number | null }[]> {
  return await orm(d1)
    .select({
      provider: commerceTransactions.provider,
      providerTransactionId: commerceTransactions.providerTransactionId,
      offerKey: commerceTransactions.offerKey,
      state: commerceTransactions.state,
      failures: commerceTransactions.reconcileFailures,
      error: commerceTransactions.reconcileError,
      attemptedAt: commerceTransactions.reconcileAttemptedAt,
      reconciledAt: commerceTransactions.lastReconciledAt,
    })
    .from(commerceTransactions)
    .where(sql`${commerceTransactions.reconcileFailures} >= ${commerce.reconcileMaxFailures}`)
    .orderBy(asc(commerceTransactions.reconcileAttemptedAt))
    .limit(limit)
    .all();
}
