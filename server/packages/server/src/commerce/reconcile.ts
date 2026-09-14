import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { orm } from "../d1/orm.js";
import { commerceTransactions } from "../d1/schema.js";
import { recordVerifiedTransaction } from "./ledger.js";
import { acknowledgeIfNeeded } from "./provider-lifecycle.js";
import type { ResolvedCommerce } from "./types.js";

/** Repair missed notifications with a fair, bounded scan per provider. */
export async function reconcileCommerce(d1: D1Database, commerce: ResolvedCommerce, env: unknown): Promise<void> {
  const db = orm(d1);
  for (const adapter of commerce.providers.values()) {
    if (adapter.reconcile === undefined) continue;
    const rows = await db
      .select({
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
          or(
            inArray(commerceTransactions.state, ["pending", "grace"]),
            and(eq(commerceTransactions.kind, "subscription"), eq(commerceTransactions.state, "active")),
            eq(commerceTransactions.acknowledgementState, "pending"),
          ),
        ),
      )
      .orderBy(asc(sql`coalesce(${commerceTransactions.lastReconciledAt}, 0)`), asc(commerceTransactions.createdAt))
      .limit(commerce.reconcileBatch)
      .all();
    if (rows.length === 0) continue;

    const references = rows.map((row) => ({
      providerTransactionId: row.providerTransactionId,
      accountId: row.accountId as string,
      providerReference: row.providerReference,
      kind: row.kind,
      ...(row.sealedProviderState === null ? {} : { sealedProviderState: row.sealedProviderState }),
      acknowledgementPending: row.acknowledgementState === "pending",
    }));
    const known = new Map(rows.map((row) => [row.providerTransactionId, row]));
    try {
      const updates = await adapter.reconcile(env, references);
      for (const transaction of updates) {
        const row = known.get(transaction.providerTransactionId);
        if (row === undefined) {
          throw new Error(`commerce reconciliation: ${adapter.key} returned an unrequested transaction`);
        }
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
        known.delete(transaction.providerTransactionId);
      }
      if (known.size > 0) {
        throw new Error(`commerce reconciliation: ${adapter.key} omitted ${known.size} requested transaction(s)`);
      }
    } catch (error) {
      // One provider outage must not starve another provider's repairs.
      console.error(`commerce reconciliation failed for ${adapter.key}`, error);
    }
  }
}
