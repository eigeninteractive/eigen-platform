import { and, eq, gt, inArray } from "drizzle-orm";
import { isUniqueViolation } from "../d1/errors.js";
import { orm } from "../d1/orm.js";
import { commerceCheckoutOperations, commerceTransactions } from "../d1/schema.js";
import { HttpError } from "../http.js";
import type { CommerceCheckout, CommerceOffer } from "./types.js";

function fingerprint(offerKey: string, returnUrl: string): string {
  return JSON.stringify({ offerKey, returnUrl });
}

export async function assertPurchasable(d1: D1Database, provider: string, accountId: string, offer: CommerceOffer): Promise<void> {
  if (offer.repeatable === true) return;
  const active = await orm(d1)
    .select({ id: commerceTransactions.id })
    .from(commerceTransactions)
    .where(and(eq(commerceTransactions.provider, provider), eq(commerceTransactions.userId, accountId), eq(commerceTransactions.offerKey, offer.key), inArray(commerceTransactions.state, ["pending", "active", "grace"])))
    .get();
  if (active !== undefined) {
    throw new HttpError(409, "This account already has this non-repeatable purchase", "purchaseConflict");
  }
}

export async function readCheckout(d1: D1Database, provider: string, accountId: string, operationId: string, offerKey: string, returnUrl: string): Promise<CommerceCheckout | null> {
  const row = await orm(d1)
    .select()
    .from(commerceCheckoutOperations)
    .where(and(eq(commerceCheckoutOperations.provider, provider), eq(commerceCheckoutOperations.userId, accountId), eq(commerceCheckoutOperations.operationId, operationId)))
    .get();
  if (row === undefined) return null;
  if (row.fingerprint !== fingerprint(offerKey, returnUrl)) {
    throw new HttpError(409, "operationId was already used for a different checkout", "purchaseConflict");
  }
  return { url: row.checkoutUrl, expiresAt: row.expiresAt };
}

export async function readOpenCheckout(d1: D1Database, provider: string, accountId: string, offerKey: string, now: number): Promise<CommerceCheckout | null> {
  const row = await orm(d1)
    .select()
    .from(commerceCheckoutOperations)
    .where(and(eq(commerceCheckoutOperations.provider, provider), eq(commerceCheckoutOperations.userId, accountId), eq(commerceCheckoutOperations.offerKey, offerKey), gt(commerceCheckoutOperations.expiresAt, now)))
    .get();
  return row === undefined ? null : { url: row.checkoutUrl, expiresAt: row.expiresAt };
}

export async function recordCheckout(
  d1: D1Database,
  input: {
    provider: string;
    accountId: string;
    operationId: string;
    offerKey: string;
    returnUrl: string;
    result: CommerceCheckout;
    now: number;
  },
): Promise<CommerceCheckout> {
  const expiresAt = input.result.expiresAt ?? input.now + 30 * 60 * 1000;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= input.now) {
    throw new HttpError(502, "The provider returned an invalid checkout expiry");
  }
  try {
    await orm(d1)
      .insert(commerceCheckoutOperations)
      .values({
        id: crypto.randomUUID(),
        provider: input.provider,
        userId: input.accountId,
        operationId: input.operationId,
        offerKey: input.offerKey,
        fingerprint: fingerprint(input.offerKey, input.returnUrl),
        checkoutUrl: input.result.url,
        expiresAt,
        createdAt: input.now,
      });
    return { url: input.result.url, expiresAt };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await readCheckout(d1, input.provider, input.accountId, input.operationId, input.offerKey, input.returnUrl);
    if (raced === null) throw error;
    return raced;
  }
}
