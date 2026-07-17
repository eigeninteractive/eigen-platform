/**
 * The engine's JSON vocabulary. Every game payload (`state`, `config`, an
 * action's `data`, observation slices) is plain JSON — it crosses process,
 * storage, and wire boundaries verbatim, so nothing richer is representable.
 */

/** Any JSON value. `undefined` is allowed inside objects (treated as an
 * absent key, matching how schema libraries model optional fields); it never
 * survives serialization. */
export type Json = string | number | boolean | null | JsonArray | JsonObject;

/** A JSON array. An `interface` (not an inline `Json[]`) so the recursion is
 * through a named type TypeScript resolves lazily — inline recursion blows
 * the instantiation depth (TS2589) when workerd's RPC types map over it. */
export interface JsonArray extends Array<Json> {}

/** A JSON object — the shape of `state`, `config`, `data`, and observation
 * slices, and the constraint every game payload type must satisfy. An
 * `interface` for the same lazy-resolution reason as {@link JsonArray}.
 * Declare *game payload* types as `type` aliases (e.g. via your schema
 * library's inference), not `interface`s — a payload `interface` lacks the
 * implicit index signature this constraint relies on. */
export interface JsonObject {
  [key: string]: Json | undefined;
}
