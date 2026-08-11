/**
 * Read a Worker's LOCAL `.wrangler` state directly: the D1 index and the
 * per-game Durable Object databases, opened as plain SQLite files.
 *
 * This is a development and debugging surface, never a runtime one. Nothing here
 * runs on Workers: it is Node reading files that `wrangler dev` left on disk,
 * which is why it lives in the testkit (a `devDependency`) behind its own
 * subpath, and why it reads them through Node's built-in `node:sqlite` rather
 * than a driver package. `better-sqlite3` would work and was tried first, but
 * `drizzle-orm` declares it as an OPTIONAL PEER: installing it anywhere in the
 * workspace re-resolves drizzle's peer set for every importer, which changed the
 * types `packages/server` compiles against and broke its `dts` build. A
 * debugging tool is not worth perturbing the engine's own dependency graph, and
 * the built-in module costs nothing: no native build, no `allowBuilds` opt-in,
 * and no dependency at all.
 *
 * Two stores, two different questions, and the reason a game-shaped reader
 * exists at all:
 *
 * - **D1 is the index.** Discovery, history, ratings, identity. Its `games` row
 *   is a display read-model written by the DO as a fire-and-forget mirror.
 * - **The game's DO is the session.** One SQLite database per game, holding the
 *   authoritative status, roster and the append-only transition log.
 *
 * A question like "why is this game not starting" therefore cannot be answered
 * from either store alone, and answering it from a generic table browser means
 * knowing which of the two to distrust. {@link LocalStore.game} joins them and
 * reports the disagreement as a value, so a stale mirror reads as a stale
 * mirror rather than as a mystery.
 *
 * Every open is read-only, so this is safe to run against a live `wrangler dev`.
 *
 * @module @eigeninteractive/testkit/local-state
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Where `wrangler dev` persists local resources, relative to a Worker root. */
const STATE_SUFFIX = join(".wrangler", "state", "v3");

/** Miniflare's own bookkeeping database, present in every resource directory
 * alongside the real ones. It holds `_cf_ALARM`, not user data. */
const METADATA_FILE = "metadata.sqlite";

/** The table Miniflare writes into every Durable Object database, holding the
 * `idFromName` name the object was addressed by. It is what makes the hashed
 * filename reversible: the engine names a game's DO by its `gameId`, and the
 * hash is one-way, so this row is the only local file-to-game map there is. */
const DO_NAME_TABLE = "__miniflare_do_name";

/** A local Durable Object database: one game's whole session. */
export interface LocalDurableObject {
  /** The Durable Object class, parsed from the directory Miniflare names
   * `<worker>-<ClassName>`. */
  className: string;
  /** The hex `DurableObjectId`, which is the filename: `idFromName(name)`
   * hashed. Not the game id, and not reversible without {@link name}. */
  id: string;
  /** The name the object was addressed by, which for a game DO is its
   * `gameId`. Null only if the object was created by unique id rather than by
   * name, which the engine never does. */
  name: string | null;
  /** Absolute path to the SQLite file. */
  file: string;
}

/** What a bound parameter may be: SQLite's own value domain, spelled out here
 * rather than re-exported from `node:sqlite` so the public signature does not
 * depend on a built-in module's type names. */
export type LocalQueryParam = string | number | bigint | null | Uint8Array;

/** A row of Miniflare's alarm table: the DO's armed alarm, which for a game is
 * its turn deadline plus grace. An absent row means no timer is armed, which is
 * correct for an untimed game and a bug for a timed one mid-turn. */
export interface LocalAlarm {
  actorId: string;
  actorName: string | null;
  scheduledTime: number | null;
}

