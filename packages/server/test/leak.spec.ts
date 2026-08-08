/**
 * The leak test: the kernel's per-seat projection is the ONLY thing keeping
 * hidden state server-side; nothing downstream re-filters it. This
 * drives a full lifecycle of the hidden-info version-2 game (whose raw state
 * carries `LEAK_SENTINEL`, stripped by `computeObservation`) and asserts the
 * sentinel escapes through no response body and no socket frame: live play,
 * command responses, the summary read, and post-finish replay alike.
 */

import { exports } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { testBearer as bearer, mintTestToken as mintToken } from "../src/testing.js";
import { LEAK_SENTINEL } from "./worker.js";

async function api(uid: string, method: string, path: string, body?: unknown): Promise<Response> {
  return await exports.default.fetch(`https://x/api/engine${path}`, {
    method,
    headers: { ...(await bearer({ uid })), "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** Read the body as text (so we can scan it) and assert no sentinel leaked. */
async function clean(res: Response, label: string): Promise<string> {
  const text = await res.text();
  expect(text, `${label} leaked the hidden state`).not.toContain(LEAK_SENTINEL);
  return text;
}

describe("leak test", () => {
  it("never surfaces hidden state through any response body or socket frame", async () => {
    const a = `leak-a-${crypto.randomUUID()}`;
    const b = `leak-b-${crypto.randomUUID()}`;

    // A hidden-info (schemaVersion 2) 2-player game, so `secret` is live state.
    const create = await api(a, "POST", "/games", { access: "public", schemaVersion: 2, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, rated: false });
    const { gameId } = JSON.parse(await clean(create, "create")) as { gameId: string };

    // Open B's socket before the game starts and collect every frame it fans out.
    const token = await mintToken({ uid: b });
    const sockRes = await exports.default.fetch(`https://x/api/engine/games/${gameId}/socket?token=${token}`, { headers: { Upgrade: "websocket" } });
    const ws = sockRes.webSocket;
    if (!ws) throw new Error("no websocket on the 101 response");
    const socketFrames: string[] = [];
    ws.addEventListener("message", (event: MessageEvent) => socketFrames.push(event.data as string));
    ws.accept();

    await clean(await api(b, "POST", `/games/${gameId}/join`, { clientSchemaVersion: 2 }), "join");
    await clean(await api(a, "POST", `/games/${gameId}/start`, {}), "start");

    // Play to a finish: seat 0 (A) opens, then seat 1 (B) closes it out.
    await clean(await api(a, "POST", `/games/${gameId}/action`, { seat: 0, expectedVersion: 0, data: { add: 2 } }), "action A");
    // A pulls its own live frames mid-game: the gap-recovery path.
    await clean(await api(a, "GET", `/games/${gameId}/frames?from=0`), "frames (live)");
    await clean(await api(b, "POST", `/games/${gameId}/action`, { seat: 1, expectedVersion: 1, data: { add: 2 } }), "action B");

    // The summary read, and post-finish replay for both a participant and…
    await clean(await api(a, "GET", `/games/${gameId}`), "summary");
    await clean(await api(a, "GET", `/games/${gameId}/frames?from=0`), "replay (participant)");

    // …let the socket fan-out settle, then scan every frame it received.
    await vi.waitFor(() => expect(socketFrames.length).toBeGreaterThanOrEqual(3));
    ws.close();
    for (const frame of socketFrames) expect(frame, "socket frame leaked the hidden state").not.toContain(LEAK_SENTINEL);

    // Sanity: the sentinel really was in play (else the test proves nothing):
    // the hidden game reveals `count`, never `secret`.
    expect(socketFrames.some((f) => f.includes('"count"'))).toBe(true);
  });
});
