/**
 * The external-bot webhook: `POST /api/bot/action`, where
 * an externally-hosted bot submits the move it decided after a wake.
 *
 * It shares the `/api` prefix with the client engine group but **not its auth**
 * (see `buildApp`): the two are separate sub-apps, so the engine's Firebase
 * middleware, scoped to `/api/engine/*`, never runs here. A bot carries no
 * user token; it authenticates the request itself by signing the exact request
 * body (bound to the `action` domain) and sending the signature in the
 * `Eigen-Signature` header: the same header the engine uses to sign wakes in
 * the other direction (the direction is bound in the signed bytes, not the
 * header name). The handler verifies that HMAC before trusting any claim in the
 * body, then runs the move through the normal command path (the DO verifies the
 * named seat exactly as for a human).
 *
 * It is a real OpenAPI operation (so the one emitted spec documents it), but
 * declares the `botHmac` security scheme instead of `firebase`, so the header
 * signature is a representable `apiKey`, which the in-body envelope was not.
 * That `apiKey` scheme is the header's documentation, so it is read directly
 * rather than re-declared as a request parameter.
 */

import { createRoute, z } from "@hono/zod-openapi";
import type { EngineApp, RouteContext } from "../engine.js";
import { HttpError, unwrap } from "../http.js";
import type { Command } from "../protocol.js";
import { errorShape } from "../routes/wire.js";
import { verifyBotSignature } from "./bot-auth.js";

/** What an external bot signs and sends as the request body: its claimed
 * identity/seat, the version it acted against, and the move. Every field is
 * trusted only after the `Eigen-Signature` HMAC over the exact bytes verifies. */
const botActionBody = z
  .object({
    botId: z.string().min(1),
    gameId: z.string().min(1),
    playerIndex: z.number().int().min(0),
    version: z.number().int().min(0),
    data: z.unknown(),
  })
  .openapi("BotAction");

export function registerBotRoutes(app: EngineApp, ctx: RouteContext): void {
  app.openapi(
    createRoute({
      method: "post",
      path: "/action",
      operationId: "botAction",
      tags: ["BotWebhook"],
      security: [{ botHmac: [] }],
      request: {
        body: { content: { "application/json": { schema: botActionBody } }, required: true },
      },
      responses: {
        204: { description: "The move was accepted and applied" },
        400: { content: { "application/json": { schema: errorShape } }, description: "Malformed body" },
        401: { content: { "application/json": { schema: errorShape } }, description: "Invalid signature" },
      },
    }),
    async (c) => {
      const secret = ctx.botSigningSecret(c.env);
      if (secret === null) throw new HttpError(500, "External bots are not configured");

      const claim = c.req.valid("json");
      const signature = c.req.header("eigen-signature");
      if (signature === undefined || signature.length === 0) throw new HttpError(401, "Missing signature");
      // Verify over the EXACT received bytes (Hono caches the body, so this is
      // the same text validation parsed), bound to the `action` domain, before
      // trusting the claim (constant-time). A bad signature is a flat 401:
      // no oracle about which field was wrong.
      const raw = await c.req.text();
      if (!(await verifyBotSignature(secret, claim.botId, "action", raw, signature))) {
        throw new HttpError(401, "Invalid signature");
      }

      // The DO resolves and enforces the named seat: it must belong to this bot
      // id or the command is a protocol violation (a 500 the operator sees).
      // Deterministic commandId so a bot's retry of the same turn dedupes.
      const cmd: Command = {
        kind: "action",
        gameId: claim.gameId,
        commandId: `botaction:${claim.botId}:${claim.gameId}:v${claim.version}:seat${claim.playerIndex}`,
        actor: { userId: null, botId: claim.botId },
        seat: claim.playerIndex,
        expectedVersion: claim.version,
        data: claim.data,
      };
      unwrap(await ctx.stub(c.env, claim.gameId).handle(cmd));
      return c.body(null, 204);
    },
  );
}
