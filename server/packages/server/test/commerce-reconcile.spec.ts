/**
 * Reconciliation liveness, and the two provider-lifecycle steps that only
 * happen later: acknowledgement, and the sweep that repairs a missed one.
 *
 * The property under test is that the sweep always makes progress. It is a
 * bounded queue over a table that outlives any one provider's mood, so the
 * failure that matters is not "a transaction did not update" but "a
 * transaction nobody can update stopped everything behind it from updating".
 */

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { resolveCommerce } from "../src/commerce/catalog.js";
import { reconcileCommerce, stalledTransactions } from "../src/commerce/reconcile.js";
import type { ResolvedCommerce } from "../src/commerce/types.js";
import { orm } from "../src/d1/orm.js";
import { commerceTransactions, entitlementGrants } from "../src/d1/schema.js";
import { type FakeCommerceProvider, fakeCommerceProvider } from "../src/testing.js";

const db = orm(env.DB);
const uid = (tag: string) => `${tag}-${crypto.randomUUID()}`;

let provider: FakeCommerceProvider;
/** Each test sweeps its own provider, so the queue it reasons about contains
 * only the rows it seeded. The table is shared across the whole suite. */
let providerKey: string;

function commerce(overrides: { reconcileBatch?: number; reconcileMaxFailures?: number } = {}): ResolvedCommerce {
  return resolveCommerce({
    catalog: {
      free: {},
      entitlements: [{ key: "pro" }],
      offers: [{ key: "pro", name: "Pro", description: "Subscription", kind: "subscription", entitlements: ["pro"], providerReferences: { [providerKey]: "pro_monthly" } }],
    },
    providers: [provider],
    ...overrides,
  });
}

