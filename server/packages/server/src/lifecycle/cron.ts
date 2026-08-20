/**
 * The cron backstop: the worker's `scheduled` handler.
 *
 * Deliberately NOT a timeout sweep. A game's DO deadline alarm is its timer,
 * durable, per-game and platform-retried, so turn timeouts never need scanning
 * for. This handler does only what has no per-entity timer of its own:
 *
 *   1. **Stale-guest purge**: old, inactive anonymous accounts, torn down
 *      through the same {@link purgeUser} path the delete-account route uses.
 *   2. **Abandoned-game reap**: never-started lobbies, and untimed active games
 *      (which have no alarm at all) idle too long, aborted so they stop
 *      occupying the lobby and release their DO storage.
 *   3. **Read-model reconciliation**: games D1 still believes are live but has
 *      stopped hearing from, repaired from the authoritative Durable Object.
 *
 * The windows and per-run batch caps are {@link LIFECYCLE_DEFAULTS}, each
 * overridable via the `lifecycle` block on `createEngine` ({@link LifecycleOptions}).
 * Everything is best-effort and single-attempt: each unit is isolated so
 * one failure never blocks the batch, and anything skipped is retried next run.
 */

import { and, eq, gte, inArray, isNull, lt, notExists, or, sql } from "drizzle-orm";
import { orm } from "../d1/orm.js";
import { games, participants, users } from "../d1/schema.js";
import { type EngineOps, purgeUser } from "./purge.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The knobs on the cron backstop, every one optional, so an implementor
 * overrides only what they mean to and inherits {@link LIFECYCLE_DEFAULTS} for
 * the rest. Surfaced as `lifecycle` on `createEngine`. Times are milliseconds. */
export interface LifecycleOptions {
  /** A guest is a purge candidate once its account is at least this old… */
  guestMaxAgeMs?: number;
  /** …AND it has had no game activity within this window. Short enough that a
   * purge is never a painful surprise. */
  guestInactivityMs?: number;
  /** A lobby nobody started within this window is abandoned and reaped. */
  lobbyTtlMs?: number;
  /** An untimed active game idle for this long is abandoned. Long, because
   * untimed games are legitimately slow (correspondence-style) and have no
   * deadline alarm to lean on, so this is the only backstop that ever ends one. */
  untimedActiveTtlMs?: number;
  /** Max guests purged per run. A daily sweep, so a bounded batch drains a
   * backlog over a few days rather than doing unbounded work in one run. */
  guestBatch?: number;
  /** Max games reaped per run (same bounded-batch reasoning). */
  reapBatch?: number;
  /** How far past its committed turn deadline an active game may sit before D1's
   * copy is treated as diverged. A timed game's alarm fires within its deadline
   * plus the engine's grace, and that fire writes to D1, so silence well past it
   * means either the alarm or the mirror write was lost. Generous enough that a
   * slow platform retry is never mistaken for divergence. */
  deadlineGraceMs?: number;
  /** How long a non-terminal game may go without any D1 update before it is
   * reconciled. This is the only signal that finds a *finish* whose D1 apply
   * failed on an untimed game, which has no deadline to be late for — its row
   * simply stops changing. Must stay below `untimedActiveTtlMs`, or the reap
   * aborts such a game before this ever gets to repair it. */
  mirrorStaleMs?: number;
  /** Max games reconciled per run. Each one wakes a Durable Object, so this is
   * the tightest batch: a backlog is drained over several days rather than
   * turning a daily sweep into a fan-out. */
  reconcileBatch?: number;
}

/** The defaults (old: 7-day guest age, 2-day inactivity). An implementor's
 * `lifecycle` block overlays these field by field. */
export const LIFECYCLE_DEFAULTS: Required<LifecycleOptions> = {
  guestMaxAgeMs: 7 * DAY_MS,
  guestInactivityMs: 2 * DAY_MS,
  lobbyTtlMs: 7 * DAY_MS,
  untimedActiveTtlMs: 30 * DAY_MS,
  guestBatch: 200,
  reapBatch: 500,
  deadlineGraceMs: 6 * 60 * 60 * 1000,
  mirrorStaleMs: 7 * DAY_MS,
  reconcileBatch: 100,
};

export async function runScheduled(ops: EngineOps, options: LifecycleOptions = {}): Promise<void> {
  const opts: Required<LifecycleOptions> = { ...LIFECYCLE_DEFAULTS, ...definedOnly(options) };
  const now = Date.now();
  // Isolate the two jobs: a failure in one must not skip the other.
  await purgeStaleGuests(ops, now, opts).catch((error) => console.error("cron: stale-guest purge failed", error));
  await reapAbandonedGames(ops, now, opts).catch((error) => console.error("cron: abandoned-game reap failed", error));
  await reconcileDivergedGames(ops, now, opts).catch((error) => console.error("cron: read-model reconciliation failed", error));
}

