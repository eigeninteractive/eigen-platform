/**
 * The canonical form of a mutation's intent, shared by every authority that
 * stores a receipt for one.
 *
 * Two authorities hold receipts, for the same reason in the same shape. A
 * game's Durable Object holds one for every command it commits. D1 holds one
 * for a create, which has no object yet to hold anything. Both answer the same
 * question — has THIS principal already committed THIS command id, and did they
 * mean the same thing by it — so both must agree on what "the same request"
 * means. That agreement is this module: the document shape is defined once here
 * and every authority builds it through {@link canonicalRequest}.
 *
 * The canonical string is stored and compared verbatim rather than hashed. A
 * digest would save bytes next to rows that already carry a session snapshot or
 * a game's whole configuration, and it would cost an `await
 * crypto.subtle.digest` inside a read-then-write critical section. An exact
 * string comparison is synchronous, has no collision case to reason about, and
 * says what it means.
 *
 * Canonicalization is RFC 8785 (JCS) via that RFC's own reference JavaScript
 * implementation, so key order, number formatting and Unicode escaping are the
 * spec's problem and not ours. It also throws on NaN and Infinity, which is the
 * I-JSON validation we would otherwise hand-roll.
 */

import canonicalize from "canonicalize";

/** Bumped only if the document shape below changes. An old receipt then reads
 * as a different intent, which is the safe direction: a conflict, never a
 * wrongly replayed result. */
export const REQUEST_VERSION = 1;

/** A request whose payload is outside the JSON data model RFC 8785 accepts. */
export class CommandIdentityError extends TypeError {}

/** The principal scope of a user's receipts. Two principals may independently
 * choose the same command id, so every lookup is scoped by this. */
export function userPrincipal(userId: string): string {
  return `user:${userId}`;
}

/** The principal scope of a bot's receipts; see {@link userPrincipal}. */
export function botPrincipal(botId: string): string {
  return `bot:${botId}`;
}

export interface RequestDocument {
  /** From {@link userPrincipal} or {@link botPrincipal}. */
  principal: string;
  /** A stable operation name. Reusing one command id across two operations must
   * read as a conflict, so these names are part of the contract and may not be
   * derived from a changeable enum. */
  operation: string;
  /** What the authority that stores this receipt is authoritative FOR: a game's
   * own id inside its Durable Object, the collection name for a create in D1.
   * Never the id a caller asked for, so a receipt can never name a resource its
   * own authority does not own, whatever routing did. */
  resource: string;
  /** Only what the caller chose. Host-generated values (arrival time, minted
   * ids, RNG seeds, request metadata) are excluded, or an honest retry would
   * never match. */
  payload: unknown;
}

/** The canonical RFC 8785 JSON a receipt is compared by. */
export function canonicalRequest(document: RequestDocument): string {
  let request: string | undefined;
  try {
    request = canonicalize({ version: REQUEST_VERSION, ...document });
  } catch (error) {
    throw new CommandIdentityError(`request payload is not canonicalizable JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (request === undefined) throw new CommandIdentityError("request payload canonicalized to nothing");
  return request;
}
