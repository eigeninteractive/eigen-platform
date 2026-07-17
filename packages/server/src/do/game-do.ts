/**
 * The game's Durable Object — its serialized session AND its permanent
 * database (engine_stack.md §3.2, §4.6). One DO per game_id, addressed by
 * `idFromName(gameId)`. Implementors subclass {@link BaseGameDO} — the
 * platform-idiomatic shape (cf. `agents`' `Agent`, partyserver's `Server`):
 *
 * ```ts
 * export class GameDO extends BaseGameDO<Env> {
 *   protected readonly gameModule = myGame;
 *   protected d1(env: Env) { return env.MY_D1; }
 * }
 * ```
 *
 * Concurrency model (§3.4): the input gate serializes commands PROVIDED no
 * non-storage await sits between reading and writing storage. `handle()` is
 * therefore shaped read → pure kernel commit → one storage transaction, with
 * every network effect (fan-out is in-memory, D1/alarms are storage or
 * post-commit) strictly after the SQLite commit. All storage access goes
 * through drizzle's durable-sqlite driver, which is fully SYNCHRONOUS
 * (`.get()`/`.all()`/`.run()`, and `db.transaction` wraps
 * `storage.transactionSync` with a non-async callback — an `await` inside it
 * is a syntax error, which is the §3.4 guarantee made structural). The one
 * sanctioned non-storage await near the gate is the §4.1 lazy init, inside
 * `blockConcurrencyWhile` on first contact.
 *
 * The deadline alarm is the ONLY `setAlarm` client (§8) — a stray call would
 * silently unarm the turn deadline.
 */

