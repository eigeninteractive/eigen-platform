/**
 * The account sync (decision 0013) and the ordering it rests on.
 *
 * Three properties are asserted, because each is the reason for a piece of the
 * design rather than a detail of it:
 *
 * 1. **The read-model mirror cannot regress.** Mirror writes are dispatched
 *    without being awaited and retried, so two for one game can land in either
 *    order. Each carries its commit's `seq` and an older one changes nothing.
 * 2. **History syncs by commit order, not by finish time.** A finish stamped
 *    earlier can commit later; a device whose cursor passed the later stamp
 *    must still receive it. `finish_seq` is what makes that true.
 * 3. **Small sets are whole.** A game the caller left, like a friend removed,
 *    is simply absent: there is no tombstone to send or to miss.
 *
 * History is seeded straight into D1 (create plus finish apply) rather than
 * played through Durable Objects, which is what lets these tests fix finish
 * times exactly, including a tie, instead of hoping the clock produces one.
 */

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { orm } from "../src/d1/orm.js";
import { games, participants, users } from "../src/d1/schema.js";
import { SYNC_FINISHED_PAGE } from "../src/d1/sync.js";
import { applyFinish, createGame, mirrorRoster, updateSummary } from "../src/index.js";
import { testBearer as bearer, testMutationHeaders as mutationHeaders, withCreationId } from "../src/testing.js";
import { userRow } from "./factories.js";

const db = orm(env.DB);

async function api(uid: string, method: string, path: string, body?: unknown): Promise<Response> {
  const requestBody = withCreationId(method, path, body);
  return await exports.default.fetch(`https://x/api/engine${path}`, {
    method,
    headers: method === "GET" ? await bearer({ uid }) : await mutationHeaders({ uid }),
    ...(requestBody !== undefined ? { body: JSON.stringify(requestBody) } : {}),
  });
}

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return (await res.json()) as T;
}

interface Summary {
  id: string;
  seq: number;
  finishedAt: number | null;
  participants: { userId: string | null }[];
}

interface Sync {
  activeGames: Summary[];
  finishedGames: Summary[];
  players: { id: string }[];
  finishedCursor: number;
  hasMoreFinished: boolean;
  historyFloor: string | null;
}

interface FinishedPage {
  games: Summary[];
  nextCursor: string | null;
}

async function sync(uid: string, finishedAfter?: number): Promise<Sync> {
  return await json<Sync>(await api(uid, "GET", finishedAfter === undefined ? "/me/sync" : `/me/sync?finishedAfter=${finishedAfter}`));
}

/** Two registered users who exist before any request provisions them. */
async function pair(): Promise<{ a: string; b: string }> {
  const a = `sync-a-${crypto.randomUUID()}`;
  const b = `sync-b-${crypto.randomUUID()}`;
  await db
    .insert(users)
    .values([a, b].map((id) => userRow(id)))
    .run();
  return { a, b };
}

const seats = (a: string, b: string) => [
  { playerIndex: 0, userId: a, botId: null, type: "human" as const },
  { playerIndex: 1, userId: b, botId: null, type: "human" as const },
];

/** A two-seat game between `a` and `b`, created ready and not yet finished. */
async function readyGame(a: string, b: string, at: number): Promise<string> {
  const gameId = `sync-${crypto.randomUUID()}`;
  await createGame(env.DB, {
    gameId,
    createdBy: a,
    status: "ready",
    access: "private",
    origin: "online",
    schemaVersion: 1,
    config: {},
    turnSeconds: null,
    budgetSeconds: null,
    incrementSeconds: null,
    rated: false,
    ratingPool: null,
    minPlayers: 2,
    maxPlayers: 2,
    shortCode: crypto.randomUUID(),
    seats: seats(a, b),
    createdAt: at,
    now: at,
  });
  return gameId;
}

/** Finish `gameId` as if its finishing commit stamped `finishedAt`. */
async function finish(gameId: string, a: string, b: string, finishedAt: number): Promise<void> {
  await applyFinish(env.DB, {
    gameId,
    finishId: crypto.randomUUID(),
    outcomes: [
      { playerIndex: 0, result: "win", placement: 1, teamIndex: 0 },
      { playerIndex: 1, result: "loss", placement: 2, teamIndex: 1 },
    ],
    roster: seats(a, b),
    rated: false,
    ratingPool: null,
    seq: 3,
    now: finishedAt,
  });
}

async function finishedGames(a: string, b: string, finishTimes: number[]): Promise<string[]> {
  const ids: string[] = [];
  for (const at of finishTimes) {
    const id = await readyGame(a, b, at);
    await finish(id, a, b, at);
    ids.push(id);
  }
  return ids;
}

