/**
 * The pagination cursor: an opaque token naming a position in a sorted list.
 *
 * Opaque is the whole design, and it is a correction of an earlier one. The
 * cursor used to be the raw sort value, a bare epoch-millisecond integer that a
 * client read off the last row it held and sent back. Three things were wrong
 * with that, and they are worth naming because each is invisible until it bites:
 *
 * 1. **Its invalid value was a valid value.** A parameter that failed to arrive
 *    coerced to `0`, and `0` is a perfectly good timestamp cursor meaning
 *    "strictly older than the beginning of time". So a malformed request came
 *    back `200 []` instead of `400`, and every paged list in the product went
 *    blank at once without a single error being logged. A token that has to
 *    decode cannot do that: there is no byte string that accidentally means the
 *    beginning of time.
 *
 * 2. **A timestamp alone does not identify a row.** Two games created in the
 *    same millisecond share a sort value, so a page boundary landing between
 *    them dropped one permanently: it was neither `< cursor` nor on the page
 *    just served. Carrying the row id alongside the sort value makes the
 *    ordering total, so a boundary can always be placed exactly.
 *
 * 3. **It made the client restate the server's ORDER BY.** To ask for the next
 *    page, a client had to know that finished games sort by `finishedAt` and
 *    fall back to `updatedAt` while active ones sort by `updatedAt`. That is
 *    server knowledge, and every screen that paged had a copy of it. Now the
 *    server hands back `nextCursor` and the client passes it through without
 *    ever looking inside.
 *
 * The encoding is deliberately not a security boundary. It is base64url'd JSON,
 * trivially readable, and a caller who decodes one and forges another gets
 * exactly the ability they already have: to ask for a page starting at a
 * position of their choosing, over data the query's own WHERE clause already
 * restricts to what they may see. Signing it would buy nothing and would make
 * cursors non-portable across key rotations.
 */

import { HttpError } from "./http.js";

/** A position in a sorted list: the sort value, and the row id that breaks
 * ties on it. Together these are total, which is what makes a page boundary
 * exact. */
export interface Cursor {
  /** The sort value of the last row on the page just served, in epoch ms. */
  t: number;
  /** That row's id. */
  id: string;
}

/** Encoded as a two-element array rather than an object: the field names would
 * be a third of the token and carry no information a reader of this file lacks. */
type Encoded = [number, string];

/** base64url via the runtime's own codec rather than `btoa` plus a hand-rolled
 * alphabet swap and padding calculation.
 *
 * `Uint8Array.toBase64`/`fromBase64` (TC39 "Uint8Array to/from base64", shipped
 * in workerd) take the alphabet and the padding as options, which is the entire
 * fiddly part of doing this by hand: the encoder has to translate `+/` to `-_`
 * and strip `=`, and the decoder has to put exactly the right number of `=`
 * back before `atob` will accept the length. Getting that padding arithmetic
 * subtly wrong fails only for certain input lengths, which is the kind of bug
 * that survives a test suite. */
const utf8 = { encode: new TextEncoder(), decode: new TextDecoder() };

function base64UrlEncode(text: string): string {
  return utf8.encode.encode(text).toBase64({ alphabet: "base64url", omitPadding: true });
}

function base64UrlDecode(token: string): string {
  return utf8.decode.decode(Uint8Array.fromBase64(token, { alphabet: "base64url" }));
}

export function encodeCursor(cursor: Cursor): string {
  return base64UrlEncode(JSON.stringify([cursor.t, cursor.id] satisfies Encoded));
}

/**
 * Decode a cursor a client sent back, or reject the request.
 *
 * Every failure is the same 400: a cursor is not something a client composes,
 * it is something it echoes, so the only ways to arrive here with a bad one are
 * a truncated URL or a hand-edited request. Neither is worth distinguishing to
 * the caller, and both are worth refusing loudly rather than silently serving
 * page one or nothing.
 */
export function decodeCursor(token: string): Cursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(token));
  } catch {
    throw new HttpError(400, "Malformed pagination cursor", "invalidCursor");
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) throw new HttpError(400, "Malformed pagination cursor", "invalidCursor");
  const [t, id] = parsed as [unknown, unknown];
  if (typeof t !== "number" || !Number.isInteger(t) || typeof id !== "string" || id.length === 0) throw new HttpError(400, "Malformed pagination cursor", "invalidCursor");
  return { t, id };
}

/** Decode an optional cursor: absent stays absent, present must be valid. */
export function decodeOptionalCursor(token: string | undefined): Cursor | null {
  return token === undefined ? null : decodeCursor(token);
}

/** One page of a keyset-paginated list.
 *
 * `nextCursor` is an answer, not a hint: it is null exactly when the server
 * knows there is nothing after this page. That is why the reads fetch one row
 * more than the caller asked for and discard it. The obvious alternative,
 * letting the client stop when a page comes back short, is a guess that is
 * wrong whenever the last page happens to be exactly full. */
export interface Page<T> {
  rows: T[];
  nextCursor: string | null;
}
