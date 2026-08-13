import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { findWranglerState, LocalStore } from "../src/local-state.js";

/**
 * These build the same file layout `wrangler dev` leaves behind: a D1 database
 * under `d1/miniflare-D1DatabaseObject`, and one database per game under
 * `do/<worker>-<Class>`, each carrying Miniflare's `__miniflare_do_name` row.
 * Writing the layout rather than mocking it is the point, since what the reader
 * has to get right IS the layout.
 */

const GAME_ID = "11111111-2222-3333-4444-555555555555";

interface Fixture {
  root: string;
  worker: string;
}

function fixture(): Fixture {
  const worker = mkdtempSync(join(tmpdir(), "eigen-local-state-"));
  const root = join(worker, ".wrangler", "state", "v3");
  mkdirSync(join(root, "d1", "miniflare-D1DatabaseObject"), { recursive: true });
  mkdirSync(join(root, "do", "my-game-GameDO"), { recursive: true });
  return { root, worker };
}

function writeD1(f: Fixture, overrides: Partial<{ status: string; pendingPlayers: string | null; seats: number }> = {}): void {
  const db = new DatabaseSync(join(f.root, "d1", "miniflare-D1DatabaseObject", "abc123.sqlite"));
  db.exec(`
    create table games (id text primary key, created_by text, status text not null, access text not null, schema_version integer not null,
      config text not null, turn_seconds integer, budget_seconds integer, increment_seconds integer, rated integer not null, rating_pool text,
      min_players integer not null, max_players integer not null, short_code text not null, pending_players text, turn_deadline integer,
      outcomes text, finish_id text, finished_at integer, archived_at integer, created_at integer not null, updated_at integer not null);
    create table participants (id text primary key, game_id text not null, user_id text, bot_id text, player_index integer not null, type text not null, created_at integer not null);
    create table users (id text primary key, username text not null, email text, display_name text not null, avatar_url text, is_anonymous integer not null, created_at integer not null, updated_at integer not null);
    create table bots (id text primary key, username text not null, display_name text not null, avatar_url text, schema_version integer not null, type text not null, webhook_url text, rated_eligible integer not null, config text not null, created_at integer not null);
  `);
  const now = Date.now();
  db.prepare("insert into games values (?, 'user-a', ?, 'private', 1, '{\"target\":10}', null, null, null, 0, null, 2, 2, 'ABC123', ?, null, null, null, null, null, ?, ?)").run(GAME_ID, overrides.status ?? "ready", overrides.pendingPlayers ?? null, now, now);
  for (let seat = 0; seat < (overrides.seats ?? 2); seat += 1) {
    db.prepare("insert into participants values (?, ?, ?, null, ?, 'human', ?)").run(`p${seat}`, GAME_ID, `user-${seat === 0 ? "a" : "b"}`, seat, now);
  }
  db.prepare("insert into users values ('user-a', 'ana', null, 'Ana', null, 0, ?, ?)").run(now, now);
  db.prepare("insert into users values ('user-b', 'ben', null, 'Ben', null, 0, ?, ?)").run(now, now);
  db.close();
}

function writeGameDO(f: Fixture, options: { status: string; named?: boolean; transitions?: { version: number; action: unknown; pending: number[]; deadline?: number | null }[]; outbox?: boolean } = { status: "ready" }): void {
  const db = new DatabaseSync(join(f.root, "do", "my-game-GameDO", "deadbeef.sqlite"));
  db.exec(`
    create table __miniflare_do_name (id integer primary key, name text);
    create table meta (id integer primary key, game_id text not null, status text not null, access text not null, schema_version integer not null,
      config text not null, turn_seconds integer, budget_seconds integer, increment_seconds integer, rated integer not null, rating_pool text,
      min_players integer not null, max_players integer not null, created_by text, rng_seed text);
    create table roster (player_index integer primary key, user_id text, bot_id text, type text not null);
    create table transitions (version integer primary key, state text not null, action text, pending text not null, deadline integer, player_times text, turn_started_at integer);
    create table frames (version integer not null, player_index integer not null, data text not null, pending_players text not null, primary key (version, player_index));
    create table commands (command_id text primary key, response text not null, created_at integer not null);
    create table outbox (finish_id text primary key, outcomes text not null, created_at integer not null);
  `);
  if (options.named !== false) db.prepare("insert into __miniflare_do_name values (1, ?)").run(GAME_ID);
  db.prepare("insert into meta values (1, ?, ?, 'private', 1, '{\"target\":10}', null, null, null, 0, null, 2, 2, 'user-a', ?)").run(GAME_ID, options.status, options.transitions === undefined ? null : "seed-1");
  db.prepare("insert into roster values (0, 'user-a', null, 'human')").run();
  db.prepare("insert into roster values (1, 'user-b', null, 'human')").run();
  for (const transition of options.transitions ?? []) {
    db.prepare("insert into transitions values (?, ?, ?, ?, ?, null, null)").run(transition.version, JSON.stringify({ count: transition.version }), transition.action === null ? null : JSON.stringify(transition.action), JSON.stringify(transition.pending), transition.deadline ?? null);
    for (const seat of [0, 1]) db.prepare("insert into frames values (?, ?, ?, ?)").run(transition.version, seat, JSON.stringify({ count: transition.version }), JSON.stringify(transition.pending));
  }
  if (options.outbox === true) db.prepare("insert into outbox values ('finish-1', '[]', ?)").run(Date.now());
  db.close();
}

