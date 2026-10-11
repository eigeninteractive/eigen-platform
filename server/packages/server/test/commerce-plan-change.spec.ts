/**
 * What a purchase grants when the thing bought, or the catalog describing it,
 * changes after the purchase.
 *
 * Two kinds of change. A subscription changes plan in place: a deferred Play
 * replacement's token serves the old plan until renewal and then swaps its
 * line item, and Stripe swaps the price when the player switches in the
 * Billing Portal. And the
 * catalog changes under every purchase at once, on deploy. In both, the
 * property is that access follows current truth -- the provider's for what is
 * served, the catalog's for what that means -- and that a one-time purchase
 * never turns into something else.
 */

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { readEffectiveAccess } from "../src/commerce/access.js";
import { resolveCommerce } from "../src/commerce/catalog.js";
import { recordVerifiedEvent, recordVerifiedTransaction } from "../src/commerce/ledger.js";
import { reconcileCommerce } from "../src/commerce/reconcile.js";
import type { CommerceCatalog, VerifiedCommerceTransaction } from "../src/commerce/types.js";
import { orm } from "../src/d1/orm.js";
import { commerceTransactions, entitlementGrants, users } from "../src/d1/schema.js";
import { fakeCommerceProvider } from "../src/testing.js";

const db = orm(env.DB);
const uid = (tag: string) => `${tag}-${crypto.randomUUID()}`;
const DAY = 24 * 60 * 60 * 1000;

/** Its own provider key, so the sweep below sees only rows this file wrote. */
const KEY = "plan-change";

const catalog: CommerceCatalog = {
  free: {},
  entitlements: [{ key: "pro", permissions: [{ kind: "analysis.use" }] }, { key: "archive", permissions: [{ kind: "replay.read" }] }, { key: "supporter" }],
  offers: [
    // Two base plans of one Play subscription product: the reference is what
    // tells them apart, and the yearly plan grants more.
    { key: "pro_monthly", name: "Pro monthly", description: "", kind: "subscription", entitlements: ["pro"], providerReferences: { [KEY]: "pro:monthly" } },
    { key: "pro_yearly", name: "Pro yearly", description: "", kind: "subscription", entitlements: ["pro", "archive"], providerReferences: { [KEY]: "pro:yearly" } },
    { key: "supporter", name: "Supporter", description: "", kind: "oneTime", entitlements: ["supporter"], providerReferences: { [KEY]: "supporter_once" } },
    { key: "supporter_plus", name: "Supporter plus", description: "", kind: "oneTime", entitlements: ["supporter"], providerReferences: { [KEY]: "supporter_plus" } },
  ],
};

async function account(tag: string): Promise<string> {
  const id = uid(tag);
  const now = Date.now();
  await db.insert(users).values({ id, username: id, displayName: tag, isAnonymous: false, createdAt: now, updatedAt: now });
  return id;
}

function subscription(providerTransactionId: string, providerReference: string, overrides: Partial<VerifiedCommerceTransaction> = {}): VerifiedCommerceTransaction {
  const now = Date.now();
  return { providerTransactionId, providerReference, kind: "subscription", state: "active", purchasedAt: now - DAY, validFrom: now - DAY, validUntil: now + 30 * DAY, ...overrides };
}

const record = async (accountId: string, transaction: VerifiedCommerceTransaction) => await recordVerifiedTransaction(env.DB, { catalog, provider: KEY, accountId, transaction, now: Date.now() });

const access = async (accountId: string, using: CommerceCatalog = catalog) => (await readEffectiveAccess(env.DB, using, accountId, Date.now())).snapshot;

const entitlementKeys = async (accountId: string) => (await access(accountId)).entitlements.map((item) => item.key).sort();

const row = async (providerTransactionId: string) => await db.select().from(commerceTransactions).where(eq(commerceTransactions.providerTransactionId, providerTransactionId)).get();