/** Follow a history page chain to its end the way a device does: echo
 * `nextCursor`, never derive one from a row. */
async function drainHistory(uid: string, from: string, limit: number): Promise<string[]> {
  const seen: string[] = [];
  let cursor: string | null = from;
  for (let guard = 0; guard < 100 && cursor !== null; guard++) {
    const page: FinishedPage = await json<FinishedPage>(await api(uid, "GET", `/me/games/finished?limit=${limit}&cursor=${encodeURIComponent(cursor)}`));
    seen.push(...page.games.map((game) => game.id));
    cursor = page.nextCursor;
  }
  if (cursor !== null) throw new Error("history paging did not terminate");
  return seen;
}

describe("mirror ordering", () => {
  it("an older summary write lands after a newer one and changes nothing", async () => {
    const { a, b } = await pair();
    const gameId = await readyGame(a, b, Date.now());
    await updateSummary(env.DB, { gameId, status: "active", pendingPlayers: [1], turnDeadline: null, seq: 5, now: Date.now() });
    // The retry of an earlier commit's mirror, arriving late.
    await updateSummary(env.DB, { gameId, status: "active", pendingPlayers: [0], turnDeadline: null, seq: 4, now: Date.now() });

    const row = await db.select().from(games).where(eq(games.id, gameId)).get();
    expect(row?.seq).toBe(5);
    expect(row?.pendingPlayers).toEqual([1]);
  });

  it("a stale roster mirror neither deletes nor replaces a newer roster", async () => {
    const { a, b } = await pair();
    const gameId = await readyGame(a, b, Date.now());
    await mirrorRoster(env.DB, { gameId, status: "ready", seats: seats(a, b), seq: 3, now: Date.now() });
    // The mirror of the lobby before b joined, landing last.
    await mirrorRoster(env.DB, { gameId, status: "waiting", seats: seats(a, b).slice(0, 1), seq: 2, now: Date.now() });

    const roster = await db.select().from(participants).where(eq(participants.gameId, gameId)).all();
    expect(roster.map((seat) => seat.userId).sort()).toEqual([a, b].sort());
    expect((await db.select().from(games).where(eq(games.id, gameId)).get())?.status).toBe("ready");
  });

  it("an equal-revision rewrite, which is what reconciliation sends, still lands", async () => {
    const { a, b } = await pair();
    const gameId = await readyGame(a, b, Date.now());
    await mirrorRoster(env.DB, { gameId, status: "ready", seats: seats(a, b), seq: 3, now: 1 });
    await mirrorRoster(env.DB, { gameId, status: "ready", seats: seats(a, b), seq: 3, now: 2 });
    const row = await db.select().from(games).where(eq(games.id, gameId)).get();
    expect(row?.updatedAt).toBe(2);
    expect(await db.select().from(participants).where(eq(participants.gameId, gameId)).all()).toHaveLength(2);
  });

  it("assigns finish_seq in commit order, once", async () => {
    const { a, b } = await pair();
    const [first, second] = await finishedGames(a, b, [2_000, 1_000]);
    const read = async (id: string) =>
      (
        await db
          .select()
          .from(games)
          .where(eq(games.id, id as string))
          .get()
      )?.finishSeq;
    const firstSeq = await read(first as string);
    const secondSeq = await read(second as string);
    // Stamped earlier, committed later: the sequence follows the commit.
    expect(secondSeq).toBeGreaterThan(firstSeq as number);

    // A re-poked apply is a replay, and must not renumber the game.
    const row = await db
      .select()
      .from(games)
      .where(eq(games.id, second as string))
      .get();
    await applyFinish(env.DB, {
      gameId: second as string,
      finishId: row?.finishId as string,
      outcomes: [],
      roster: seats(a, b),
      rated: false,
      ratingPool: null,
      seq: 3,
      now: 9_999,
    });
    expect(await read(second as string)).toBe(secondSeq);
  });
});

