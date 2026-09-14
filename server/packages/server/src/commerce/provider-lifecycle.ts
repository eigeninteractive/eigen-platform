import { HttpError } from "../http.js";
import { markTransactionAcknowledged } from "./ledger.js";
import type { CommerceProvider, CommerceTransactionReference } from "./types.js";

/** Complete a provider's post-ledger step only after access is durably stored. */
export async function acknowledgeIfNeeded(
  d1: D1Database,
  adapter: CommerceProvider<unknown>,
  env: unknown,
  transaction: CommerceTransactionReference,
  now: () => number,
): Promise<void> {
  if (!transaction.acknowledgementPending) return;
  if (adapter.acknowledge === undefined) {
    throw new HttpError(502, `${adapter.key} requires acknowledgement but its adapter cannot acknowledge`);
  }
  await adapter.acknowledge(env, transaction);
  await markTransactionAcknowledged(d1, adapter.key, transaction.providerTransactionId, now());
}
