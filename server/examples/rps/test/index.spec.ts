/**
 * End-to-end through the real API: create → join → start → simultaneous
 * commits (the same-view acceptance, live through the whole stack) →
 * finish → D1 summary → viewer replay with the post-game reveal.
 */

import { env, exports } from "cloudflare:workers";
import { readGameRow } from "@eigeninteractive/server";
import { testBearer, testMutationHeaders } from "@eigeninteractive/server/testing";
import { expect, it } from "vitest";

const ALICE = "rps-alice";
const BOB = "rps-bob";
const VIEWER = "rps-viewer";

async function api(uid: string, method: string, path: string, body?: unknown): Promise<Response> {
  return await exports.default.fetch(`https://rps.test/api/engine${path}`, {
    method,
    // Mutations need the `Idempotency-Key` the engine requires; a fresh one per
    // call, since each of these is a new intent rather than a retry.
    headers: method === "GET" ? { ...(await testBearer({ uid })), "content-type": "application/json" } : await testMutationHeaders({ uid }),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

it("requires a token on every route", async () => {
  expect((await exports.default.fetch("https://rps.test/api/engine/lobby")).status).toBe(401);
});

it("plays a full game: waiting room, same-view simultaneous commits, finish, replay reveal", async () => {
  const created = await api(ALICE, "POST", "/games", {
    access: "public",
    schemaVersion: 1,
    config: { targetWins: 1 },
    minPlayers: 2,
    maxPlayers: 2,
    rated: false,
  });
  expect(created.status).toBe(201);
  const { gameId } = (await created.json()) as { gameId: string };

  const joined = await api(BOB, "POST", `/games/${gameId}/join`, { clientSchemaVersions: [1] });
  // Every accepted command answers with the caller's own session, so a join, a
  // start and a move are all read the same way.
  expect((await joined.json()) as object).toMatchObject({ session: { status: "ready", version: null } });

  // No mirror wait: the DO seats Bob on the join command and verifies the
  // seat each client sends against its own roster, so Bob can act the
  // moment his join returns.
  const started = await api(ALICE, "POST", `/games/${gameId}/start`, {});
  expect(await started.json()).toMatchObject({ session: { status: "active", version: 0 } });

  // Both seats commit against v0. The second arrives stale, and lands,
  // because RPS masks the opponent's hidden commit (same-view rule).
  const rock = await api(ALICE, "POST", `/games/${gameId}/action`, { seat: 0, data: { move: "rock" }, expectedVersion: 0 });
  expect(await rock.json()).toMatchObject({ session: { version: 1 } });

  const scissors = await api(BOB, "POST", `/games/${gameId}/action`, { seat: 1, data: { move: "scissors" }, expectedVersion: 0 });
  const resolved = (await scissors.json()) as { session: { version: number; status: string; frame: { outcomes?: unknown[] } } };
  expect(resolved).toMatchObject({ session: { version: 2, status: "finished" } });
  expect(resolved.session.frame.outcomes).toHaveLength(2);

  // The finish apply lands in D1 (single attempt, post-commit). `readGameRow`
  // is the engine's own accessor; the D1 table definitions are internal.
  await expect.poll(async () => (await readGameRow(env.rps_dev, gameId))?.status).toBe("finished");

  // A non-participant replays the finished public game as viewer: the
  // post-game projection reveals the hidden commits.
  const replay = await api(VIEWER, "GET", `/games/${gameId}/frames?from=0&to=10`);
  const { frames } = (await replay.json()) as { frames: { version: number; data: { commits?: unknown } }[] };
  expect(frames.map((f) => f.version)).toEqual([0, 1, 2]);
  expect(frames[1]?.data.commits).toEqual(["rock", null]);
});