describe("a subscription that changes plan", () => {
  it("moves the transaction to the new offer, and revokes what only the old one granted", async () => {
    const accountId = await account("upgrade");
    const token = crypto.randomUUID();
    await record(accountId, subscription(token, "pro:yearly"));
    expect(await entitlementKeys(accountId)).toEqual(["archive", "pro"]);

    // The renewal notification reports the plan the player switched down to.
    await recordVerifiedEvent(env.DB, { catalog, provider: KEY, now: Date.now(), event: { providerEventId: crypto.randomUUID(), accountId, transaction: subscription(token, "pro:monthly") } });

    expect(await row(token)).toMatchObject({ providerReference: "pro:monthly", offerKey: "pro_monthly" });
    expect(await entitlementKeys(accountId)).toEqual(["pro"]);
    // Revoked, not deleted: the grant history is the audit trail.
    const transactionId = (await row(token))?.id as string;
    const archive = await db.select().from(entitlementGrants).where(eq(entitlementGrants.sourceTransactionId, transactionId)).all();
    expect(archive.find((grant) => grant.entitlementKey === "archive")?.revokedAt).not.toBeNull();
  });

  it("follows a plan change the sweep finds, with no claim naming it", async () => {
    const accountId = await account("sweep-change");
    const token = crypto.randomUUID();
    const provider = fakeCommerceProvider([], Date.now, KEY);
    await record(accountId, subscription(token, "pro:monthly"));
    provider.transactions.set(token, { providerReference: "pro:yearly", validUntil: Date.now() + 365 * DAY });

    // The sweep asks about every row this file wrote; only this one has
    // provider truth, so it is the only one that moves.
    await reconcileCommerce(env.DB, resolveCommerce({ catalog, providers: [provider], reconcileBatch: 1000 }), env);

    expect(await row(token)).toMatchObject({ offerKey: "pro_yearly", reconcileFailures: 0 });
    expect(await entitlementKeys(accountId)).toEqual(["archive", "pro"]);
  });

  it("records the plan the provider verified, whatever the device guessed", async () => {
    const accountId = await account("guessed");
    const token = crypto.randomUUID();
    // A restore on a fresh install: the device saw product `pro` and named the
    // monthly offer; Play says the token is yearly.
    await expect(record(accountId, subscription(token, "pro:yearly"))).resolves.toMatchObject({ providerReference: "pro:yearly" });
    expect(await row(token)).toMatchObject({ offerKey: "pro_yearly" });
    expect(await entitlementKeys(accountId)).toEqual(["archive", "pro"]);
  });

  it("follows a deferred plan change: the old plan until renewal, the new one after", async () => {
    const accountId = await account("deferred");
    const token = crypto.randomUUID();
    await record(accountId, subscription(token, "pro:monthly"));
    expect(await entitlementKeys(accountId)).toEqual(["pro"]);
    await record(accountId, subscription(token, "pro:yearly"));
    expect(await entitlementKeys(accountId)).toEqual(["archive", "pro"]);
  });

  it("refuses a product the catalog does not sell", async () => {
    const accountId = await account("unregistered");
    await expect(record(accountId, subscription(crypto.randomUUID(), "pro:weekly"))).rejects.toThrow(/not registered/);
  });

  it("never turns a one-time purchase into another product", async () => {
    const accountId = await account("one-time");
    const orderId = crypto.randomUUID();
    const oneTime = (providerReference: string): VerifiedCommerceTransaction => ({ providerTransactionId: orderId, providerReference, kind: "oneTime", state: "active", purchasedAt: Date.now(), validFrom: Date.now() });
    await record(accountId, oneTime("supporter_once"));
    await expect(record(accountId, oneTime("supporter_plus"))).rejects.toThrow(/changed product identity/);
    expect(await row(orderId)).toMatchObject({ offerKey: "supporter" });
  });

  it("never changes a transaction's kind", async () => {
    const accountId = await account("kind");
    const token = crypto.randomUUID();
    await record(accountId, subscription(token, "pro:monthly"));
    await expect(record(accountId, { ...subscription(token, "supporter_once"), kind: "oneTime", validUntil: undefined } as VerifiedCommerceTransaction)).rejects.toThrow(/changed product identity/);
  });
});

