import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { orm } from "../d1/orm.js";
import { commerceCheckoutOperations, commerceTransactions } from "../d1/schema.js";
import { HttpError } from "../http.js";
import type { CommerceCheckout, CommerceOffer } from "./types.js";

const CHECKOUT_WINDOW_MS = 60 * 60 * 1000;
const RETRY_LEASE_MS = 30_000;

type Checkout = typeof commerceCheckoutOperations.$inferSelect;

function fingerprint(offerKey: string, returnUrl: string): string {
  return JSON.stringify({ offerKey, returnUrl });
}

export async function assertPurchasable(d1: D1Database, accountId: string, offer: CommerceOffer): Promise<void> {
  if (offer.repeatable === true) return;
  const active = await orm(d1)
    .select({ id: commerceTransactions.id })
    .from(commerceTransactions)
    .where(and(eq(commerceTransactions.userId, accountId), eq(commerceTransactions.offerKey, offer.key), inArray(commerceTransactions.state, ["pending", "active", "grace"])))
    .get();
  if (active !== undefined) {
    throw new HttpError(409, "This account already has this non-repeatable purchase", "purchaseConflict");
  }
}

function findOperation(d1: D1Database, provider: string, accountId: string, operationId: string) {
  return orm(d1)
    .select()
    .from(commerceCheckoutOperations)
    .where(and(eq(commerceCheckoutOperations.provider, provider), eq(commerceCheckoutOperations.userId, accountId), eq(commerceCheckoutOperations.operationId, operationId)))
    .get();
}

function checkReplay(row: Checkout, expected: string, now: number): Checkout {
  if (row.fingerprint !== expected) throw new HttpError(409, "operationId was already used for a different checkout", "purchaseConflict");
  if (row.expiresAt <= now) throw new HttpError(409, "This checkout expired. Start a new checkout.", "purchaseConflict");
  return row;
}

/** The slot and the provider request are durable before anything is sent. */
export async function reserveCheckout(
  d1: D1Database,
  input: {
    provider: string;
    accountId: string;
    operationId: string;
    offer: CommerceOffer;
    request: Checkout["request"];
    now: number;
  },
): Promise<Checkout> {
  const expected = fingerprint(input.offer.key, input.request.returnUrl);
  const existing = await findOperation(d1, input.provider, input.accountId, input.operationId);
  if (existing !== undefined) return checkReplay(existing, expected, input.now);

  await assertPurchasable(d1, input.accountId, input.offer);
  const db = orm(d1);
  const slot = and(eq(commerceCheckoutOperations.userId, input.accountId), eq(commerceCheckoutOperations.reservedOfferKey, input.offer.key));
  const insert = db
    .insert(commerceCheckoutOperations)
    .values({
      id: crypto.randomUUID(),
      provider: input.provider,
      userId: input.accountId,
      operationId: input.operationId,
      offerKey: input.offer.key,
      reservedOfferKey: input.offer.repeatable === true ? null : input.offer.key,
      fingerprint: expected,
      request: input.request,
      expiresAt: Math.floor((input.now + CHECKOUT_WINDOW_MS) / 1000) * 1000,
      createdAt: input.now,
    })
    .onConflictDoNothing()
    .returning();
  const [, [created]] = await db.batch([
    db
      .update(commerceCheckoutOperations)
      .set({ reservedOfferKey: null })
      .where(and(slot, lte(commerceCheckoutOperations.expiresAt, input.now))),
    insert,
  ]);
  if (created !== undefined) return created;

  const raced = await findOperation(d1, input.provider, input.accountId, input.operationId);
  if (raced !== undefined) return checkReplay(raced, expected, input.now);
  const reserved = await db.select().from(commerceCheckoutOperations).where(slot).get();
  if (reserved === undefined || reserved.expiresAt <= input.now) throw checkoutPending();
  if (reserved.provider !== input.provider) {
    throw new HttpError(409, "This offer already has an active checkout on another storefront", "purchaseConflict");
  }
  return reserved;
}

export function checkoutPending(): HttpError {
  return new HttpError(409, "Checkout creation is pending. Try again shortly.", "purchasePending");
}

/** Claim the outbound call across Workers. Providers without replay support
 * get one attempt for the lifetime of the reservation. */
export async function acquireCheckout(d1: D1Database, checkout: Checkout, now: number, retryable: boolean): Promise<number> {
  const leaseUntil = retryable ? Math.min(now + RETRY_LEASE_MS, checkout.expiresAt) : checkout.expiresAt;
  const acquired = await orm(d1)
    .update(commerceCheckoutOperations)
    .set({ leaseUntil })
    .where(and(eq(commerceCheckoutOperations.id, checkout.id), gt(commerceCheckoutOperations.expiresAt, now), isNull(commerceCheckoutOperations.result), or(isNull(commerceCheckoutOperations.leaseUntil), lte(commerceCheckoutOperations.leaseUntil, now))))
    .returning({ id: commerceCheckoutOperations.id })
    .get();
  if (acquired === undefined) throw checkoutPending();
  return leaseUntil;
}

function ownsLease(id: string, leaseUntil: number) {
  return and(eq(commerceCheckoutOperations.id, id), eq(commerceCheckoutOperations.leaseUntil, leaseUntil));
}

export async function releaseCheckout(d1: D1Database, id: string, leaseUntil: number): Promise<void> {
  await orm(d1).update(commerceCheckoutOperations).set({ leaseUntil: null }).where(ownsLease(id, leaseUntil));
}

export async function finishCheckout(d1: D1Database, checkout: Checkout, leaseUntil: number, response: CommerceCheckout, now: number) {
  const expiresAt = response.expiresAt ?? checkout.expiresAt;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > checkout.expiresAt) {
    throw new HttpError(502, "The provider returned an invalid checkout expiry");
  }
  const result = { url: response.url, ...(response.providerAccountId === undefined ? {} : { providerAccountId: response.providerAccountId }) };
  const completed = await orm(d1).update(commerceCheckoutOperations).set({ result, expiresAt, leaseUntil: null }).where(ownsLease(checkout.id, leaseUntil)).returning({ id: commerceCheckoutOperations.id }).get();
  if (completed === undefined) throw checkoutPending();
  return result;
}
