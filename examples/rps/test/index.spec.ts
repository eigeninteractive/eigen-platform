/**
 * End-to-end through the real API: create → join → start → simultaneous
 * commits (the §3.5 same-view acceptance, live through the whole stack) →
 * finish → D1 summary → viewer replay with the post-game reveal.
 */

import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { d1Schema } from "@eigen/server";
import { testBearer } from "@eigen/server/testing";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { expect, it } from "vitest";

const ALICE = "rps-alice";
const BOB = "rps-bob";
const VIEWER = "rps-viewer";

async function api(uid: string, method: string, path: string, body?: unknown): Promise<Response> {
  return await SELF.fetch(`https://rps.test/api${path}`, {
    method,
    headers: { ...(await testBearer({ uid })), "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

it("requires a token on every route", async () => {
  expect((await SELF.fetch("https://rps.test/api/lobby")).status).toBe(401);
});

it("plays a full game: waiting room, same-view simultaneous commits, finish, replay reveal", async () => {
  const created = await api(ALICE, "POST", "/games", {
    schema_version: 1,
    config: { targetWins: 1 },
    min_players: 2,
    max_players: 2,
    rated: false,
  });
  expect(created.status).toBe(200);
  const { game_id: gameId } = (await created.json()) as { game_id: string };

  const joined = await api(BOB, "POST", `/games/${gameId}/join`, { client_schema_version: 1 });
  expect((await joined.json()) as object).toMatchObject({ ok: true, roster: { status: "ready" } });

  // The action route resolves seats through the fire-and-forget D1 mirror —
  // wait for Bob's row before acting as him (§4.2 accepted staleness).
  const db = drizzle(env.rps_dev);
  await expect.poll(async () => (await db.select().from(d1Schema.participants).where(eq(d1Schema.participants.gameId, gameId)).all()).length).toBe(2);

  const started = await api(ALICE, "POST", `/games/${gameId}/start`, {});
  expect(await started.json()).toMatchObject({ ok: true, version: 0 });

  // Both seats commit against v0. The second arrives stale — and lands,
  // because RPS masks the opponent's hidden commit (same-view rule).
  const rock = await api(ALICE, "POST", `/games/${gameId}/action`, { data: { move: "rock" }, expected_version: 0 });
  expect(await rock.json()).toMatchObject({ ok: true, version: 1 });

  const scissors = await api(BOB, "POST", `/games/${gameId}/action`, { data: { move: "scissors" }, expected_version: 0 });
  const resolved = (await scissors.json()) as { ok: boolean; version: number; frame: { outcomes?: unknown[] } };
  expect(resolved).toMatchObject({ ok: true, version: 2 });
  expect(resolved.frame.outcomes).toHaveLength(2);

  // The finish apply lands in D1 (single attempt, post-commit).
  await expect
    .poll(async () => {
      const row = await db.select({ status: d1Schema.games.status }).from(d1Schema.games).where(eq(d1Schema.games.id, gameId)).get();
      return row?.status;
    })
    .toBe("finished");

  // A non-participant replays the finished public game as viewer: the
  // post-game projection reveals the hidden commits (§4.6).
  const replay = await api(VIEWER, "GET", `/games/${gameId}/frames?from=0&to=10`);
  const { frames } = (await replay.json()) as { frames: { version: number; data: { commits?: unknown } }[] };
  expect(frames.map((f) => f.version)).toEqual([0, 1, 2]);
  expect(frames[1]?.data.commits).toEqual(["rock", null]);
});