/** A subscription row in a state the sweep is interested in. */
async function seed(accountId: string, providerTransactionId: string, createdAt: number, overrides: Partial<typeof commerceTransactions.$inferInsert> = {}): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(commerceTransactions).values({
    id,
    provider: providerKey,
    providerTransactionId,
    userId: accountId,
    providerReference: "pro_monthly",
    offerKey: "pro",
    kind: "subscription",
    state: "active",
    purchasedAt: createdAt,
    validFrom: createdAt,
    validUntil: null,
    sealedProviderState: null,
    acknowledgementState: "notRequired",
    lastReconciledAt: null,
    reconcileAttemptedAt: null,
    reconcileFailures: 0,
    reconcileError: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
  return id;
}

const row = async (providerTransactionId: string) => await db.select().from(commerceTransactions).where(eq(commerceTransactions.providerTransactionId, providerTransactionId)).get();

beforeEach(() => {
  providerKey = `fake-${crypto.randomUUID().slice(0, 8)}`;
  provider = fakeCommerceProvider([{ provider: providerKey, providerReference: "pro_monthly", displayPrice: "$1.00", currencyCode: "USD", kind: "subscription" }], Date.now, providerKey);
});

describe("reconciliation liveness", () => {
  it("moves past a transaction the provider will never answer for", async () => {
    const account = uid("starve");
    const base = Date.now() - 100_000;
    // Deliberately the older row, so ordering puts it first on the first pass.
    await seed(account, "unanswerable", base);
    await seed(account, "behind", base + 1_000);
    // The provider knows only the second one.
    provider.transactions.set("behind", { state: "active" });

    const resolved = commerce({ reconcileBatch: 1 });
    for (let pass = 0; pass < 2; pass++) await reconcileCommerce(env.DB, resolved, env);

    // Pass one asks for the unanswerable row, pass two moves on rather than
    // asking again. This is the whole point: a batch slot is not a life estate.
    expect(provider.sweeps).toEqual([["unanswerable"], ["behind"]]);
    expect((await row("behind"))?.lastReconciledAt).not.toBeNull();
    expect((await row("unanswerable"))?.reconcileFailures).toBe(1);
  });

  it("keeps sweeping the rest of a batch when one transaction cannot be applied", async () => {
    const account = uid("partial");
    const base = Date.now() - 100_000;
    await seed(account, "bad-product", base);
    await seed(account, "good", base + 1_000);
    // A product this catalog does not register: the ledger refuses it.
    provider.transactions.set("bad-product", { providerReference: "no_such_product" });
    provider.transactions.set("good", { state: "grace" });

    await reconcileCommerce(env.DB, commerce({ reconcileBatch: 10 }), env);

    expect((await row("good"))?.state).toBe("grace");
    expect((await row("bad-product"))?.reconcileFailures).toBe(1);
    expect((await row("bad-product"))?.reconcileError).toContain("does not match");
  });

  it("counts a provider outage against the batch without losing the queue", async () => {
    const account = uid("outage");
    await seed(account, "outage-one", Date.now() - 50_000);
    provider.transactions.set("outage-one", { state: "active" });
    provider.failNextSweep("provider unavailable");

    const resolved = commerce();
    await reconcileCommerce(env.DB, resolved, env);
    expect((await row("outage-one"))?.reconcileFailures).toBe(1);
    expect((await row("outage-one"))?.reconcileAttemptedAt).not.toBeNull();

    // The outage clears and the same row is repaired on the next sweep.
    await reconcileCommerce(env.DB, resolved, env);
    expect((await row("outage-one"))?.reconcileFailures).toBe(0);
    expect((await row("outage-one"))?.lastReconciledAt).not.toBeNull();
  });

  it("gives up at the ceiling and reports the transaction to the operator", async () => {
    const account = uid("stall");
    await seed(account, "hopeless", Date.now() - 50_000);

    const resolved = commerce({ reconcileBatch: 5, reconcileMaxFailures: 2 });
    for (let pass = 0; pass < 4; pass++) await reconcileCommerce(env.DB, resolved, env);

    // Swept twice, then dropped from the queue entirely.
    expect(provider.sweeps).toEqual([["hopeless"], ["hopeless"]]);
    expect((await row("hopeless"))?.reconcileFailures).toBe(2);
    const stalled = await stalledTransactions(env.DB, resolved);
    expect(stalled.map((entry) => entry.providerTransactionId)).toContain("hopeless");
  });

  it("returns a given-up transaction to the queue when the provider speaks again", async () => {
    const account = uid("revive");
    const id = await seed(account, "revived", Date.now() - 50_000, { reconcileFailures: 9, reconcileError: "The provider did not answer for this transaction" });
    const resolved = commerce({ reconcileMaxFailures: 10 });

    provider.transactions.set("revived", { state: "active" });
    await reconcileCommerce(env.DB, resolved, env);

    const after = await db.select().from(commerceTransactions).where(eq(commerceTransactions.id, id)).get();
    expect(after?.reconcileFailures).toBe(0);
    expect(after?.reconcileError).toBeNull();
  });
});

describe("acknowledgement", () => {
  it("acknowledges only after the grant is durable, and only once", async () => {
    const account = uid("ack");
    await seed(account, "needs-ack", Date.now() - 50_000, { acknowledgementState: "pending", sealedProviderState: "token-abc" });
    provider.transactions.set("needs-ack", { state: "active", requiresAcknowledgement: true, sealedProviderState: "token-abc" });

    const resolved = commerce();
    await reconcileCommerce(env.DB, resolved, env);

    expect(provider.acknowledged).toEqual(["needs-ack"]);
    expect((await row("needs-ack"))?.acknowledgementState).toBe("acknowledged");
    // The grant exists before the provider was told, never after.
    const grants = await db.select().from(entitlementGrants).where(eq(entitlementGrants.userId, account)).all();
    expect(grants).toHaveLength(1);

    // An acknowledged transaction is no longer swept for acknowledgement.
    await reconcileCommerce(env.DB, resolved, env);
    expect(provider.acknowledged).toEqual(["needs-ack"]);
  });

  it("leaves acknowledgement pending and retries it when the provider refuses", async () => {
    const account = uid("ack-retry");
    await seed(account, "ack-later", Date.now() - 50_000, { acknowledgementState: "pending", sealedProviderState: "token-xyz" });
    provider.transactions.set("ack-later", { state: "active", requiresAcknowledgement: true, sealedProviderState: "token-xyz" });
    provider.failAcknowledgement();

    const resolved = commerce();
    await reconcileCommerce(env.DB, resolved, env);
    // The ledger committed; only the provider's half failed, so the row stays
    // pending and counts a failure rather than being marked acknowledged.
    expect((await row("ack-later"))?.acknowledgementState).toBe("pending");
    expect((await row("ack-later"))?.reconcileFailures).toBe(1);

    provider.clearFailures();
    await reconcileCommerce(env.DB, resolved, env);
    expect(provider.acknowledged).toEqual(["ack-later"]);
    expect((await row("ack-later"))?.acknowledgementState).toBe("acknowledged");
    expect((await row("ack-later"))?.reconcileFailures).toBe(0);
  });
});
