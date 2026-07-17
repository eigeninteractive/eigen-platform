/**
 * End-to-end through the dev harness: create → start → simultaneous commits
 * (the §3.5 same-view acceptance, live through the whole stack) → finish →
 * D1 summary → viewer replay with the post-game reveal.
 */

import { env, exports } from "cloudflare:workers";
import { d1Schema } from "@eigen/server";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { expect, it } from "vitest";

async function post(path: string, body?: unknown): Promise<Response> {
  return await exports.default.fetch(
    new Request(`https://rps.test${path}`, {
      method: "POST",
      body: body === undefined ? null : JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
}

it("serves the harness banner", async () => {
  const res = await exports.default.fetch(new Request("https://rps.test/"));
  expect(await res.text()).toContain("dev harness");
});

it("plays a full game: same-view simultaneous commits, finish, replay reveal", async () => {
  const created = await post("/dev/games", { config: { targetWins: 1 } });
  expect(created.status).toBe(201);
  const { gameId } = (await created.json()) as { gameId: string };

  const started = await post(`/dev/games/${gameId}/commands`, {
    kind: "start",
    actor: { userId: "dev-a", botId: null },
  });
  expect(await started.json()).toMatchObject({ ok: true, version: 0 });

  // Both seats commit against v0. The second arrives stale — and lands,
  // because RPS masks the opponent's hidden commit (same-view rule).
  const rock = await post(`/dev/games/${gameId}/commands`, {
    kind: "action",
    actor: { userId: "dev-a", botId: null },
    seat: 0,
    expectedVersion: 0,
    data: { move: "rock" },
  });
  expect(await rock.json()).toMatchObject({ ok: true, version: 1 });

  const scissors = await post(`/dev/games/${gameId}/commands`, {
    kind: "action",
    actor: { userId: "dev-b", botId: null },
    seat: 1,
    expectedVersion: 0,
    data: { move: "scissors" },
  });
  const resolved = (await scissors.json()) as { ok: boolean; version: number; frame: { outcomes?: unknown[] } };
  expect(resolved).toMatchObject({ ok: true, version: 2 });
  expect(resolved.frame.outcomes).toHaveLength(2);

  // The finish apply lands in D1 (single attempt, post-commit).
  const db = drizzle(env.rps_dev);
  await expect
    .poll(async () => {
      const row = await db.select({ status: d1Schema.games.status }).from(d1Schema.games).where(eq(d1Schema.games.id, gameId)).get();
      return row?.status;
    })
    .toBe("finished");

  // Viewer replay reveals the hidden commits (post-game, §4.6).
  const replay = await exports.default.fetch(new Request(`https://rps.test/dev/games/${gameId}/frames?replay=1`));
  const frames = (await replay.json()) as { version: number; data: { commits?: unknown } }[];
  expect(frames.map((f) => f.version)).toEqual([0, 1, 2]);
  expect(frames[1].data.commits).toEqual(["rock", null]);
});
