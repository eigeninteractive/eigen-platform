/**
 * The operator surface: inspect one game, and repair it.
 *
 * Deliberately outside the OpenAPI document and the generated clients. A player's
 * app has no business knowing these routes exist, and publishing them in the
 * public spec would put repair operations in every generated SDK. They are plain
 * handlers, like the WebSocket upgrade and the public web pages.
 *
 * Every route answers **404** when `OPS_TOKEN` is unset, so a deployment that
 * never configures an operator secret behaves as though this surface does not
 * exist. That is deliberately not the `500` the external-bot route uses for its
 * own missing secret: a bot integrator is a known caller who needs to be told
 * their deployment is misconfigured, whereas anyone probing here is not.
 *
 * **`inspect` must never reveal hidden game state.** It asks the Durable Object
 * for the *unseated* session view, which is exactly what a spectator sees
 * (`frame: null`), so the answer cannot become a cheating channel for a live game
 * no matter who holds the operator secret. What an operator actually needs is the
 * two copies side by side — what the authority committed, and what D1 believes —
 * and that needs no observation data at all.
 */

import { Hono } from "hono";
import { readGame } from "../d1/reads.js";
import type { RouteContext } from "../engine.js";
import { HttpError } from "../http.js";

const encoder = new TextEncoder();

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

/**
 * Compare a presented token with the configured one without leaking its prefix.
 *
 * Compares SHA-256 digests rather than the secrets. An attacker cannot steer
 * SHA-256 output, so how far two digests agree says nothing about how far the
 * inputs did; the accumulating loop then avoids an early exit as well. Workers
 * has no `timingSafeEqual`, and the codebase's other secret comparison rides
 * `crypto.subtle.verify` for the same reason (see `bot-auth.ts`).
 */
async function secretMatches(presented: string, configured: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(presented), digest(configured)]);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= (a[index] as number) ^ (b[index] as number);
  return difference === 0;
}

/** The engine's operator group. Mounted by `buildApp` only when configured. */
export function buildOpsApp(ctx: RouteContext) {
  const ops = new Hono<{ Bindings: Record<string, unknown> }>();

  ops.use("*", async (c, next) => {
    const configured = ctx.opsToken(c.env);
    if (configured === null) throw new HttpError(404, "Not found");
    const header = c.req.header("authorization") ?? "";
    const presented = header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
    if (presented === "" || !(await secretMatches(presented, configured))) {
      throw new HttpError(401, "Operator authorization required");
    }
    await next();
  });

  // What the authority holds, and what D1 believes, in one answer. An operator
  // reads the pair; nothing here interprets divergence for them, because the
  // interesting cases are the ones nobody predicted.
  ops.get("/games/:gameId", async (c) => {
    const gameId = c.req.param("gameId");
    const [row, session] = await Promise.all([readGame(ctx.d1(c.env), gameId), ctx.stub(c.env, gameId).session(gameId, null)]);
    if (row === undefined && session === null) throw new HttpError(404, "No such game");
    return c.json({
      gameId,
      d1:
        row === undefined
          ? null
          : {
              status: row.status,
              finishId: row.finishId,
              pendingPlayers: row.pendingPlayers,
              turnDeadline: row.turnDeadline,
              updatedAt: row.updatedAt,
              finishedAt: row.finishedAt,
              seats: row.participants,
            },
      durableObject:
        session === null
          ? null
          : {
              status: session.status,
              seq: session.seq,
              version: session.version,
              seats: session.players,
            },
    });
  });

  // The repair. Idempotent, so an operator may run it twice, and safe on a
  // healthy game — which matters because the reason to run it is usually a
  // suspicion rather than a diagnosis.
  ops.post("/games/:gameId/reconcile", async (c) => {
    const gameId = c.req.param("gameId");
    const report = await ctx.stub(c.env, gameId).reconcile(gameId);
    if (!report.initialized) {
      // No committed state means D1's row is the only truth there is, so there was
      // nothing to reconcile against. Reported as success with the reason, not as
      // an error: the game may simply never have been played.
      return c.json({ ...report, note: "This game has no committed Durable Object state; D1's row is authoritative for it." });
    }
    return c.json(report);
  });

  return ops;
}