const stores: LocalStore[] = [];
function open(f: Fixture, from?: string): LocalStore {
  const store = LocalStore.open(from ?? f.worker);
  stores.push(store);
  return store;
}

afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});

describe("findWranglerState", () => {
  it("walks up from a nested directory", () => {
    const f = fixture();
    const nested = join(f.worker, "src", "module", "fixtures");
    mkdirSync(nested, { recursive: true });
    expect(findWranglerState(nested)).toBe(f.root);
  });

  it("returns null when there is no state to read", () => {
    expect(findWranglerState(mkdtempSync(join(tmpdir(), "eigen-empty-")))).toBeNull();
  });
});

describe("LocalStore", () => {
  it("identifies the engine's D1 by its schema, not its filename", () => {
    const f = fixture();
    writeD1(f);
    expect(open(f).d1()?.file).toContain("abc123.sqlite");
  });

  it("maps a Durable Object file back to its game id and class", () => {
    const f = fixture();
    writeGameDO(f, { status: "ready" });
    const [object] = open(f).durableObjects();
    expect(object).toMatchObject({ className: "GameDO", id: "deadbeef", name: GAME_ID });
  });

  it("resolves a game by id, short code, and id prefix", () => {
    const f = fixture();
    writeD1(f);
    const store = open(f);
    expect(store.resolveGameId(GAME_ID)).toBe(GAME_ID);
    expect(store.resolveGameId("abc123")).toBe(GAME_ID);
    expect(store.resolveGameId("11111111")).toBe(GAME_ID);
    expect(store.resolveGameId("nope")).toBeNull();
  });

  it("reads a game with no Durable Object as an untouched lobby", () => {
    const f = fixture();
    writeD1(f, { status: "waiting", seats: 1 });
    const view = open(f).game(GAME_ID);
    expect(view?.durableObject).toBeNull();
    expect(view?.indexSeats).toHaveLength(1);
    expect(view?.diagnosis.summary).toContain("waiting for players");
  });

  it("names the creator's start as the only thing a ready game waits for", () => {
    const f = fixture();
    writeD1(f);
    writeGameDO(f, { status: "ready" });
    const view = open(f).game("abc123");
    expect(view?.transitions).toHaveLength(0);
    expect(view?.meta?.rngSeed).toBeNull();
    expect(view?.diagnosis.summary).toContain("creator");
    expect(view?.diagnosis.mirrorDrift).toEqual([]);
  });

  it("decodes the transition log and reports who is on the clock", () => {
    const f = fixture();
    writeD1(f, { status: "active", pendingPlayers: "[1]" });
    writeGameDO(f, {
      status: "active",
      transitions: [
        { version: 0, action: null, pending: [0] },
        { version: 1, action: { type: "user", kind: "game", playerIndex: 0, data: { amount: 1 } }, pending: [1] },
      ],
    });
    const view = open(f).game(GAME_ID);
    expect(view?.transitions.map((t) => t.version)).toEqual([0, 1]);
    expect(view?.transitions[0].action).toBeNull();
    expect(view?.transitions[1].action).toMatchObject({ kind: "game", playerIndex: 0, data: { amount: 1 } });
    expect(view?.transitions[1].frameSeats).toEqual([0, 1]);
    expect(view?.diagnosis.summary).toContain("at v1, waiting on seat(s) 1");
    expect(view?.diagnosis.mirrorDrift).toEqual([]);
  });

  it("reports a stale D1 mirror as drift rather than as truth", () => {
    const f = fixture();
    writeD1(f, { status: "ready" });
    writeGameDO(f, { status: "active", transitions: [{ version: 0, action: null, pending: [0] }] });
    const view = open(f).game(GAME_ID);
    expect(view?.diagnosis.mirrorDrift.join(" ")).toContain("D1 says status=ready, the Durable Object says active");
  });

  it("flags a surviving outbox row on a finished game", () => {
    const f = fixture();
    writeD1(f, { status: "finished" });
    writeGameDO(f, { status: "finished", outbox: true, transitions: [{ version: 0, action: null, pending: [0] }] });
    expect(open(f).game(GAME_ID)?.diagnosis.summary).toContain("outbox row(s) survive");
  });

  it("counts rows per table for D1 and for one game's Durable Object", () => {
    const f = fixture();
    writeD1(f);
    writeGameDO(f, { status: "ready" });
    const store = open(f);
    expect(store.tables().find((t) => t.name === "games")?.rows).toBe(1);
    expect(store.tables({ game: GAME_ID }).find((t) => t.name === "roster")?.rows).toBe(2);
  });

  it("runs ad-hoc statements against either store", () => {
    const f = fixture();
    writeD1(f);
    writeGameDO(f, { status: "ready" });
    const store = open(f);
    expect(store.query("select count(*) as n from users")[0].n).toBe(2);
    expect(store.query("select count(*) as n from roster", { game: GAME_ID })[0].n).toBe(2);
    expect(() => store.query("select 1", { game: "missing" })).toThrow(/no local Durable Object/);
  });
});