describe("a catalog that changes under existing purchases", () => {
  it("stops reporting, and granting, an entitlement the catalog no longer defines", async () => {
    const accountId = await account("retired");
    await record(accountId, subscription(crypto.randomUUID(), "pro:yearly"));

    // A deploy drops `archive` from the catalog and from the yearly offer.
    const next: CommerceCatalog = {
      ...catalog,
      entitlements: catalog.entitlements.filter((item) => item.key !== "archive"),
      offers: catalog.offers.map((offer) => (offer.key === "pro_yearly" ? { ...offer, entitlements: ["pro"] } : offer)),
    };
    const snapshot = await access(accountId, next);
    expect(snapshot.entitlements.map((item) => item.key)).toEqual(["pro"]);
    expect(snapshot.permissions).not.toContainEqual({ kind: "replay.read" });
    expect(snapshot.permissions).toContainEqual({ kind: "analysis.use" });
  });

  it("grants an entitlement's new permissions to purchases made before the change", async () => {
    const accountId = await account("redefined");
    await record(accountId, subscription(crypto.randomUUID(), "pro:monthly"));

    const next: CommerceCatalog = { ...catalog, entitlements: catalog.entitlements.map((item) => (item.key === "pro" ? { key: "pro", permissions: [{ kind: "replay.read" }] } : item)) };
    const snapshot = await access(accountId, next);
    expect(snapshot.permissions).toContainEqual({ kind: "replay.read" });
    expect(snapshot.permissions).not.toContainEqual({ kind: "analysis.use" });
  });
});

describe("a purchase that replaces another", () => {
  it("ends the transaction it replaced, so the old plan's grants do not outlive it", async () => {
    // An immediate Play plan change: a new token for the monthly plan, naming
    // the yearly token it replaced. The yearly row's archive grant must go now,
    // not whenever the sweep next reads the old token.
    const accountId = await account("replaced");
    const yearly = crypto.randomUUID();
    const monthly = crypto.randomUUID();
    await record(accountId, subscription(yearly, "pro:yearly"));
    await record(accountId, subscription(monthly, "pro:monthly", { replacesProviderTransactionId: yearly }));

    expect(await row(yearly)).toMatchObject({ state: "expired" });
    expect((await row(yearly))?.validUntil).toBeLessThanOrEqual(Date.now());
    expect(await entitlementKeys(accountId)).toEqual(["pro"]);
  });

  it("keeps the old plan serving while the replacement is still being paid for", async () => {
    const accountId = await account("pending-replacement");
    const yearly = crypto.randomUUID();
    await record(accountId, subscription(yearly, "pro:yearly"));
    await record(accountId, subscription(crypto.randomUUID(), "pro:monthly", { state: "pending", replacesProviderTransactionId: yearly }));
    expect(await row(yearly)).toMatchObject({ state: "active" });
    expect(await entitlementKeys(accountId)).toEqual(["archive", "pro"]);
  });

  it("attributes a notification that names no account through the purchase it replaced", async () => {
    // A resubscription from the Play Store after a lapse carries no obfuscated
    // account id; the token it replaced says whose it is.
    const accountId = await account("resubscribed");
    const lapsed = crypto.randomUUID();
    const renewed = crypto.randomUUID();
    await record(accountId, subscription(lapsed, "pro:monthly", { state: "expired", validUntil: Date.now() - DAY, validFrom: Date.now() - 31 * DAY }));
    await recordVerifiedEvent(env.DB, { catalog, provider: KEY, now: Date.now(), event: { providerEventId: crypto.randomUUID(), transaction: subscription(renewed, "pro:monthly", { replacesProviderTransactionId: lapsed }) } });

    expect(await row(renewed)).toMatchObject({ userId: accountId, offerKey: "pro_monthly" });
    expect(await entitlementKeys(accountId)).toEqual(["pro"]);
  });

  it("handles a notification it cannot attribute without recording it, for the player's own claim to pick up", async () => {
    const token = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    await expect(recordVerifiedEvent(env.DB, { catalog, provider: KEY, now: Date.now(), event: { providerEventId: eventId, transaction: subscription(token, "pro:monthly") } })).resolves.toBeNull();
    expect(await row(token)).toBeUndefined();
  });

  it("will not let a claim that names nobody take over another account's subscription", async () => {
    const owner = await account("owner");
    const other = await account("other");
    const original = crypto.randomUUID();
    await record(owner, subscription(original, "pro:monthly"));
    await expect(record(other, subscription(crypto.randomUUID(), "pro:monthly", { replacesProviderTransactionId: original }))).rejects.toThrow(/another account/);
    expect(await row(original)).toMatchObject({ state: "active" });
  });

  it("lets a purchase the provider binds to the new account replace the old one, leaving the old account's row to the sweep", async () => {
    // The same Google account, two Eigen accounts: the second upgraded, and
    // Play bound the new token to it.
    const first = await account("first");
    const second = await account("second");
    const original = crypto.randomUUID();
    await record(first, subscription(original, "pro:monthly"));
    await record(second, subscription(crypto.randomUUID(), "pro:yearly", { replacesProviderTransactionId: original, providerAccountId: second }));
    expect(await entitlementKeys(second)).toEqual(["archive", "pro"]);
    expect(await row(original)).toMatchObject({ state: "active" });
  });
});