/** The engine's `games` row: the D1 index entry, a display mirror of the DO. */
export interface LocalGameRow {
  id: string;
  createdBy: string | null;
  status: string;
  access: string;
  schemaVersion: number;
  config: unknown;
  turnSeconds: number | null;
  budgetSeconds: number | null;
  incrementSeconds: number | null;
  rated: boolean;
  ratingPool: string | null;
  minPlayers: number;
  maxPlayers: number;
  shortCode: string;
  pendingPlayers: number[] | null;
  turnDeadline: number | null;
  outcomes: unknown;
  finishId: string | null;
  finishedAt: number | null;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** One seat, from either store. `username` is filled in from D1's `users` and
 * `bots` tables when the reader has an index to join against. */
export interface LocalSeat {
  playerIndex: number;
  userId: string | null;
  botId: string | null;
  type: string;
  username: string | null;
  displayName: string | null;
}

/** The DO's single `meta` row: the authoritative session header. */
export interface LocalGameMeta {
  gameId: string;
  status: string;
  access: string;
  schemaVersion: number;
  config: unknown;
  turnSeconds: number | null;
  budgetSeconds: number | null;
  incrementSeconds: number | null;
  rated: boolean;
  ratingPool: string | null;
  minPlayers: number;
  maxPlayers: number;
  createdBy: string | null;
  rngSeed: string | null;
}

/** One committed transition, decoded. `action` is null at v0 (the start). */
export interface LocalTransition {
  version: number;
  state: unknown;
  action: { type: string; kind: string; playerIndex: number | null; data: unknown } | null;
  pending: number[];
  deadline: number | null;
  playerTimes: number[] | null;
  turnStartedAt: number | null;
  /** Which seats hold a stored frame at this version. Empty after the finish
   * compaction, which empties `frames` and leaves replay to re-projection. */
  frameSeats: number[];
}

/** Why the game is where it is, and what would move it. Derived rather than
 * stored: this is the sentence a developer actually wants, and every input to
 * it is already on screen above it. */
export interface LocalGameDiagnosis {
  /** One line naming the next expected event, or the reason there is none. */
  summary: string;
  /** Disagreements between the D1 mirror and the DO's own truth. A non-empty
   * list means a mirror write was lost, since the DO is authoritative. */
  mirrorDrift: string[];
}

/** Everything both stores know about one game. */
export interface LocalGameView {
  gameId: string;
  /** The D1 index row, or null when D1 has no such game: either the id came
   * from a DO name and the index was wiped, or the create write never landed. */
  index: LocalGameRow | null;
  /** D1's `participants`, which mirror the DO's roster for display. */
  indexSeats: LocalSeat[];
  /** The DO file, or null when no Durable Object exists for this game yet.
   * That is the normal state of a created-but-never-touched lobby: the DO is
   * created lazily by the first command or socket. */
  durableObject: LocalDurableObject | null;
  meta: LocalGameMeta | null;
  roster: LocalSeat[];
  transitions: LocalTransition[];
  /** Recorded `commandId` dedupe entries, newest first. */
  commands: { commandId: string; createdAt: number; result: unknown }[];
  /** Unapplied finish rows: a surviving row means the D1 finish apply has not
   * succeeded and the admin re-poke is the recovery. */
  outbox: { finishId: string; createdAt: number; outcomes: unknown }[];
  alarm: LocalAlarm | null;
  diagnosis: LocalGameDiagnosis;
}

/**
 * Walk up from `from` to the nearest directory holding `.wrangler/state/v3`.
 *
 * Walking rather than requiring the Worker root means this works from anywhere
 * inside a game repository, including the app half of a two-package layout,
 * where the state lives a directory or two above the shell's cwd.
 */
export function findWranglerState(from: string = process.cwd()): string | null {
  let dir = resolve(from);
  for (;;) {
    const candidate = join(dir, STATE_SUFFIX);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Open a SQLite file for reading only.
 *
 * Read-only is what makes this safe to point at a running `wrangler dev`: no
 * writer lock is taken and no journal is touched. The fallback matters because
 * these databases are in WAL mode, and a read-only connection cannot recover a
 * hot journal or create the `-shm` file it needs; when `wrangler dev` is not
 * running and left one behind, the first open fails and a writable handle is
 * the only way in. Nothing here issues anything but `SELECT`, so the widened
 * handle stays as harmless as the narrow one. The existence check comes first
 * because that fallback would otherwise CREATE a database rather than report a
 * missing one.
 */
export function openSqlite(file: string): DatabaseSync {
  if (!existsSync(file)) throw new Error(`no SQLite database at ${file}`);
  try {
    return new DatabaseSync(file, { readOnly: true });
  } catch {
    return new DatabaseSync(file);
  }
}

function sqliteFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => entry.endsWith(".sqlite") && entry !== METADATA_FILE)
    .map((entry) => join(dir, entry));
}

function tableExists(db: DatabaseSync, table: string): boolean {
  const row = db.prepare("select 1 from sqlite_master where type = 'table' and name = ?").get(table);
  return row !== undefined;
}

/** Parse a JSON text column, tolerating a value some other writer left
 * un-encoded. A debugging reader that throws on one malformed cell is useless
 * precisely when it is needed. */
function json(value: unknown): unknown {
  if (typeof value !== "string") return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function numbers(value: unknown): number[] {
  const parsed = json(value);
  return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
}

function bool(value: unknown): boolean {
  return value === 1 || value === true;
}

/**
 * A Worker's local state, with its databases opened lazily and held open.
 *
 * Stateful because it owns file handles: construct one, ask it questions, and
 * {@link close} it. A single instance is the unit both the CLI and a test use,
 * so neither has to know which file backs which resource.
 */
export class LocalStore {
  /** Absolute path to `.wrangler/state/v3`. */
  readonly root: string;

  #d1: { file: string; db: DatabaseSync } | null | undefined;
  readonly #open = new Map<string, DatabaseSync>();

  private constructor(root: string) {
    this.root = root;
  }

  /**
   * Locate and open the state under `from`, or throw with the one thing the
   * caller can act on: that no Worker has been run here yet.
   */
  static open(from?: string): LocalStore {
    const root = findWranglerState(from);
    if (root === null) {
      throw new Error(`no .wrangler/state/v3 found at or above ${resolve(from ?? process.cwd())}. Run the Worker once (\`pnpm dev\`) so it has local state to read.`);
    }
    return new LocalStore(root);
  }

  #handle(file: string): DatabaseSync {
    const existing = this.#open.get(file);
    if (existing !== undefined) return existing;
    const db = openSqlite(file);
    this.#open.set(file, db);
    return db;
  }

  /**
   * The engine's D1 database, identified by its schema rather than its name.
   *
   * Miniflare names the file after a hash of the database, so there is no
   * mapping back to the binding. Recognising the engine's own `games` table
   * instead is both simpler and more honest about what the caller wants: the
   * database that has games in it, whatever the binding was called.
   */
  d1(): { file: string; db: DatabaseSync } | null {
    if (this.#d1 !== undefined) return this.#d1;
    for (const file of sqliteFilesIn(join(this.root, "d1", "miniflare-D1DatabaseObject"))) {
      const db = this.#handle(file);
      if (tableExists(db, "games")) {
        this.#d1 = { file, db };
        return this.#d1;
      }
    }
    this.#d1 = null;
    return null;
  }

  /**
   * Every local Durable Object database, newest-modified first.
   *
   * The directory is `<worker>-<ClassName>`, and a worker name may itself
   * contain a dash, so the class is everything after the LAST one. Ordering by
   * mtime puts the game you just touched at the top, which is nearly always the
   * one being debugged.
   */
  durableObjects(): LocalDurableObject[] {
    const base = join(this.root, "do");
    if (!existsSync(base)) return [];
    const found: LocalDurableObject[] = [];
    for (const namespace of readdirSync(base)) {
      const dir = join(base, namespace);
      if (!statSync(dir).isDirectory()) continue;
      const className = namespace.slice(namespace.lastIndexOf("-") + 1);
      for (const file of sqliteFilesIn(dir)) {
        const db = this.#handle(file);
        const name = tableExists(db, DO_NAME_TABLE) ? ((db.prepare(`select name from ${DO_NAME_TABLE} limit 1`).get() as { name?: string } | undefined)?.name ?? null) : null;
        found.push({ className, id: file.slice(file.lastIndexOf("/") + 1, -".sqlite".length), name, file });
      }
    }
    return found.sort((a, b) => statSync(b.file).mtimeMs - statSync(a.file).mtimeMs);
  }

  /** The armed alarm for a Durable Object, from its namespace's metadata
   * database. Matched on either column because the id is what Miniflare keys
   * by and the name is what a human recognises. */
  alarm(target: LocalDurableObject): LocalAlarm | null {
    const file = join(dirname(target.file), METADATA_FILE);
    if (!existsSync(file)) return null;
    const db = this.#handle(file);
    if (!tableExists(db, "_cf_ALARM")) return null;
    const row = db.prepare("select actor_id, actor_name, scheduled_time from _cf_ALARM where actor_id = ? or actor_name = ?").get(target.id, target.name ?? target.id) as { actor_id: string; actor_name: string | null; scheduled_time: number | null } | undefined;
    return row === undefined ? null : { actorId: row.actor_id, actorName: row.actor_name, scheduledTime: row.scheduled_time };
  }

  /** The D1 index rows, newest-updated first. */
  games(options: { status?: string; limit?: number } = {}): LocalGameRow[] {
    const d1 = this.d1();
    if (d1 === null) return [];
    const where = options.status === undefined ? "" : "where status = ?";
    const params = options.status === undefined ? [] : [options.status];
    const rows = d1.db.prepare(`select * from games ${where} order by updated_at desc limit ?`).all(...params, options.limit ?? 50) as Record<string, unknown>[];
    return rows.map(toGameRow);
  }

  /**
   * Resolve a game reference the way a developer will type it: a full id, a
   * six-character short code, or an id prefix long enough to be unique.
   *
   * D1 is tried first because it can match a short code, then the DO names, so
   * a game whose index row was wiped is still reachable by id.
   */
  resolveGameId(ref: string): string | null {
    const d1 = this.d1();
    if (d1 !== null) {
      const exact = d1.db.prepare("select id from games where id = ? or short_code = ?").get(ref, ref.toUpperCase()) as { id: string } | undefined;
      if (exact !== undefined) return exact.id;
      const prefixed = d1.db.prepare("select id from games where id like ? limit 2").all(`${ref}%`) as { id: string }[];
      if (prefixed.length === 1) return prefixed[0].id;
      if (prefixed.length > 1) throw new Error(`"${ref}" matches more than one game; use a longer prefix`);
    }
    const named = this.durableObjects().filter((o) => o.name !== null && (o.name === ref || o.name.startsWith(ref)));
    if (named.length === 1) return named[0].name;
    if (named.length > 1) throw new Error(`"${ref}" matches more than one game; use a longer prefix`);
    return null;
  }

  /** The Durable Object holding a game's session, or null if none exists yet. */
  gameDurableObject(gameId: string): LocalDurableObject | null {
    return this.durableObjects().find((o) => o.name === gameId) ?? null;
  }

  /** Identity for a set of user and bot ids, for rendering seats as names. */
  #identities(userIds: string[], botIds: string[]): Map<string, { username: string; displayName: string }> {
    const out = new Map<string, { username: string; displayName: string }>();
    const d1 = this.d1();
    if (d1 === null) return out;
    for (const [table, ids] of [
      ["users", userIds],
      ["bots", botIds],
    ] as const) {
      if (ids.length === 0) continue;
      const placeholders = ids.map(() => "?").join(",");
      const rows = d1.db.prepare(`select id, username, display_name from ${table} where id in (${placeholders})`).all(...ids) as { id: string; username: string; display_name: string }[];
      for (const row of rows) out.set(row.id, { username: row.username, displayName: row.display_name });
    }
    return out;
  }

  #seats(rows: { player_index: number; user_id: string | null; bot_id: string | null; type: string }[]): LocalSeat[] {
    const identities = this.#identities(
      rows.map((r) => r.user_id).filter((id): id is string => id !== null),
      rows.map((r) => r.bot_id).filter((id): id is string => id !== null),
    );
    return rows.map((row) => {
      const identity = identities.get(row.user_id ?? row.bot_id ?? "");
      return { playerIndex: row.player_index, userId: row.user_id, botId: row.bot_id, type: row.type, username: identity?.username ?? null, displayName: identity?.displayName ?? null };
    });
  }

  /**
   * Join both stores for one game: the index row, the session, the transition
   * log, and the derived diagnosis.
   *
   * Returns null only when neither store has heard of the game.
   */
  game(ref: string): LocalGameView | null {
    const gameId = this.resolveGameId(ref);
    if (gameId === null) return null;

    const d1 = this.d1();
    const indexRow = d1 === null ? undefined : (d1.db.prepare("select * from games where id = ?").get(gameId) as Record<string, unknown> | undefined);
    const index = indexRow === undefined ? null : toGameRow(indexRow);
    const indexSeats =
      d1 === null
        ? []
        : this.#seats(
            d1.db.prepare("select player_index, user_id, bot_id, type from participants where game_id = ? order by player_index").all(gameId) as {
              player_index: number;
              user_id: string | null;
              bot_id: string | null;
              type: string;
            }[],
          );

    const durableObject = this.gameDurableObject(gameId);
    let meta: LocalGameMeta | null = null;
    let roster: LocalSeat[] = [];
    let transitions: LocalTransition[] = [];
    let commands: LocalGameView["commands"] = [];
    let outbox: LocalGameView["outbox"] = [];

    if (durableObject !== null) {
      const db = this.#handle(durableObject.file);
      if (tableExists(db, "meta")) {
        const row = db.prepare("select * from meta where id = 1").get() as Record<string, unknown> | undefined;
        if (row !== undefined) meta = toMeta(row);
      }
      if (tableExists(db, "roster")) {
        roster = this.#seats(db.prepare("select player_index, user_id, bot_id, type from roster order by player_index").all() as { player_index: number; user_id: string | null; bot_id: string | null; type: string }[]);
      }
      if (tableExists(db, "transitions")) {
        const frameSeats = new Map<number, number[]>();
        if (tableExists(db, "frames")) {
          for (const row of db.prepare("select version, player_index from frames order by version, player_index").all() as { version: number; player_index: number }[]) {
            frameSeats.set(row.version, [...(frameSeats.get(row.version) ?? []), row.player_index]);
          }
        }
        transitions = (db.prepare("select * from transitions order by version").all() as Record<string, unknown>[]).map((row) => toTransition(row, frameSeats));
      }
      if (tableExists(db, "commands")) {
        commands = (db.prepare("select command_id, response, created_at from commands order by created_at desc").all() as { command_id: string; response: unknown; created_at: number }[]).map((row) => ({
          commandId: row.command_id,
          createdAt: row.created_at,
          result: json(row.response),
        }));
      }
      if (tableExists(db, "outbox")) {
        outbox = (db.prepare("select finish_id, outcomes, created_at from outbox order by created_at").all() as { finish_id: string; outcomes: unknown; created_at: number }[]).map((row) => ({
          finishId: row.finish_id,
          createdAt: row.created_at,
          outcomes: json(row.outcomes),
        }));
      }
    }

    const alarm = durableObject === null ? null : this.alarm(durableObject);
    const view: Omit<LocalGameView, "diagnosis"> = { gameId, index, indexSeats, durableObject, meta, roster, transitions, commands, outbox, alarm };
    return { ...view, diagnosis: diagnose(view) };
  }

  /** Run a read-only statement against D1 or one game's Durable Object: the
   * escape hatch for a question this reader does not model. */
  query(sql: string, options: { game?: string; params?: LocalQueryParam[] } = {}): Record<string, unknown>[] {
    const db = options.game === undefined ? this.d1()?.db : this.#gameDb(options.game);
    if (db === undefined || db === null) {
      throw new Error(options.game === undefined ? "no local D1 database found in this Worker's state" : `no local Durable Object found for game ${options.game}`);
    }
    return db.prepare(sql).all(...(options.params ?? [])) as Record<string, unknown>[];
  }

  /** Table names and row counts, for D1 or one game's Durable Object. */
  tables(options: { game?: string } = {}): { name: string; rows: number }[] {
    const db = options.game === undefined ? this.d1()?.db : this.#gameDb(options.game);
    if (db === undefined || db === null) return [];
    const names = (db.prepare("select name from sqlite_master where type = 'table' order by name").all() as { name: string }[]).map((r) => r.name);
    return names.map((name) => ({ name, rows: (db.prepare(`select count(*) as n from "${name}"`).get() as { n: number }).n }));
  }

  #gameDb(ref: string): DatabaseSync | null {
    const gameId = this.resolveGameId(ref);
    const target = gameId === null ? null : this.gameDurableObject(gameId);
    return target === null ? null : this.#handle(target.file);
  }

  /** Release every open handle. */
  close(): void {
    for (const db of this.#open.values()) db.close();
    this.#open.clear();
    this.#d1 = undefined;
  }
}

