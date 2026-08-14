/**
 * D1 / SQLite failure classification.
 *
 * Neither D1 nor drizzle exposes a structured error code (its "error
 * constants" are themselves just message prefixes) so every predicate here
 * matches on message text. The important part is that they all match down the
 * `cause` chain rather than the top-level message alone, because how deep the
 * real text sits depends on how the statement was issued:
 *
 *   - `db.batch([...])` surfaces the D1 error directly:
 *       Error: D1_ERROR: UNIQUE constraint failed: games.short_code ...
 *         └─ Error: UNIQUE constraint failed: games.short_code ...
 *
 *   - the query builder (`.insert()`, `.update()`) rewraps it in drizzle's own
 *     message, which does NOT carry the constraint text:
 *       Error: Failed query: insert into "rating_history" ...
 *         └─ Error: D1_ERROR: UNIQUE constraint failed: rating_history.user_id ...
 *              └─ Error: UNIQUE constraint failed: rating_history.user_id ...
 *
 * A caller therefore may never assume a depth: a flat `error.message` test
 * happens to work for the first shape and silently fails for the second,
 * turning a retryable conflict into a fatal error and disabling the retry loop
 * it guards. Walking the chain is correct for both, so it is the only form
 * used here.
 *
 * Physical column names (`short_code`), not the camelCase Drizzle property,
 * appear in these messages, so the patterns live beside the schema that
 * defines them.
 */

/** The chains above are 2–3 deep; 5 is slack without an unbounded walk (a
 * self-referential `cause` would otherwise spin forever). */
const MAX_CAUSE_DEPTH = 5;

/** True when any message down the `cause` chain matches any of `patterns`.
 * Patterns must not be `g`-flagged, since `test()` is stateful with `g`. */
export function matchesCause(error: unknown, ...patterns: RegExp[]): boolean {
  for (let e: unknown = error, depth = 0; e instanceof Error && depth < MAX_CAUSE_DEPTH; e = e.cause, depth++) {
    if (patterns.some((re) => re.test(e.message))) return true;
  }
  return false;
}

/** A SQLite UNIQUE-index rejection, on any column. */
export function isUniqueViolation(error: unknown): boolean {
  return matchesCause(error, /UNIQUE constraint failed/i);
}

/** A UNIQUE rejection specifically on `games.short_code`: the signal the
 * create loop retries on. Narrowed to the column so a genuine clash on any
 * other UNIQUE index (which retrying could never fix) still surfaces.
 *
 * The qualified `games.short_code` must appear in the constraint list that
 * follows `failed:`, not merely somewhere in the message. Some D1 messages
 * embed the offending SQL (`D1_EXEC_ERROR: ... sql error: ...`), and that SQL
 * names `short_code` as a column, so a loose `.*short_code` would read a
 * UNIQUE violation on a *different* games column as a code collision and burn
 * the whole retry budget before surfacing it. `[^:]*` cannot cross the colon
 * that terminates the constraint list, which is what keeps the two apart. */
export function isShortCodeCollision(error: unknown): boolean {
  return matchesCause(error, /UNIQUE constraint failed: [^:]*\bgames\.short_code\b/i);
}

/** A UNIQUE rejection on `idx_games_create_key`: this creator has already made a
 * game under this command id, so the caller is retrying rather than creating. Not
 * an error — the create route answers it by returning that game. Narrowed to the
 * column for the same reason as {@link isShortCodeCollision}. */
export function isCreateReplay(error: unknown): boolean {
  return matchesCause(error, /UNIQUE constraint failed: [^:]*\bgames\.create_command_id\b/i);
}