/** Drop `undefined` values so an override object never masks a default with a
 * hole (spreading `{ guestBatch: undefined }` would otherwise erase it). */
function definedOnly(options: LifecycleOptions): Partial<LifecycleOptions> {
  return Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
}

async function purgeStaleGuests(ops: EngineOps, now: number, opts: Required<LifecycleOptions>): Promise<void> {
  const db = orm(ops.d1);
  const activityCutoff = now - opts.guestInactivityMs;
  // Correlated: keep any guest with a game touched since the activity cutoff.
  const recentActivity = db
    .select({ one: sql`1` })
    .from(participants)
    .innerJoin(games, eq(participants.gameId, games.id))
    .where(and(eq(participants.userId, users.id), gte(games.updatedAt, activityCutoff)));
  const stale = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isAnonymous, true), lt(users.createdAt, now - opts.guestMaxAgeMs), notExists(recentActivity)))
    .limit(opts.guestBatch)
    .all();

  for (const { id } of stale) {
    // Single attempt: a failed Firebase delete leaves the guest fully
    // intact (purgeUser throws before the D1 purge) to retry next run.
    await purgeUser(ops, id).catch((error) => console.error(`cron: purging stale guest ${id} failed`, error));
  }
  if (stale.length > 0) console.log(`cron: purged ${stale.length} stale guest(s)`);
}

async function reapAbandonedGames(ops: EngineOps, now: number, opts: Required<LifecycleOptions>): Promise<void> {
  const db = orm(ops.d1);
  const abandoned = await db
    .select({ id: games.id })
    .from(games)
    .where(or(and(inArray(games.status, ["waiting", "ready"]), lt(games.createdAt, now - opts.lobbyTtlMs)), and(eq(games.status, "active"), isNull(games.turnSeconds), isNull(games.budgetSeconds), lt(games.updatedAt, now - opts.untimedActiveTtlMs))))
    .limit(opts.reapBatch)
    .all();

  for (const { id } of abandoned) {
    // abort() marks the D1 row aborted and compacts game data. It is idempotent,
    // so a partial run is safe to repeat.
    await ops
      .stub(id)
      .abort(id)
      .catch((error) => console.error(`cron: reaping abandoned game ${id} failed`, error));
  }
  if (abandoned.length > 0) console.log(`cron: reaped ${abandoned.length} abandoned game(s)`);
}

/**
 * Repair games whose D1 read model has fallen behind the Durable Object.
 *
 * Two different defects present identically from D1's side, which is why one
 * sweep covers both. A post-commit mirror write can be lost: `#mirrorD1` retries
 * transient failures and then gives up, because a commit whose truth is already
 * durable must never fail on a read model. And a finish's D1 apply can fail, in
 * which case the DO keeps its outbox row and waits to be asked again — otherwise
 * the game's rating deltas are lost permanently, which is the worst outcome here
 * and the reason this job exists at all.
 *
 * D1 cannot tell which happened, or even that anything did: it holds a plausible
 * row that has simply stopped changing. So the candidates are the two ways a
 * live game can be provably quiet, and the DO decides what was actually wrong:
 *
 * 1. an active game well past its committed turn deadline — its alarm should have
 *    fired and written by now; and
 * 2. any non-terminal game with no D1 update for `mirrorStaleMs` — the only
 *    signal available for an untimed game, which has no deadline to be late for.
 *
 * Oldest first, so a backlog drains in a stable order rather than starving the
 * longest-diverged rows. `reconcile` is idempotent, so a healthy game caught by a
 * coarse predicate costs one wake and changes nothing.
 */
async function reconcileDivergedGames(ops: EngineOps, now: number, opts: Required<LifecycleOptions>): Promise<void> {
  const db = orm(ops.d1);
  const live = ["waiting", "ready", "active"] as const;
  const diverged = await db
    .select({ id: games.id })
    .from(games)
    .where(and(inArray(games.status, [...live]), or(and(eq(games.status, "active"), lt(games.turnDeadline, now - opts.deadlineGraceMs)), lt(games.updatedAt, now - opts.mirrorStaleMs))))
    .orderBy(games.updatedAt)
    .limit(opts.reconcileBatch)
    .all();

  let repaired = 0;
  for (const { id } of diverged) {
    // Isolated per game: one unreachable object must not skip the rest, and
    // anything skipped is a candidate again next run.
    const report = await ops
      .stub(id)
      .reconcile(id)
      .catch((error) => {
        console.error(`cron: reconciling game ${id} failed`, error);
        return null;
      });
    // Count only the repairs that recovered something a player would notice. A
    // rewritten mirror is unconditional and says nothing about whether it was
    // wrong, so it is deliberately not counted.
    if (report !== null && (report.finishRepoked || report.alarmRearmed)) repaired++;
  }
  if (diverged.length > 0) console.log(`cron: reconciled ${diverged.length} diverged game(s), recovered ${repaired}`);
}