function toGameRow(row: Record<string, unknown>): LocalGameRow {
  return {
    id: row.id as string,
    createdBy: (row.created_by as string | null) ?? null,
    status: row.status as string,
    access: row.access as string,
    schemaVersion: row.schema_version as number,
    config: json(row.config),
    turnSeconds: (row.turn_seconds as number | null) ?? null,
    budgetSeconds: (row.budget_seconds as number | null) ?? null,
    incrementSeconds: (row.increment_seconds as number | null) ?? null,
    rated: bool(row.rated),
    ratingPool: (row.rating_pool as string | null) ?? null,
    minPlayers: row.min_players as number,
    maxPlayers: row.max_players as number,
    shortCode: row.short_code as string,
    pendingPlayers: row.pending_players === null || row.pending_players === undefined ? null : numbers(row.pending_players),
    turnDeadline: (row.turn_deadline as number | null) ?? null,
    outcomes: json(row.outcomes),
    finishId: (row.finish_id as string | null) ?? null,
    finishedAt: (row.finished_at as number | null) ?? null,
    archivedAt: (row.archived_at as number | null) ?? null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

function toMeta(row: Record<string, unknown>): LocalGameMeta {
  return {
    gameId: row.game_id as string,
    status: row.status as string,
    access: row.access as string,
    schemaVersion: row.schema_version as number,
    config: json(row.config),
    turnSeconds: (row.turn_seconds as number | null) ?? null,
    budgetSeconds: (row.budget_seconds as number | null) ?? null,
    incrementSeconds: (row.increment_seconds as number | null) ?? null,
    rated: bool(row.rated),
    ratingPool: (row.rating_pool as string | null) ?? null,
    minPlayers: row.min_players as number,
    maxPlayers: row.max_players as number,
    createdBy: (row.created_by as string | null) ?? null,
    rngSeed: (row.rng_seed as string | null) ?? null,
  };
}

function toTransition(row: Record<string, unknown>, frameSeats: Map<number, number[]>): LocalTransition {
  const version = row.version as number;
  const action = json(row.action) as LocalTransition["action"];
  return {
    version,
    state: json(row.state),
    action: action ?? null,
    pending: numbers(row.pending),
    deadline: (row.deadline as number | null) ?? null,
    playerTimes: row.player_times === null || row.player_times === undefined ? null : numbers(row.player_times),
    turnStartedAt: (row.turn_started_at as number | null) ?? null,
    frameSeats: frameSeats.get(version) ?? [],
  };
}

/**
 * Say what the game is waiting for, and whether the two stores agree.
 *
 * The engine's statuses each have exactly one thing that moves them, so this is
 * a total function over `status` rather than a heuristic. The cases developers
 * actually hit are the first two: a lobby that will not fill, and a full lobby
 * whose creator has not pressed start.
 */
function diagnose(view: Omit<LocalGameView, "diagnosis">): LocalGameDiagnosis {
  const status = view.meta?.status ?? view.index?.status ?? "unknown";
  const seated = (view.meta === null ? view.indexSeats : view.roster).length;
  const min = view.meta?.minPlayers ?? view.index?.minPlayers ?? 0;
  const max = view.meta?.maxPlayers ?? view.index?.maxPlayers ?? 0;
  const latest = view.transitions.at(-1) ?? null;

  const mirrorDrift: string[] = [];
  if (view.index !== null && view.meta !== null) {
    if (view.index.status !== view.meta.status) {
      mirrorDrift.push(`D1 says status=${view.index.status}, the Durable Object says ${view.meta.status}. The DO is authoritative; a mirror write was lost.`);
    }
    if (view.indexSeats.length !== view.roster.length) {
      mirrorDrift.push(`D1 mirrors ${view.indexSeats.length} seat(s), the Durable Object holds ${view.roster.length}.`);
    }
    const mirroredPending = view.index.pendingPlayers ?? null;
    const actualPending = latest?.pending ?? null;
    if (status === "active" && JSON.stringify(mirroredPending) !== JSON.stringify(actualPending)) {
      mirrorDrift.push(`D1 mirrors pendingPlayers=${JSON.stringify(mirroredPending)}, the newest transition has ${JSON.stringify(actualPending)}.`);
    }
  }
  if (view.index === null && view.meta !== null) {
    mirrorDrift.push("no D1 index row for a game whose Durable Object exists; discovery and history lists cannot show it.");
  }

  let summary: string;
  switch (status) {
    case "waiting":
      summary = `waiting for players: ${seated}/${min} needed to become ready (${max} max). The next event is a join, or add-bot from the creator.`;
      break;
    case "ready":
      summary = `ready and not started: ${seated}/${max} seats filled. Nothing happens until the CREATOR calls POST /api/engine/games/${view.gameId}/start. A start is explicit and creator-only; filling the lobby does not start a game.`;
      break;
    case "active":
      if (latest === null) {
        summary = "status is active but no transition is committed, which should be impossible: a start commits v0 in the same transaction that sets the status.";
      } else {
        const waitingOn = latest.pending.length === 0 ? "nobody, which means the game should have finished at this version" : `seat(s) ${latest.pending.join(", ")}`;
        const timer = latest.deadline === null ? "untimed, so no alarm is armed and only a move or a forfeit moves it" : `deadline ${new Date(latest.deadline).toISOString()}`;
        summary = `at v${latest.version}, waiting on ${waitingOn}. ${timer}.`;
      }
      break;
    case "finished":
      summary = view.outbox.length > 0 ? `finished, but ${view.outbox.length} outbox row(s) survive: the D1 finish apply has not succeeded, so ratings and history are not published yet.` : `finished at v${latest?.version ?? "?"}; the outbox is clear, so D1 has the outcomes.`;
      break;
    case "aborted":
      summary = "aborted: cancelled by its creator, reaped as abandoned, or torn down by an account purge. Nothing moves an aborted game.";
      break;
    default:
      summary = view.durableObject === null ? "created in D1 but its Durable Object does not exist yet. That is normal for a lobby nobody has touched: the DO is created lazily by the first command or socket." : `unrecognised status ${status}.`;
  }

  return { summary, mirrorDrift };
}