import { DurableObject } from "cloudflare:workers";
import { type CommitPlan, commit, DEADLINE_GRACE_MS, fanOutObservations, GameBugError, type GameStatus, type Intent, isRejected, type ObservationFrame, parseStoredPayload, type RatingDelta, randomSeed, type Seat, type SeatView, type StateRow, type TransitionAction } from "@eigen/kernel";
import type { GameModule, GameRules, JsonObject, OutcomeEntry, TransitionCause } from "@eigen/rules";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { type DrizzleSqliteDODatabase, drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { applyFinish, readGameRow, updateSummary } from "../d1/apply.js";
import type { Command, CommandResult, FrameMessage } from "../protocol.js";
import migrations from "./migrations/migrations.js";
import * as t from "./schema.js";

type MetaRow = typeof t.meta.$inferSelect;
type TransitionRow = typeof t.transitions.$inferSelect;

function seatTag(seat: number): string {
  return `seat:${seat}`;
}

export abstract class BaseGameDO<TEnv> extends DurableObject<TEnv> {
  /** The implementor's game — the `versions` map the engine dispatches on. */
  protected abstract readonly gameModule: GameModule;
  /** The EngineConfig seam: the engine never assumes binding names — the
   * subclass picks the D1 database off its own Env. */
  protected abstract d1(env: TEnv): D1Database;

  readonly #db: DrizzleSqliteDODatabase;

  constructor(ctx: DurableObjectState, env: TEnv) {
    super(ctx, env);
    this.#db = drizzle(ctx.storage);
    // Schema is engine-owned and self-applying: every activation (including
    // a finished game woken years later) migrates itself before any event.
    ctx.blockConcurrencyWhile(async () => {
      await migrate(this.#db, migrations);
    });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  // ── Commands (worker → DO, §3.3) ──────────────────────────────────────────

  async handle(cmd: Command): Promise<CommandResult> {
    await this.#ensureInit(cmd.gameId);
    const stored = this.#storedResponse(cmd.commandId);
    if (stored !== null) return stored;

    switch (cmd.kind) {
      case "join":
      case "leave":
      case "cancel":
      case "add-bot":
        throw new Error(`Command '${cmd.kind}' is not implemented yet (waiting-room milestone)`);
      default:
        return await this.#commitCommand(cmd);
    }
  }

  async #commitCommand(cmd: Extract<Command, { kind: "start" | "action" | "lifecycle" }>): Promise<CommandResult> {
    const meta = this.#meta();
    const roster = this.#roster();
    const latest = this.#latestTransition();
    const state = latest === null ? null : this.#toStateRow(latest, meta);
    const intent = this.#toIntent(cmd, meta, roster);
    const now = Date.now();

    const result = commit({
      game: meta,
      state,
      roster,
      intent,
      now,
      rules: this.#rules(meta),
      staleViews: this.#staleViews(cmd, latest),
    });
    if (isRejected(result)) {
      return { ok: false, code: result.code, message: result.message };
    }
    return await this.#apply(cmd, meta, roster, result, now);
  }

  /** DO-side integrity (§4.2): the worker did policy before minting; the
   * DO still refuses a command whose actor doesn't own what it claims.
   * These are protocol violations, not gameplay rejections — they throw. */
  #toIntent(cmd: Extract<Command, { kind: "start" | "action" | "lifecycle" }>, meta: MetaRow, roster: Seat[]): Intent {
    switch (cmd.kind) {
      case "start": {
        if (meta.createdBy !== null && cmd.actor.userId !== meta.createdBy) {
          throw new Error("Only the creator can start the game");
        }
        return { kind: "start", seed: randomSeed() };
      }
      case "action": {
        this.#assertSeat(roster, cmd.seat, cmd.actor);
        return {
          kind: "action",
          seat: cmd.seat,
          expectedVersion: cmd.expectedVersion,
          data: cmd.data,
          actor: cmd.actor.botId !== null ? "bot" : "user",
        };
      }
      case "lifecycle": {
        if (cmd.type === "timeout") return { kind: "lifecycle", type: "timeout" };
        if (cmd.seat === undefined) throw new Error(`Lifecycle '${cmd.type}' requires a seat`);
        if (cmd.type === "forfeit") {
          if (cmd.actor === null) throw new Error("Forfeit requires an actor");
          this.#assertSeat(roster, cmd.seat, cmd.actor);
        }
        return { kind: "lifecycle", type: cmd.type, seat: cmd.seat };
      }
    }
  }

  #assertSeat(roster: Seat[], seat: number, actor: { userId: string | null; botId: string | null }): void {
    const row = roster.find((s) => s.player_index === seat);
    const owns = row !== undefined && ((actor.userId !== null && row.user_id === actor.userId) || (actor.botId !== null && row.bot_id === actor.botId));
    if (!owns) throw new Error(`Seat ${seat} does not belong to the acting principal`);
  }

  /** Same-view material (§3.5): the acting seat's stored frames at the
   * expected and current versions. Only needed for a stale action. */
  #staleViews(cmd: Command, latest: TransitionRow | null): { expected: SeatView | null; current: SeatView | null } | undefined {
    if (cmd.kind !== "action" || latest === null || cmd.expectedVersion >= latest.version) return undefined;
    return {
      expected: this.#storedView(cmd.expectedVersion, cmd.seat),
      current: this.#storedView(latest.version, cmd.seat),
    };
  }

  /** Apply the plan — ONE SQLite transaction, gate held (§3.4). Everything
   * after the transaction is post-commit: interleaving is harmless. */
  async #apply(cmd: Extract<Command, { kind: "start" | "action" | "lifecycle" }>, meta: MetaRow, roster: Seat[], plan: CommitPlan, now: number): Promise<CommandResult> {
    const next = plan.nextState;
    const finish = plan.outcomes === null ? null : { outcomes: plan.outcomes, finishId: crypto.randomUUID() };
    const status: GameStatus = finish === null ? "active" : "finished";
    const actingSeat = cmd.kind === "action" ? cmd.seat : cmd.kind === "lifecycle" && cmd.type === "forfeit" && cmd.seat !== undefined ? cmd.seat : null;
    const ownFrame = actingSeat === null ? null : (plan.frames.find((f) => f.player_index === actingSeat) ?? null);
    const response: CommandResult = {
      ok: true,
      version: next.version,
      frame: ownFrame === null ? null : this.#wireFrame(ownFrame, next, plan.outcomes),
    };

    this.#db.transaction((tx) => {
      tx.insert(t.transitions)
        .values({
          version: next.version,
          state: next.state,
          action: plan.action,
          pending: next.pending,
          deadline: next.deadline,
          playerTimes: next.playerTimes,
          turnStartedAt: next.turnStartedAt,
        })
        .run();
      // Every transition writes its frames and its dedupe row, uniformly —
      // no finish special case. Compaction is NOT here: live tables drain
      // when the outbox clears (§4.5, `#commitRatingsTransition`).
      if (plan.frames.length > 0) {
        tx.insert(t.frames).values(this.#frameRows(next.version, plan.frames)).run();
      }
      tx.insert(t.commands).values({ commandId: cmd.commandId, response, createdAt: now }).run();
      if (cmd.kind === "start") {
        tx.update(t.meta).set({ status, rngSeed: next.rngSeed }).where(eq(t.meta.id, 1)).run();
      } else if (status !== meta.status) {
        tx.update(t.meta).set({ status }).where(eq(t.meta.id, 1)).run();
      }
      if (finish !== null) {
        tx.insert(t.outbox).values({ finishId: finish.finishId, outcomes: finish.outcomes, createdAt: now }).run();
      }
    });

    // ── post-commit ──
    this.#fanOut(plan.frames, next, plan.outcomes);
    if (plan.alarm !== null) {
      await this.ctx.storage.setAlarm(plan.alarm);
    } else {
      await this.ctx.storage.deleteAlarm();
    }
    const gameId = meta.gameId;
    if (finish !== null) {
      this.ctx.waitUntil(this.#finishEffects(meta, roster, finish.outcomes, finish.finishId, next));
    } else {
      this.ctx.waitUntil(
        updateSummary(this.d1(this.env), {
          gameId,
          ...(cmd.kind === "start" ? { status: "active" as const } : {}),
          pendingPlayers: next.pending,
          turnDeadline: next.deadline,
          now,
        }).catch((error) => console.error(`summary upsert failed for game ${gameId}`, error)),
      );
    }
    return response;
  }

  // ── Finish (§4.5 steps 3–4) ───────────────────────────────────────────────

  async #finishEffects(meta: MetaRow, roster: Seat[], outcomes: OutcomeEntry[], finishId: string, finalState: StateRow): Promise<void> {
    try {
      const deltas = await applyFinish(this.d1(this.env), {
        gameId: meta.gameId,
        finishId,
        outcomes,
        roster,
        rated: meta.rated,
        ratingPool: meta.ratingPool,
        now: Date.now(),
      });
      this.#commitRatingsTransition(meta, roster, finalState, deltas);
    } catch (error) {
      // Single attempt (§8): the outbox row is the recovery signal; a gated
      // admin re-poke re-runs the apply, idempotent via finish_id.
      console.error(`finish apply failed for game ${meta.gameId} (finish_id ${finishId}); outbox retained`, error);
    }
  }

  /** After a successful D1 apply: append the ratings transition N+1 (rated
   * games), then complete the pipeline — §4.5 **compaction rides the outbox
   * clear**, one storage transaction: the live-only `frames` and `commands`
   * tables drain exactly when the outbox does (one invariant: outbox present
   * ⟺ live rows may remain ⟺ finish effects pending). Then fan out.
   * Safe post-await: a finished game accepts no mutating commands, so
   * nothing can have moved the chain since the finish committed. */
  #commitRatingsTransition(meta: MetaRow, roster: Seat[], finalState: StateRow, deltas: RatingDelta[] | null): void {
    if (deltas === null) {
      this.#db.transaction((tx) => {
        tx.delete(t.frames).run();
        tx.delete(t.commands).run();
        tx.delete(t.outbox).run();
      });
      return;
    }
    const version = finalState.version + 1;
    // Engine-owned action variant — no game hook produces or ever sees it.
    const action: TransitionAction = { type: "system", kind: "ratings", data: { deltas }, player_index: null };
    const frames = this.#project(meta, roster, finalState.state, [], null, false);
    this.#db.transaction((tx) => {
      tx.insert(t.transitions).values({ version, state: finalState.state, action, pending: [], deadline: null, playerTimes: null, turnStartedAt: null }).run();
      // Uniform like every transition — and drained one statement later by
      // the compaction, kept ceremony-free on purpose: zero special cases
      // beats saving a doomed write.
      if (frames.length > 0) {
        tx.insert(t.frames).values(this.#frameRows(version, frames)).run();
      }
      tx.delete(t.frames).run();
      tx.delete(t.commands).run();
      tx.delete(t.outbox).run();
    });
    for (const frame of frames) {
      const message: FrameMessage = {
        type: "frame",
        version,
        data: frame.data,
        pending_players: frame.pending_players,
        deadline: null,
        player_times: null,
        ratings: deltas,
      };
      this.#send(frame.player_index, message);
    }
  }

  /** The gated admin re-poke (§4.5 step 4, §8): re-runs the D1 apply for a
   * finish whose effects never landed. Idempotent end to end — finish_id
   * dedupes the apply, and the outbox row exists iff the ratings transition
   * hasn't been committed. Returns false when there is nothing to do. */
  async repokeFinish(): Promise<boolean> {
    const meta = this.#meta();
    const row = this.#db.select().from(t.outbox).get();
    if (row === undefined) return false;
    const latest = this.#latestTransition();
    if (latest === null) throw new GameBugError("outbox row exists but no transitions");
    await this.#finishEffects(meta, this.#roster(), row.outcomes, row.finishId, this.#toStateRow(latest, meta));
    return this.#db.select({ finishId: t.outbox.finishId }).from(t.outbox).get() === undefined;
  }

  // ── Deadline alarm (§4.4) — the ONLY alarm client ─────────────────────────

  async alarm(): Promise<void> {
    const meta = this.#loadMeta();
    if (meta === undefined || meta.status !== "active") return;
    const latest = this.#latestTransition();
    if (latest === null) return;
    // Deterministic commandId: a double fire dedupes; a raced action makes
    // the kernel abstain (§4.4: whichever arrives first commits).
    await this.handle({
      kind: "lifecycle",
      type: "timeout",
      gameId: meta.gameId,
      commandId: `timeout:v${latest.version}:${latest.deadline ?? 0}`,
      actor: null,
    });
  }

  // ── Sockets (hibernating, §4.2/§4.3) ──────────────────────────────────────

  /** The worker routes the upgrade here after authenticating; the seat
   * header is worker-set (never client-supplied — the worker strips inbound
   * headers when forwarding). Null seat = a seated-later lobby socket. */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }
    const gameId = request.headers.get("x-eigen-game");
    if (gameId === null) return new Response("Missing game id", { status: 400 });
    await this.#ensureInit(gameId);
    const seatHeader = request.headers.get("x-eigen-seat");
    const seat = seatHeader === null ? null : Number.parseInt(seatHeader, 10);

    const pair = new WebSocketPair();
    pair[1].serializeAttachment({ seat });
    this.ctx.acceptWebSocket(pair[1], seat === null ? [] : [seatTag(seat)]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(): Promise<void> {
    // Client → server traffic rides HTTP commands; ping/pong is handled by
    // the auto-responder without waking the DO. Anything else is ignored.
  }

  async webSocketClose(): Promise<void> {
    // Handler required by the runtime when a close frame arrives; the reply
    // itself is automatic (`web_socket_auto_reply_to_close`, default on our
    // compatibility date), so there is nothing to do.
  }

  async webSocketError(_ws: WebSocket, error: unknown): Promise<void> {
    // The client's reconnect problem; frames are recoverable by range fetch.
    console.error("game socket errored", error);
  }

  #fanOut(frames: ObservationFrame[], next: StateRow, outcomes: OutcomeEntry[] | null): void {
    for (const frame of frames) {
      this.#send(frame.player_index, this.#wireFrame(frame, next, outcomes));
    }
  }

  #send(seat: number, message: FrameMessage): void {
    const payload = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets(seatTag(seat))) {
      try {
        ws.send(payload);
      } catch {
        // A dead socket is the client's reconnect problem; frames are
        // recoverable by range fetch.
      }
    }
  }

  #wireFrame(frame: ObservationFrame, next: StateRow, outcomes: OutcomeEntry[] | null): FrameMessage {
    return {
      type: "frame",
      version: next.version,
      data: frame.data,
      pending_players: frame.pending_players,
      deadline: next.deadline,
      player_times: next.playerTimes,
      ...(outcomes !== null ? { outcomes } : {}),
    };
  }

  // ── Range fetch (§4.6): live gap recovery AND finished-game replay ────────

  /** Project a version range for one seat (null = public viewer, replay
   * only). Live rows serve the stored frame; compacted/ratings rows
   * re-project. Raw state never leaves the DO. */
  async frames(args: { seat: number | null; from: number; to: number; isReplay?: boolean }): Promise<FrameMessage[]> {
    const meta = this.#meta();
    const roster = this.#roster();
    const isReplay = args.isReplay ?? false;
    const out: FrameMessage[] = [];
    const rows = this.#db
      .select()
      .from(t.transitions)
      .where(and(gte(t.transitions.version, args.from), lte(t.transitions.version, args.to)))
      .orderBy(t.transitions.version)
      .all();
    // Live path: one range read of the seat's stored frames (empty
    // post-compaction and for replay — those re-project below).
    const stored = new Map<number, SeatView>();
    if (args.seat !== null && !isReplay) {
      const frameRows = this.#db
        .select()
        .from(t.frames)
        .where(and(eq(t.frames.playerIndex, args.seat), gte(t.frames.version, args.from), lte(t.frames.version, args.to)))
        .all();
      for (const f of frameRows) stored.set(f.version, { data: f.data, pending_players: f.pendingPlayers });
    }
    for (const row of rows) {
      const ratings = row.action !== null && row.action.kind === "ratings" ? row.action.data.deltas : null;
      const storedView = ratings === null ? stored.get(row.version) : undefined;
      const view = storedView ?? this.#viewFor(meta, roster, row, args.seat, isReplay);
      if (view === null) continue;
      out.push({
        type: "frame",
        version: row.version,
        data: view.data,
        pending_players: view.pending_players,
        deadline: row.deadline,
        player_times: row.playerTimes,
        ...(ratings !== null ? { ratings } : {}),
      });
    }
    return out;
  }

  #viewFor(meta: MetaRow, roster: Seat[], row: TransitionRow, seat: number | null, isReplay: boolean): SeatView | null {
    const cause = this.#causeOf(row.action);
    if (seat === null) {
      const rules = this.#rules(meta);
      const config = parseStoredPayload(rules.schemas.config, meta.config, "config", meta.schemaVersion);
      const slice = rules.computeObservation({
        state: parseStoredPayload(rules.schemas.state, row.state, "state", meta.schemaVersion),
        pending: row.pending,
        playerIndex: null,
        participantCount: roster.length,
        config,
        cause,
        isReplay,
      });
      return { data: slice.data, pending_players: slice.pending_players };
    }
    const frame = this.#project(meta, roster, row.state, row.pending, cause, isReplay).find((f) => f.player_index === seat);
    return frame === undefined ? null : { data: frame.data, pending_players: frame.pending_players };
  }

  /** The game-hook cause vocabulary; the engine-owned ratings row has none. */
  #causeOf(action: TransitionAction | null): TransitionCause {
    if (action === null || action.kind === "ratings") return null;
    if (action.kind === "game") {
      return { kind: "game", data: action.data, playerIndex: action.player_index };
    }
    return { kind: "lifecycle", data: action.data };
  }

  #project(meta: MetaRow, roster: Seat[], state: JsonObject, pending: number[], cause: TransitionCause, isReplay: boolean): ObservationFrame[] {
    const rules = this.#rules(meta);
    const identified = new Set(roster.filter((s) => s.user_id !== null || s.bot_id !== null).map((s) => s.player_index));
    return fanOutObservations(rules, {
      state,
      pending,
      participantCount: roster.length,
      config: parseStoredPayload(rules.schemas.config, meta.config, "config", meta.schemaVersion),
      cause,
      isReplay,
    }).filter((f) => identified.has(f.player_index));
  }

  // ── Lazy init (§4.1) & snapshot loads ─────────────────────────────────────

  /** First contact: copy the D1 game row into `meta` + `roster`. The one
   * sanctioned non-storage await near the gate — `blockConcurrencyWhile`
   * holds ALL events, so nothing interleaves, and it runs once per game. */
  async #ensureInit(gameId: string): Promise<void> {
    if (this.#loadMeta() !== undefined) return;
    await this.ctx.blockConcurrencyWhile(async () => {
      if (this.#loadMeta() !== undefined) return;
      const row = await readGameRow(this.d1(this.env), gameId);
      if (row === undefined) throw new Error(`Unknown game ${gameId}`);
      this.#db.transaction((tx) => {
        tx.insert(t.meta)
          .values({
            id: 1,
            gameId: row.id,
            status: row.status,
            access: row.access,
            schemaVersion: row.schemaVersion,
            config: row.config,
            turnSeconds: row.turnSeconds,
            budgetSeconds: row.budgetSeconds,
            incrementSeconds: row.incrementSeconds,
            rated: row.rated,
            ratingPool: row.ratingPool,
            minPlayers: row.minPlayers,
            maxPlayers: row.maxPlayers,
            createdBy: row.createdBy,
            rngSeed: null,
          })
          .run();
        for (const seat of row.participants) {
          tx.insert(t.roster).values({ playerIndex: seat.player_index, userId: seat.user_id, botId: seat.bot_id, type: seat.type }).run();
        }
      });
    });
  }

  #rules(meta: MetaRow): GameRules {
    const rules = this.gameModule.versions[meta.schemaVersion];
    if (rules === undefined) {
      throw new GameBugError(`No rules unit for schema_version ${meta.schemaVersion}`);
    }
    return rules;
  }

  #meta(): MetaRow {
    const meta = this.#loadMeta();
    if (meta === undefined) throw new GameBugError("GameDO used before lazy init");
    return meta;
  }

  #loadMeta(): MetaRow | undefined {
    return this.#db.select().from(t.meta).where(eq(t.meta.id, 1)).get();
  }

  #roster(): Seat[] {
    return this.#db.select({ player_index: t.roster.playerIndex, user_id: t.roster.userId, bot_id: t.roster.botId, type: t.roster.type }).from(t.roster).orderBy(t.roster.playerIndex).all();
  }

  #latestTransition(): TransitionRow | null {
    return this.#db.select().from(t.transitions).orderBy(desc(t.transitions.version)).limit(1).get() ?? null;
  }

  #toStateRow(row: TransitionRow, meta: MetaRow): StateRow {
    if (meta.rngSeed === null) throw new GameBugError("transitions exist but meta has no rng_seed");
    return {
      version: row.version,
      state: row.state,
      pending: row.pending,
      rngSeed: meta.rngSeed,
      deadline: row.deadline,
      playerTimes: row.playerTimes,
      turnStartedAt: row.turnStartedAt,
    };
  }

  /** Frame rows for one transition's per-seat fan-out. */
  #frameRows(version: number, frames: ObservationFrame[]) {
    return frames.map((f) => ({ version, playerIndex: f.player_index, data: f.data, pendingPlayers: f.pending_players }));
  }

  /** One seat's stored live frame at one version — the frames-table PK. */
  #storedView(version: number, seat: number): SeatView | null {
    const row = this.#db
      .select()
      .from(t.frames)
      .where(and(eq(t.frames.version, version), eq(t.frames.playerIndex, seat)))
      .get();
    return row === undefined ? null : { data: row.data, pending_players: row.pendingPlayers };
  }

  #storedResponse(commandId: string): CommandResult | null {
    const row = this.#db.select({ response: t.commands.response }).from(t.commands).where(eq(t.commands.commandId, commandId)).get();
    return row?.response ?? null;
  }
}

/** The grace constant re-exported for hosts arming display timers. */
export { DEADLINE_GRACE_MS };
