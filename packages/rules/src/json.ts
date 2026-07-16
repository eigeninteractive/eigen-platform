/**
 * The engine's JSON vocabulary. Every game payload (`state`, `config`, an
 * action's `data`, observation slices) is plain JSON — it crosses process,
 * storage, and wire boundaries verbatim, so nothing richer is representable.
 */

/** Any JSON value. `undefined` is allowed inside objects (treated as an
 * absent key, matching how schema libraries model optional fields); it never
 * survives serialization. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

/** A JSON object — the shape of `state`, `config`, `data`, and observation
 * slices, and the constraint every game payload type must satisfy. Declare
 * payload types as `type` aliases (e.g. via your schema library's inference),
 * not `interface`s — an `interface` lacks the implicit index signature this
 * constraint relies on. */
export type JsonObject = { [key: string]: Json | undefined };