describe("account sync", () => {
  it("a first sync returns the newest page of history, the account's highest finish_seq, and a floor", async () => {
    const { a, b } = await pair();
    const base = Date.now() - 10_000_000;
    const ids = await finishedGames(
      a,
      b,
      Array.from({ length: SYNC_FINISHED_PAGE + 2 }, (_, i) => base + i),
    );

    const first = await sync(a);
    expect(first.finishedGames.map((game) => game.id)).toEqual(ids.slice(2).reverse());
    expect(first.hasMoreFinished).toBe(false);
    expect(first.historyFloor).not.toBeNull();

    const mine = await db.select({ finishSeq: games.finishSeq }).from(participants).innerJoin(games, eq(games.id, participants.gameId)).where(eq(participants.userId, a)).all();
    expect(first.finishedCursor).toBe(Math.max(...mine.map((row) => row.finishSeq ?? 0)));

    // The floor continues exactly where the page stopped.
    expect(await drainHistory(a, first.historyFloor as string, 1)).toEqual(ids.slice(0, 2).reverse());
  });

  it("has no floor when the newest page is the whole history, even an exactly full one", async () => {
    const { a, b } = await pair();
    const base = Date.now() - 20_000_000;
    await finishedGames(
      a,
      b,
      Array.from({ length: SYNC_FINISHED_PAGE }, (_, i) => base + i),
    );
    const first = await sync(a);
    expect(first.finishedGames).toHaveLength(SYNC_FINISHED_PAGE);
    expect(first.historyFloor).toBeNull();
  });

  it("delivers a finish that committed after the cursor even though it is stamped before everything", async () => {
    const { a, b } = await pair();
    await finishedGames(a, b, [Date.now()]);
    const first = await sync(a);

    // Committed now, stamped long ago: exactly the game a timestamp cursor
    // would skip forever.
    const [late] = await finishedGames(a, b, [1]);
    const next = await sync(a, first.finishedCursor);
    expect(next.finishedGames.map((game) => game.id)).toEqual([late]);
    expect(next.finishedCursor).toBeGreaterThan(first.finishedCursor);
    expect(next.historyFloor).toBeNull();

    // And once taken, it is not delivered again.
    expect((await sync(a, next.finishedCursor)).finishedGames).toEqual([]);
  });

  it("pages an increment with hasMoreFinished until it is drained", async () => {
    const { a, b } = await pair();
    const cursor = (await sync(a)).finishedCursor;
    const base = Date.now();
    const ids = await finishedGames(
      a,
      b,
      Array.from({ length: SYNC_FINISHED_PAGE + 1 }, (_, i) => base + i),
    );

    const page = await sync(a, cursor);
    expect(page.finishedGames).toHaveLength(SYNC_FINISHED_PAGE);
    expect(page.hasMoreFinished).toBe(true);
    const rest = await sync(a, page.finishedCursor);
    expect(rest.hasMoreFinished).toBe(false);
    expect([...page.finishedGames, ...rest.finishedGames].map((game) => game.id)).toEqual(ids);
  });

  // The games here share one finish instant. Under a cursor that was the bare
  // sort value, a page boundary landing between two tied rows dropped one
  // permanently: it was neither older than the cursor nor on the page already
  // served. The history cursor carries the row id as a tiebreak.
  it("pages history across a finish-time tie without repeating or skipping a game", async () => {
    const { a, b } = await pair();
    const tie = Date.now() - 30_000_000;
    const ids = await finishedGames(a, b, [tie, tie, tie, tie, tie]);
    const first = await json<FinishedPage>(await api(a, "GET", "/me/games/finished?limit=2"));
    const rest = first.nextCursor === null ? [] : await drainHistory(a, first.nextCursor, 2);
    const seen = [...first.games.map((game) => game.id), ...rest];
    expect(seen).toHaveLength(new Set(seen).size);
    expect(new Set(seen)).toEqual(new Set(ids));
  });

  it("refuses a history cursor that did not come from the server", async () => {
    const { a } = await pair();
    const res = await api(a, "GET", "/me/games/finished?limit=2&cursor=not-a-cursor");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("invalidCursor");
  });

  it("names every human seated in the games it returns", async () => {
    const { a, b } = await pair();
    await readyGame(a, b, Date.now());
    const synced = await sync(a);
    expect(synced.players.map((player) => player.id)).toEqual(expect.arrayContaining([a, b]));
  });

  it("returns the games in play whole, so a game the caller left is simply absent", async () => {
    const { a, b } = await pair();
    const created = await json<{ gameId: string }>(await api(a, "POST", "/games", { access: "public", schemaVersion: 1, config: { target: 3 }, minPlayers: 3, maxPlayers: 3, rated: false }), 201);
    await json(await api(b, "POST", `/games/${created.gameId}/join`, { clientSchemaVersion: 1 }));
    await vi.waitFor(async () => expect((await sync(b)).activeGames.map((game) => game.id)).toContain(created.gameId));

    await json(await api(b, "POST", `/games/${created.gameId}/leave`));
    await vi.waitFor(async () => expect((await sync(b)).activeGames.map((game) => game.id)).not.toContain(created.gameId));
    // The creator still holds it, at a newer revision than before the leave.
    const kept = (await sync(a)).activeGames.find((game) => game.id === created.gameId);
    expect(kept?.participants).toHaveLength(1);
    expect(kept?.seq).toBeGreaterThan(1);
  });
});