describe("two verifications of one purchase racing", () => {
  it("keeps the provider's later answer when the earlier one is written last", async () => {
    // A claim read Play before the renewal webhook did, and finished after it.
    const accountId = await account("race");
    const token = crypto.randomUUID();
    const read = Date.now();
    await recordVerifiedTransaction(env.DB, { catalog, provider: KEY, accountId, transaction: subscription(token, "pro:monthly"), now: read, observedAt: read - 1 });
    const later = await recordVerifiedTransaction(env.DB, { catalog, provider: KEY, accountId, transaction: subscription(token, "pro:yearly"), now: read + 2, observedAt: read + 1 });
    const earlier = await recordVerifiedTransaction(env.DB, {
      catalog,
      provider: KEY,
      accountId,
      transaction: subscription(token, "pro:monthly", { requiresAcknowledgement: true, sealedProviderState: "{}" }),
      now: read + 3,
      observedAt: read,
    });

    expect(later.providerReference).toBe("pro:yearly");
    expect(await row(token)).toMatchObject({ offerKey: "pro_yearly" });
    expect(await entitlementKeys(accountId)).toEqual(["archive", "pro"]);
    // The write that lost owns nothing, including an acknowledgement.
    expect(earlier.acknowledgementPending).toBe(false);
  });

  it("does not undo an acknowledgement recorded since the row was read", async () => {
    const accountId = await account("acknowledged");
    const token = crypto.randomUUID();
    await record(accountId, subscription(token, "pro:monthly", { requiresAcknowledgement: true, sealedProviderState: "{}" }));
    await db.update(commerceTransactions).set({ acknowledgementState: "acknowledged" }).where(eq(commerceTransactions.providerTransactionId, token));
    await record(accountId, subscription(token, "pro:monthly", { requiresAcknowledgement: true, sealedProviderState: "{}" }));
    expect(await row(token)).toMatchObject({ acknowledgementState: "acknowledged" });
  });
});

describe("a product the catalog stopped selling", () => {
  const retired: CommerceCatalog = { ...catalog, offers: catalog.offers.filter((offer) => offer.key !== "supporter") };
  const oneTime = (orderId: string, state: VerifiedCommerceTransaction["state"]): VerifiedCommerceTransaction => ({ providerTransactionId: orderId, providerReference: "supporter_once", kind: "oneTime", state, purchasedAt: Date.now(), validFrom: Date.now() });

  it("still takes its refund, and revokes what it granted", async () => {
    const accountId = await account("refund-retired");
    const orderId = crypto.randomUUID();
    await record(accountId, oneTime(orderId, "active"));
    await recordVerifiedTransaction(env.DB, { catalog: retired, provider: KEY, accountId, transaction: oneTime(orderId, "revoked"), now: Date.now() });

    expect(await row(orderId)).toMatchObject({ state: "revoked", offerKey: "supporter" });
    const transactionId = (await row(orderId))?.id as string;
    const grants = await db.select().from(entitlementGrants).where(eq(entitlementGrants.sourceTransactionId, transactionId)).all();
    expect(grants.every((grant) => grant.revokedAt !== null)).toBe(true);
  });

  it("refuses to grant it anew, or to anyone new", async () => {
    const accountId = await account("new-retired");
    const orderId = crypto.randomUUID();
    await record(accountId, oneTime(orderId, "active"));
    await expect(recordVerifiedTransaction(env.DB, { catalog: retired, provider: KEY, accountId, transaction: oneTime(orderId, "active"), now: Date.now() })).rejects.toThrow(/not registered/);
    await expect(recordVerifiedTransaction(env.DB, { catalog: retired, provider: KEY, accountId, transaction: oneTime(crypto.randomUUID(), "revoked"), now: Date.now() })).rejects.toThrow(/not registered/);
  });
});
