/**
 * The game's Durable Object: its serialized session AND its permanent
 * database. One DO per gameId, addressed by
 * `idFromName(gameId)`. Implementors subclass {@link BaseGameDO}, the
 * platform-idiomatic shape (cf. `agents`' `Agent`, partyserver's `Server`):
 *
 * ```ts
 * export class GameDO extends BaseGameDO<Env> {
 *   protected readonly gameModule = myGame;
 *   protected d1(env: Env) { return env.MY_D1; }
 * }
 * ```
 *
 * Concurrency model: the input gate serializes commands PROVIDED no
 * non-storage await sits between reading and writing storage. `handle()` is
 * therefore shaped read → pure kernel commit → one storage transaction, with
 * every network effect (fan-out is in-memory, D1/alarms are storage or
 * post-commit) strictly after the SQLite commit. All storage access goes
 * through drizzle's durable-sqlite driver, which is fully SYNCHRONOUS
 * (`.get()`/`.all()`/`.run()`, and `db.transaction` wraps
 * `storage.transactionSync` with a non-async callback, so an `await` inside it
 * is a syntax error, which is the guarantee made structural). The one
 * sanctioned non-storage await near the gate is the lazy init, inside
 * `blockConcurrencyWhile` on first contact.
 *
 * The deadline alarm is the ONLY `setAlarm` client; a stray call would
 * silently unarm the turn deadline.
 */

import { DurableObject } from "cloudflare:workers";
import {
  assertHookPayload,
  type CommitPlan,
  commit,
  DEADLINE_GRACE_MS,
  deriveRng,
  fanOutObservations,
  GameBugError,
  type GameStatus,
  type Intent,
  isRejected,
  type ObservationFrame,
  parseStoredPayload,
  type RatingDelta,
  randomSeed,
  type Seat,
  type SeatView,
  type StateRow,
  type TransitionAction,
} from "@eigeninteractive/kernel";
import type { GameModule, GameRules, JsonObject, ObservationSlice, OutcomeEntry, TransitionCause } from "@eigeninteractive/rules";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { type DrizzleSqliteDODatabase, drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { signForBot } from "../bot/bot-auth.js";
import { applyFinish, mirrorRoster, readGameRow, updateSummary } from "../d1/apply.js";
import { type Bot, readBot } from "../d1/reads.js";
import { withRetry } from "../d1/retry.js";
import { type FirebaseAdminEffects, firebaseAdminFromEnv } from "../firebase/admin-effects.js";
import { finishPush, readyPush, turnPush } from "../notify/push.js";
import type { Command, CommandResult, FrameMessage, GameStub, Principal, SessionSnapshot } from "../protocol.js";
import migrations from "./migrations/migrations.js";
import * as t from "./schema.js";

/** Caps how long the fire-and-forget wake holds its outbound connection for a
 * slow or hanging bot webhook. Not a correctness deadline: we never wait
 * for the bot's move (it arrives on `/api/bot/action`) and a lost wake rides
 * the turn deadline; this is purely a resource bound. */
const WAKE_TIMEOUT_MS = 10_000;

type MetaRow = typeof t.meta.$inferSelect;
type TransitionRow = typeof t.transitions.$inferSelect;

/** What each hibernating socket remembers: the authenticated
 * principal only. Seats are resolved against the CURRENT roster at every
 * send, so a socket opened pre-join starts receiving its seat's frames the
 * moment its user is seated, with no re-tagging machinery. */
interface SocketAttachment {
  userId: string | null;
}

// `implements GameStub` is the drift guard: the worker calls the DO through the
// hand-written `GameStub` surface, which the generic-erased RouteContext
// needs in place of `DurableObjectStub<this>`. This clause makes the compiler
// reject any signature here that diverges from what the callers expect.
/**
 * Durable Object base class that owns one authoritative game session.
 *
 * A game Worker subclasses this once to supply its {@link gameModule} and D1
 * binding. Do not override command, socket, alarm, or persistence behavior:
 * the base class owns the serialized game loop and applies engine migrations
 * on activation.
 *
 * @example
 * ```ts
 * export class GameDO extends BaseGameDO<Env> {
 *   protected readonly gameModule = gameModule;
 *   protected d1(env: Env) {
 *     return env.GAME_DB;
 *   }
 * }
 * ```
 */
export abstract class BaseGameDO<TEnv> extends DurableObject<TEnv> implements GameStub {
  /** The implementor's game: the `versions` map the engine dispatches on. */
  protected abstract readonly gameModule: GameModule;
  /** The EngineConfig seam: the engine never assumes binding names, so the
   * subclass picks the D1 database off its own Env. */
  protected abstract d1(env: TEnv): D1Database;
  /** Required Firebase Admin effects. Tests override this with the explicit
   * fake exported by `@eigeninteractive/server/testing`. */
  protected firebaseAdmin(env: TEnv): FirebaseAdminEffects {
    return firebaseAdminFromEnv(env);
  }

  readonly #db: DrizzleSqliteDODatabase;

  constructor(ctx: DurableObjectState, env: TEnv) {
    super(ctx, env);
    this.#db = drizzle(ctx.storage, { casing: "snake_case" });
    // Schema is engine-owned and self-applying: every activation (including
    // a finished game woken years later) migrates itself before any event.
    ctx.blockConcurrencyWhile(async () => {
      await migrate(this.#db, migrations);
    });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  // ── Commands (worker → DO) ──────────────────────────────────────────

  async handle(cmd: Command): Promise<CommandResult> {
    if (!(await this.#ensureInit(cmd.gameId))) {
      return { ok: false, code: "unknownGame", message: "No game with this id" };
    }
    const stored = this.#storedResponse(cmd.commandId);
    if (stored !== null) return stored;

    switch (cmd.kind) {
      case "join":
      case "leave":
      case "add-bot":
        return this.#lobbyCommand(cmd);
      case "cancel":
        return await this.#cancel(cmd);
      default:
        return await this.#commitCommand(cmd);
    }
  }

  // ── Waiting room: integrity under the gate ─────────────────────────

  /** The DO column for join/leave/add-bot: status + seat integrity
   * checks, roster rewrite, ready/waiting threshold: one synchronous storage
   * transaction, then the snapshot push and the D1 mirror post-commit.
   * Refusals here are *expected* lobby races (accepted staleness: the lobby
   * may show a game that just filled), so they come back as values. */
  #lobbyCommand(cmd: Extract<Command, { kind: "join" | "leave" | "add-bot" }>): CommandResult {
    const meta = this.#meta();
    const roster = this.#roster();
    const now = Date.now();

    if (meta.status !== "waiting" && meta.status !== "ready") {
      return { ok: false, code: "notJoinable", message: `Game is ${meta.status}` };
    }

    let nextRoster: Seat[];
    switch (cmd.kind) {
      case "join": {
        if (roster.some((s) => s.userId !== null && s.userId === cmd.actor.userId)) {
          return { ok: false, code: "alreadyJoined", message: "Already seated in this game" };
        }
        if (roster.length >= meta.maxPlayers) {
          return { ok: false, code: "gameFull", message: "Game is full" };
        }
        nextRoster = [...roster, { playerIndex: roster.length, userId: cmd.actor.userId, botId: null, type: "human" }];
        break;
      }
      case "leave": {
        if (cmd.actor.userId !== null && cmd.actor.userId === meta.createdBy) {
          return { ok: false, code: "creatorCannotLeave", message: "The creator cancels the game instead of leaving it" };
        }
        const seat = roster.find((s) => s.userId !== null && s.userId === cmd.actor.userId);
        if (seat === undefined) {
          return { ok: false, code: "notParticipant", message: "Not seated in this game" };
        }
        // Compact the indexes, safe pre-start only, which lobby
        // statuses guarantee: no frames or transitions reference seats yet.
        nextRoster = roster.filter((s) => s.playerIndex !== seat.playerIndex).map((s, i) => ({ ...s, playerIndex: i }));
        break;
      }
      case "add-bot": {
        if (meta.createdBy !== null && cmd.actor.userId !== meta.createdBy) {
          return { ok: false, code: "notCreator", message: "Only the creator can add a bot" };
        }
        if (roster.length >= meta.maxPlayers) {
          return { ok: false, code: "gameFull", message: "Game is full" };
        }
        nextRoster = [...roster, { playerIndex: roster.length, userId: null, botId: cmd.botId, type: "bot" }];
        break;
      }
    }

    const status: GameStatus = nextRoster.length >= meta.minPlayers ? "ready" : "waiting";
    const seq = meta.seq + 1;
    // A lobby command has no version and no frame, so every seat's snapshot is
    // the same value; the actor's copy is also the command response.
    const header = this.#header(meta, { status, players: nextRoster, seq, version: null });
    const response: CommandResult = { ok: true, session: { ...header, frame: null } };
    this.#db.transaction((tx) => {
      tx.delete(t.roster).run();
      for (const seat of nextRoster) {
        tx.insert(t.roster).values({ playerIndex: seat.playerIndex, userId: seat.userId, botId: seat.botId, type: seat.type }).run();
      }
      tx.update(t.meta)
        .set({ seq, ...(status !== meta.status ? { status } : {}) })
        .where(eq(t.meta.id, 1))
        .run();
      tx.insert(t.commands).values({ commandId: cmd.commandId, response, createdAt: now }).run();
    });

    // ── post-commit ──
    this.#broadcast(header, new Map(), nextRoster);
    const gameId = meta.gameId;
    // Background D1 mirror, off the response path. No ctx.waitUntil: a Durable
    // Object stays alive while a promise is pending, so an unawaited (but
    // .catch-guarded) promise runs to completion on its own; waitUntil is a
    // stateless-Worker idiom that's redundant here.
    this.#mirrorD1(`roster mirror for game ${gameId}`, () => mirrorRoster(this.d1(this.env), { gameId, status, seats: nextRoster, now }));
    // A join that just filled the lobby: nudge the away creator to start. Skip
    // when the actor is the creator (they filled it themselves via add-bot, so
    // they are already here). Best-effort, like the mirror above.
    if (status === "ready" && meta.status !== "ready" && meta.createdBy !== null && cmd.actor.userId !== meta.createdBy) {
      this.#pushReady(meta.createdBy, gameId);
    }
    return response;
  }

  /** Cancel: creator-only, lobby statuses only; status → `aborted` and
   * the DO's storage is dropped, since nothing is worth retaining and the D1 row alone
   * serves history lists. The D1 mirror is AWAITED here (unlike every other
   * lobby effect): the aborted games row is the only survivor, so its write
   * failing must fail the command; a retry re-enters through the `aborted`
   * branch and completes idempotently. */
  async #cancel(cmd: Extract<Command, { kind: "cancel" }>): Promise<CommandResult> {
    const meta = this.#meta();
    if (meta.status !== "waiting" && meta.status !== "ready" && meta.status !== "aborted") {
      return { ok: false, code: "notJoinable", message: `Game is ${meta.status}` };
    }
    if (meta.createdBy !== null && cmd.actor.userId !== meta.createdBy) {
      return { ok: false, code: "notCreator", message: "Only the creator can cancel the game" };
    }
    // Terminal status lands in storage first: anything interleaving with the
    // awaits below already sees an aborted game.
    if (meta.status !== "aborted") {
      this.#db
        .update(t.meta)
        .set({ status: "aborted", seq: meta.seq + 1 })
        .where(eq(t.meta.id, 1))
        .run();
    }
    const session = { ...this.#header(meta, { status: "aborted", players: [], seq: meta.seq + 1, version: null }), frame: null };
    await this.#tearDownAborted(meta.gameId, "Game cancelled", session);
    return { ok: true, session };
  }

  /** Unconditional teardown (cron reap): mark the game aborted in D1 and
   * drop the DO's storage: no creator gate, no init requirement. A
   * never-touched lobby's DO has no `meta` row, so the caller passes the
   * gameId. Idempotent: a re-run re-aborts a game whose storage is already
   * gone. Used by the cron; `cancel` shares the teardown for its live path. */
  async abort(gameId: string): Promise<void> {
    // If this DO is live, flip its status synchronously first (gate-held) so a
    // command interleaving with the teardown's awaits sees an aborted game.
    const meta = this.#loadMeta();
    if (meta !== undefined && meta.status !== "aborted") {
      this.#db
        .update(t.meta)
        .set({ status: "aborted", seq: meta.seq + 1 })
        .where(eq(t.meta.id, 1))
        .run();
    }
    // A never-touched lobby has no meta row, so there is no header to build and
    // no socket to tell: the aborted D1 row is the whole outcome.
    const session = meta === undefined ? null : { ...this.#header(meta, { status: "aborted", players: [], seq: meta.seq + 1, version: null }), frame: null };
    await this.#tearDownAborted(gameId, "Game aborted", session);
  }

  /** The shared abort teardown: mirror the aborted status to D1 (the only
   * survivor, awaited so a failure surfaces), notify and close any sockets,
   * then drop the alarm and all storage. The schema goes with the storage, so
   * restore it; a later poke lazy-re-inits from the aborted D1 row. */
  async #tearDownAborted(gameId: string, closeReason: string, session: SessionSnapshot | null): Promise<void> {
    await mirrorRoster(this.d1(this.env), { gameId, status: "aborted", seats: [], now: Date.now() });
    // Told before the sockets close, and `seq` cannot help a client that misses
    // it, since the teardown drops the storage the counter lived in. That is why
    // the client's rule accepts a terminal status whatever its `seq`.
    if (session !== null) this.#sendToAll(session);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(1000, closeReason);
      } catch {
        // Already closing, nothing to do.
      }
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    await migrate(this.#db, migrations);
  }

  async #commitCommand(cmd: Extract<Command, { kind: "start" | "action" | "lifecycle" }>): Promise<CommandResult> {
    const meta = this.#meta();
    const roster = this.#roster();
    // Creator-only start: a clean rejection, not a throw. Any seated
    // client can reach this without a protocol violation.
    if (cmd.kind === "start" && meta.createdBy !== null && cmd.actor.userId !== meta.createdBy) {
      return { ok: false, code: "notCreator", message: "Only the creator can start the game" };
    }
    let actingSeat: number | null = null;
    if (cmd.kind === "action" || (cmd.kind === "lifecycle" && cmd.type === "forfeit")) {
      if (cmd.actor === null) throw new GameBugError("action/forfeit reached the DO without an actor");
      if (cmd.seat === undefined) throw new GameBugError("action/forfeit reached the DO without a seat");
      const resolved = this.#actingSeat(cmd.actor, cmd.seat, roster);
      if (typeof resolved !== "number") return resolved;
      actingSeat = resolved;
    }
    const latest = this.#latestTransition();
    const state = latest === null ? null : this.#toStateRow(latest, meta);
    const intent = this.#toIntent(cmd, actingSeat);
    const now = Date.now();

    const result = commit({
      game: meta,
      state,
      roster,
      intent,
      now,
      rules: this.#rules(meta),
      staleViews: this.#staleViews(cmd, actingSeat, latest),
    });
    if (isRejected(result)) {
      return { ok: false, code: result.code, message: result.message };
    }
    return await this.#apply(cmd, meta, roster, result, now, actingSeat);
  }

  /** Verify the acting seat against the authoritative roster; the D1
   * participants copy is a display mirror and never arbitrates. Both humans
   * and bots name their seat; it must belong to the actor (user id from the
   * token, bot id from the HMAC claim). A seat the actor does not hold is
   * reachable without malice (a stale UI after leaving, a buggy client) and
   * from a misbehaving external bot alike, so the refusal is a clean value
   * (→ 403), never a throw. */
  #actingSeat(actor: Principal, seat: number, roster: Seat[]): number | CommandResult {
    const row = roster.find((s) => s.playerIndex === seat);
    const owns = row !== undefined && ((actor.userId !== null && row.userId === actor.userId) || (actor.botId !== null && row.botId === actor.botId));
    if (!owns) {
      return { ok: false, code: "notParticipant", message: "That seat is not yours" };
    }
    return seat;
  }

  #toIntent(cmd: Extract<Command, { kind: "start" | "action" | "lifecycle" }>, actingSeat: number | null): Intent {
    switch (cmd.kind) {
      case "start":
        return { kind: "start", seed: randomSeed() };
      case "action": {
        if (actingSeat === null) throw new GameBugError("action reached #toIntent without a resolved seat");
        return {
          kind: "action",
          seat: actingSeat,
          expectedVersion: cmd.expectedVersion,
          data: cmd.data,
          actor: cmd.actor.botId !== null ? "bot" : "user",
        };
      }
      case "lifecycle": {
        if (cmd.type === "timeout") return { kind: "lifecycle", type: "timeout" };
        const seat = actingSeat ?? cmd.seat;
        if (seat === undefined) throw new Error(`Lifecycle '${cmd.type}' requires a seat`);
        return { kind: "lifecycle", type: cmd.type, seat };
      }
    }
  }

  /** Same-view material: the acting seat's stored frames at the
   * expected and current versions. Only needed for a stale action. */
  #staleViews(cmd: Command, actingSeat: number | null, latest: TransitionRow | null): { expected: SeatView | null; current: SeatView | null } | undefined {
    if (cmd.kind !== "action" || actingSeat === null || latest === null || cmd.expectedVersion >= latest.version) return undefined;
    return {
      expected: this.#storedView(cmd.expectedVersion, actingSeat),
      current: this.#storedView(latest.version, actingSeat),
    };
  }

  /** Apply the plan: ONE SQLite transaction, gate held. Everything
   * after the transaction is post-commit: interleaving is harmless. */
  async #apply(cmd: Extract<Command, { kind: "start" | "action" | "lifecycle" }>, meta: MetaRow, roster: Seat[], plan: CommitPlan, now: number, actingSeat: number | null): Promise<CommandResult> {
    const next = plan.nextState;
    const finish = plan.outcomes === null ? null : { outcomes: plan.outcomes, finishId: crypto.randomUUID() };
    const status: GameStatus = finish === null ? "active" : "finished";
    const seq = meta.seq + 1;
    const header = this.#header(meta, { status, players: roster, seq, version: next.version });
    const wireFrames = this.#wireFrames(plan.frames, next, plan.outcomes);
    // The actor's own copy rides the response, which is what lets a move render
    // before the socket delivers it, and is the only delivery on the paths that
    // have no socket yet (a freshly created solo game, a move made mid-reconnect).
    const response: CommandResult = { ok: true, session: { ...header, frame: actingSeat === null ? null : (wireFrames.get(actingSeat) ?? null) } };

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
      // Every transition writes its frames and its dedupe row, uniformly,
      // with no finish special case. Compaction is NOT here: live tables drain
      // when the outbox clears (`#commitRatingsTransition`).
      if (plan.frames.length > 0) {
        tx.insert(t.frames).values(this.#frameRows(next.version, plan.frames)).run();
      }
      tx.insert(t.commands).values({ commandId: cmd.commandId, response, createdAt: now }).run();
      // `seq` advances on every commit; status and the seed only when they move.
      // `outcomes` is retained here, unlike the outbox row below that the
      // compaction drains, so a cold open of a finished game is answerable.
      tx.update(t.meta)
        .set({
          seq,
          ...(cmd.kind === "start" ? { status, rngSeed: next.rngSeed } : status !== meta.status ? { status } : {}),
          ...(finish !== null ? { outcomes: finish.outcomes } : {}),
        })
        .where(eq(t.meta.id, 1))
        .run();
      if (finish !== null) {
        tx.insert(t.outbox).values({ finishId: finish.finishId, outcomes: finish.outcomes, createdAt: now }).run();
      }
    });

    // ── post-commit ──
    this.#broadcast(header, wireFrames, roster);
    if (plan.alarm !== null) {
      await this.ctx.storage.setAlarm(plan.alarm);
    } else {
      await this.ctx.storage.deleteAlarm();
    }
    const gameId = meta.gameId;
    // Post-commit work runs off the response path. None of it is wrapped in
    // ctx.waitUntil: a Durable Object stays alive while any promise or I/O is
    // pending, so these unawaited promises run to completion on their own
    // (waitUntil is redundant in a DO; see the roster mirror above). Each keeps
    // its own .catch so a failure logs rather than becoming an unhandled
    // rejection. #finishEffects also self-catches; the outer .catch is a belt.
    if (finish !== null) {
      void this.#finishEffects(meta, roster, finish.outcomes, finish.finishId, next).catch((error) => console.error(`finish effects failed for game ${gameId}`, error));
    } else {
      this.#mirrorD1(`summary upsert for game ${gameId}`, () =>
        updateSummary(this.d1(this.env), {
          gameId,
          ...(cmd.kind === "start" ? { status: "active" as const } : {}),
          pendingPlayers: next.pending,
          turnDeadline: next.deadline,
          now,
        }),
      );
    }
    // Named post-commit effects: bot turns and human turn/finish pushes.
    if (plan.effects.length > 0) {
      void this.#dispatchEffects(meta, roster, plan, next).catch((error) => console.error(`effect dispatch failed for game ${gameId}`, error));
    }
    return response;
  }

  /** Fire a background D1 mirror write (roster / summary) off the response
   * path, retrying transient D1 failures.
   *
   * These rows are display-only and re-derivable, but they have no
   * reconciliation sweep, so a lost write stays stale until the next
   * transition. A bounded jittered retry recovers the common case, a
   * transient reset or network blip, while a deterministic failure still
   * surfaces once. Unawaited and self-catching: the DO stays alive for the
   * pending promise, so the backoff runs to completion without `waitUntil`. */
  #mirrorD1(label: string, write: () => Promise<void>): void {
    void withRetry(write, {
      onRetry: (error, attempt) => console.warn(`${label} failed (attempt ${attempt}), retrying`, error),
    }).catch((error) => console.error(`${label} failed after retries`, error));
  }

  // ── Post-commit effects: bot turns, and turn/finish pushes ──────────

  /** Deliver the kernel's named effects for a committed transition: a seated
   * bot's turn (in-DO brain self-apply, or an external HMAC wake) and human
   * turn/finish pushes. Single attempt + log throughout; a bot that
   * never moves rides the turn deadline (bots ⇒ timed). Runs post-commit as an
   * unawaited, self-catching promise (no `waitUntil`; see `#apply`). */
  async #dispatchEffects(meta: MetaRow, roster: Seat[], plan: CommitPlan, next: StateRow): Promise<void> {
    for (const effect of plan.effects) {
      if (effect.kind === "wakeBot") {
        await this.#botTurn(meta, plan, next, effect.seat, effect.botId);
      }
      // `notifyTurn` / `notifyFinished` (FCM pushes) are delivered by the
      // push step, wired in `#pushNotifications` below.
    }
    await this.#pushNotifications(meta, roster, plan);
  }

  /** One seated bot's turn. Routes on the registry row's `type`: an `engine`
   * bot runs its in-DO brain (`botActions[username]`) and the DO self-applies
   * the move; an `external` bot gets a signed HMAC wake carrying its
   * observation; a `local` bot is client-driven and never dispatched here
   * (it should not be seatable online, and a stray one just logs). The bot sees
   * only its seat's projection (`plan.frames`), so it can never read hidden
   * state: the same fog a human at the seat gets. */
  async #botTurn(meta: MetaRow, plan: CommitPlan, next: StateRow, seat: number, botId: string): Promise<void> {
    try {
      const bot = await readBot(this.d1(this.env), botId);
      if (bot === undefined) {
        console.error(`bot turn skipped: bot ${botId} not in registry (game ${meta.gameId} seat ${seat})`);
        return;
      }
      const frame = plan.frames.find((f) => f.playerIndex === seat);
      if (frame === undefined) {
        console.error(`bot turn skipped: no projected frame for seat ${seat} (game ${meta.gameId})`);
        return;
      }
      const observation: ObservationSlice = { data: frame.data, pendingPlayers: frame.pendingPlayers };
      switch (bot.type) {
        case "engine":
          await this.#runBotBrain(meta, bot, seat, observation, next);
          break;
        case "external":
          await this.#wakeExternalBot(meta, bot, seat, observation, next);
          break;
        case "local":
          console.error(`local bot ${bot.id} was seated in an online game (game ${meta.gameId} seat ${seat}): local bots are client-driven and not dispatchable`);
          break;
      }
    } catch (error) {
      // Single attempt: the turn deadline resolves a bot that never moves.
      console.error(`bot turn failed for game ${meta.gameId} seat ${seat}`, error);
    }
  }

  /** In-DO brain: look the engine bot's move function up by its username in
   * the game's `botActions`, run it, and self-apply the result as this seat's
   * action: a normal serialized command, so it commits as the next version,
   * dedupes on its deterministic commandId, and (if it leaves another bot
   * pending) chains through the same effect dispatch. */
  async #runBotBrain(meta: MetaRow, bot: Extract<Bot, { type: "engine" }>, seat: number, observation: ObservationSlice, next: StateRow): Promise<void> {
    const rules = this.#rules(meta);
    const action = rules.botActions?.[bot.username];
    if (action === undefined) {
      console.error(`engine bot ${bot.username} has no botActions entry for schemaVersion ${meta.schemaVersion} (game ${meta.gameId})`);
      return;
    }
    const config = parseStoredPayload(rules.schemas.config, meta.config, "config", meta.schemaVersion);
    const move = action({
      observation,
      botConfig: bot.config,
      playerIndex: seat,
      config,
      // Deterministic per (game, version, seat) for reproducible tests; the
      // chosen move is what gets logged, so the brain need not be pure.
      rng: deriveRng(`${next.rngSeed}:bot${seat}`, next.version),
    });
    const result = await this.handle({
      kind: "action",
      gameId: meta.gameId,
      commandId: `bot:${bot.id}:seat${seat}:v${next.version}`,
      actor: { userId: null, botId: bot.id },
      seat,
      expectedVersion: next.version,
      data: move,
    });
    if (!result.ok) {
      // A rejection here (e.g. a race lost the version) is expected and
      // harmless; the winning transition already advanced the game.
      console.error(`in-DO bot move not applied (${result.code}) for game ${meta.gameId} seat ${seat}: ${result.message}`);
    }
  }

  /** External bot: POST a signed wake carrying the bot's freshly-committed
   * observation, so the bot needs no callback to fetch state. Fire-and-forget:
   * a single attempt, no retry, and we neither wait for nor act on the
   * result: the move arrives later on `/api/bot/action`, and a lost or bounced
   * wake rides the turn deadline. A failure is therefore logged, never thrown;
   * the only bound is `WAKE_TIMEOUT_MS`, capping the held connection. */
  async #wakeExternalBot(meta: MetaRow, bot: Extract<Bot, { type: "external" }>, seat: number, observation: ObservationSlice, next: StateRow): Promise<void> {
    const secret = this.#botSigningSecret();
    if (secret === null) {
      console.error(`external bot wake skipped (BOT_SIGNING_SECRET not configured) for game ${meta.gameId} seat ${seat}`);
      return;
    }
    const body = JSON.stringify({
      gameId: meta.gameId,
      botId: bot.id,
      playerIndex: seat,
      observation: observation.data,
      version: next.version,
      pendingPlayers: observation.pendingPlayers,
      turnDeadline: next.deadline,
    });
    const signature = await signForBot(secret, bot.id, "wake", body);
    try {
      const res = await fetch(bot.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Eigen-Signature": signature },
        body,
        signal: AbortSignal.timeout(WAKE_TIMEOUT_MS),
      });
      await res.body?.cancel();
      if (!res.ok) console.warn(`external bot wake for game ${meta.gameId} seat ${seat} got HTTP ${res.status}, ignored (the turn deadline backstops it)`);
    } catch (error) {
      console.warn(`external bot wake for game ${meta.gameId} seat ${seat} failed, ignored (the turn deadline backstops it)`, error);
    }
  }

  /** FCM turn/finish pushes: a "your turn" push to each newly-waiting
   * human, and a "game over" push to every human when the game ends. */
  async #pushNotifications(meta: MetaRow, _roster: Seat[], plan: CommitPlan): Promise<void> {
    const admin = this.firebaseAdmin(this.env);
    const d1 = this.d1(this.env);
    for (const effect of plan.effects) {
      if (effect.kind === "notifyTurn") {
        await admin.notifyUser(d1, effect.userId, turnPush(meta.gameId));
      } else if (effect.kind === "notifyFinished") {
        await Promise.all(effect.userIds.map((userId) => admin.notifyUser(d1, userId, finishPush(meta.gameId))));
      }
    }
  }

  /** Best-effort "your game is ready to start" push to the creator when a join
   * fills the lobby. Fire-and-forget like the D1 mirror; the DO stays alive
   * for the pending promise. */
  #pushReady(creatorId: string, gameId: string): void {
    void this.firebaseAdmin(this.env).notifyUser(this.d1(this.env), creatorId, readyPush(gameId));
  }

  /** The engine bot-signing master secret, read from env by the documented
   * `BOT_SIGNING_SECRET` convention (mirrors `FIREBASE_PROJECT_ID`). Null when
   * unset; external bots are then unsupported and their wakes are skipped. */
  #botSigningSecret(): string | null {
    const secret = (this.env as Record<string, unknown>).BOT_SIGNING_SECRET;
    return typeof secret === "string" && secret.length > 0 ? secret : null;
  }

  // ── Finish (steps 3–4) ───────────────────────────────────────────────

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
      // Single attempt: the outbox row is the recovery signal; a gated
      // admin re-poke re-runs the apply, idempotent via finish_id.
      console.error(`finish apply failed for game ${meta.gameId} (finish_id ${finishId}); outbox retained`, error);
    }
  }

  /** After a successful D1 apply: append the ratings transition N+1 (rated
   * games), then complete the pipeline **compaction rides the outbox
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
    // Engine-owned action variant; no game hook produces or ever sees it.
    const action: TransitionAction = { type: "system", kind: "ratings", data: { deltas }, playerIndex: null };
    const frames = this.#project(meta, roster, finalState.state, [], null, false);
    const seq = this.#meta().seq + 1;
    this.#db.transaction((tx) => {
      tx.update(t.meta).set({ seq }).where(eq(t.meta.id, 1)).run();
      tx.insert(t.transitions).values({ version, state: finalState.state, action, pending: [], deadline: null, playerTimes: null, turnStartedAt: null }).run();
      // Uniform like every transition, and drained one statement later by
      // the compaction, kept ceremony-free on purpose: zero special cases
      // beats saving a doomed write.
      if (frames.length > 0) {
        tx.insert(t.frames).values(this.#frameRows(version, frames)).run();
      }
      tx.delete(t.frames).run();
      tx.delete(t.commands).run();
      tx.delete(t.outbox).run();
    });
    // An ordinary snapshot, no longer a special frame with a `ratings` field
    // bolted on: the status is already `finished`, so what this delivers is the
    // deltas, riding the same envelope every other commit uses.
    const wireFrames = new Map<number, FrameMessage>(frames.map((frame) => [frame.playerIndex, { type: "frame", version, data: frame.data, pendingPlayers: frame.pendingPlayers, deadline: null, playerTimes: null, ratings: deltas }]));
    this.#broadcast(this.#header(meta, { status: "finished", players: roster, seq, version }), wireFrames, roster);
  }

  /** The gated admin re-poke (step 4): re-runs the D1 apply for a
   * finish whose effects never landed. Idempotent end to end: finish_id
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

  // ── Deadline alarm: the ONLY alarm client ─────────────────────────

  async alarm(): Promise<void> {
    const meta = this.#loadMeta();
    if (meta === undefined || meta.status !== "active") return;
    const latest = this.#latestTransition();
    if (latest === null) return;
    // Deterministic commandId: a double fire dedupes; a raced action makes
    // the kernel abstain (whichever arrives first commits).
    await this.handle({
      kind: "lifecycle",
      type: "timeout",
      gameId: meta.gameId,
      commandId: `timeout:v${latest.version}:${latest.deadline ?? 0}`,
      actor: null,
    });
  }

  // ── Sockets (hibernating/) ──────────────────────────────────────

  /** The worker routes the upgrade here after authenticating; the principal
   * header is worker-set (never client-supplied; the worker strips inbound
   * headers when forwarding). One socket serves the game's whole lifetime and
   * carries one message kind, the per-seat {@link SessionSnapshot}. A
   * not-yet-seated user's socket receives the envelope with no frame until the
   * roster contains them, which is how it learns the game started at all. */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }
    const gameId = request.headers.get("x-eigen-game");
    if (gameId === null) return new Response("Missing game id", { status: 400 });
    if (!(await this.#ensureInit(gameId))) return new Response("No game with this id", { status: 404 });
    const attachment: SocketAttachment = { userId: request.headers.get("x-eigen-user") };

    const pair = new WebSocketPair();
    pair[1].serializeAttachment(attachment);
    this.ctx.acceptWebSocket(pair[1]);
    // The open always states where the game is, at every status, so a client
    // never has to guess and never has a window in which it holds a frame
    // without the status it belongs to. It replays no history: the snapshot
    // carries the newest version and the client decides what, if anything, to
    // fetch to fill a gap. A reconnect that missed nothing therefore costs one
    // message that the client discards by `seq`.
    pair[1].send(JSON.stringify(this.#sessionFor(attachment.userId)));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /** The snapshot over RPC, for the HTTP paths that have no socket. */
  async session(gameId: string, userId: string | null): Promise<SessionSnapshot | null> {
    if (!(await this.#ensureInit(gameId))) return null;
    return this.#sessionFor(userId);
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

  /** The seat-independent part of a snapshot: the immutable header from `meta`
   * plus the moving parts every seat sees identically. One builder so a socket
   * open, a command response and a fan-out cannot disagree. */
  #header(meta: MetaRow, live: { status: GameStatus; players: Seat[]; seq: number; version: number | null }): Omit<SessionSnapshot, "frame"> {
    return {
      type: "session",
      seq: live.seq,
      gameId: meta.gameId,
      shortCode: meta.shortCode,
      access: meta.access,
      schemaVersion: meta.schemaVersion,
      config: meta.config,
      turnSeconds: meta.turnSeconds,
      budgetSeconds: meta.budgetSeconds,
      incrementSeconds: meta.incrementSeconds,
      rated: meta.rated,
      ratingPool: meta.ratingPool,
      minPlayers: meta.minPlayers,
      maxPlayers: meta.maxPlayers,
      createdBy: meta.createdBy,
      status: live.status,
      players: live.players,
      version: live.version,
    };
  }

  /** The current snapshot for one principal, read from storage.
   *
   * Serves the socket open and the HTTP session read, so both answer with
   * exactly what a fan-out would have sent. The frame comes from the seat's
   * stored row where there is one, and is re-projected otherwise (a finished
   * game whose `frames` table the compaction drained), which is the same
   * fallback the range fetch uses. */
  #sessionFor(userId: string | null): SessionSnapshot {
    const meta = this.#meta();
    const roster = this.#roster();
    const latest = this.#latestTransition();
    const header = this.#header(meta, { status: meta.status, players: roster, seq: meta.seq, version: latest?.version ?? null });
    if (latest === null) return { ...header, frame: null };
    const seat = this.#seatOf(userId, roster);
    const view = seat === null ? null : (this.#storedView(latest.version, seat) ?? this.#viewFor(meta, roster, latest, seat, false));
    if (view === null) return { ...header, frame: null };
    const ratings = latest.action !== null && latest.action.kind === "ratings" ? latest.action.data.deltas : null;
    // A finished game attaches its outcomes to whatever its newest frame is,
    // because that is the only frame a cold-opening client will see. On the live
    // path they rode the finishing frame and the ratings transition N+1 carried
    // only the deltas; here both arrive together. Either way the client ends up
    // holding the same thing.
    const outcomes = meta.status === "finished" ? meta.outcomes : null;
    return {
      ...header,
      frame: {
        type: "frame",
        version: latest.version,
        data: view.data,
        pendingPlayers: view.pendingPlayers,
        deadline: latest.deadline,
        playerTimes: latest.playerTimes,
        ...(outcomes !== null ? { outcomes } : {}),
        ...(ratings !== null ? { ratings } : {}),
      },
    };
  }

  /** The seat a principal holds, or null. `join` rejects a duplicate user, so a
   * user holds at most one seat; a bot holds seats but never a socket. */
  #seatOf(userId: string | null, roster: Seat[]): number | null {
    if (userId === null) return null;
    return roster.find((s) => s.userId === userId)?.playerIndex ?? null;
  }

  /** Project a commit's frames onto the wire, keyed by seat. */
  #wireFrames(frames: ObservationFrame[], next: StateRow, outcomes: OutcomeEntry[] | null): Map<number, FrameMessage> {
    const out = new Map<number, FrameMessage>();
    for (const frame of frames) {
      out.set(frame.playerIndex, {
        type: "frame",
        version: next.version,
        data: frame.data,
        pendingPlayers: frame.pendingPlayers,
        deadline: next.deadline,
        playerTimes: next.playerTimes,
        ...(outcomes !== null ? { outcomes } : {}),
      });
    }
    return out;
  }

  /** Push the post-commit snapshot to every socket, each getting the frame of
   * the seat its own principal holds and nothing else.
   *
   * This is where hidden information is enforced on the live path: the seat is
   * resolved from the socket's authenticated attachment against the roster at
   * send time, so a socket opened before its user was seated starts receiving
   * that seat's view the moment it is, with no re-tagging, and a socket holding
   * no seat receives the envelope with `frame: null`. */
  #broadcast(header: Omit<SessionSnapshot, "frame">, frames: Map<number, FrameMessage>, roster: Seat[]): void {
    const unseated = JSON.stringify({ ...header, frame: null } satisfies SessionSnapshot);
    const bySeat = new Map<number, string>();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as SocketAttachment | null;
      const seat = this.#seatOf(attachment?.userId ?? null, roster);
      const frame = seat === null ? undefined : frames.get(seat);
      let payload = unseated;
      if (seat !== null && frame !== undefined) {
        payload = bySeat.get(seat) ?? JSON.stringify({ ...header, frame } satisfies SessionSnapshot);
        bySeat.set(seat, payload);
      }
      try {
        ws.send(payload);
      } catch {
        // A dead socket is the client's reconnect problem: the open snapshot
        // states the truth again, and frames are recoverable by range fetch.
      }
    }
  }

  /** Push one already-built snapshot to every socket. Only correct where the
   * value carries no per-seat frame, which is the abort teardown. */
  #sendToAll(session: SessionSnapshot): void {
    const payload = JSON.stringify(session);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Dead socket; nothing to recover, the game is over.
      }
    }
  }

  // ── Range fetch: live gap recovery AND finished-game replay ────────

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
    // post-compaction and for replay, which re-project below).
    const stored = new Map<number, SeatView>();
    if (args.seat !== null && !isReplay) {
      const frameRows = this.#db
        .select()
        .from(t.frames)
        .where(and(eq(t.frames.playerIndex, args.seat), gte(t.frames.version, args.from), lte(t.frames.version, args.to)))
        .all();
      for (const f of frameRows) stored.set(f.version, { data: f.data, pendingPlayers: f.pendingPlayers });
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
        pendingPlayers: view.pendingPlayers,
        deadline: row.deadline,
        playerTimes: row.playerTimes,
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
      assertHookPayload(rules.schemas.observation, slice.data, "computeObservation for public viewer");
      return { data: slice.data, pendingPlayers: slice.pendingPlayers };
    }
    const frame = this.#project(meta, roster, row.state, row.pending, cause, isReplay).find((f) => f.playerIndex === seat);
    return frame === undefined ? null : { data: frame.data, pendingPlayers: frame.pendingPlayers };
  }

  /** The game-hook cause vocabulary; the engine-owned ratings row has none. */
  #causeOf(action: TransitionAction | null): TransitionCause {
    if (action === null || action.kind === "ratings") return null;
    if (action.kind === "game") {
      return { kind: "game", data: action.data, playerIndex: action.playerIndex };
    }
    return { kind: "lifecycle", data: action.data };
  }

  #project(meta: MetaRow, roster: Seat[], state: JsonObject, pending: number[], cause: TransitionCause, isReplay: boolean): ObservationFrame[] {
    const rules = this.#rules(meta);
    const identified = new Set(roster.filter((s) => s.userId !== null || s.botId !== null).map((s) => s.playerIndex));
    return fanOutObservations(rules, {
      state,
      pending,
      participantCount: roster.length,
      config: parseStoredPayload(rules.schemas.config, meta.config, "config", meta.schemaVersion),
      cause,
      isReplay,
    }).filter((f) => identified.has(f.playerIndex));
  }

  // ── Lazy init & snapshot loads ─────────────────────────────────────

  /** First contact: copy the D1 game row into `meta` + `roster`. The one
   * sanctioned non-storage await near the gate: `blockConcurrencyWhile`
   * holds ALL events, so nothing interleaves, and it runs once per game.
   * Returns false when no such game exists (callers answer 404 /
   * `unknownGame`; a missing row must not throw here, since an exception inside
   * `blockConcurrencyWhile` resets the whole object). */
  async #ensureInit(gameId: string): Promise<boolean> {
    if (this.#loadMeta() !== undefined) return true;
    let found = true;
    await this.ctx.blockConcurrencyWhile(async () => {
      if (this.#loadMeta() !== undefined) return;
      const row = await readGameRow(this.d1(this.env), gameId);
      if (row === undefined) {
        found = false;
        return;
      }
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
            shortCode: row.shortCode,
            outcomes: row.outcomes,
            seq: 0,
          })
          .run();
        for (const seat of row.participants) {
          tx.insert(t.roster).values({ playerIndex: seat.playerIndex, userId: seat.userId, botId: seat.botId, type: seat.type }).run();
        }
      });
    });
    return found;
  }

  #rules(meta: MetaRow): GameRules {
    const rules = this.gameModule.versions[meta.schemaVersion];
    if (rules === undefined) {
      throw new GameBugError(`No rules unit for schemaVersion ${meta.schemaVersion}`);
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
    return this.#db.select({ playerIndex: t.roster.playerIndex, userId: t.roster.userId, botId: t.roster.botId, type: t.roster.type }).from(t.roster).orderBy(t.roster.playerIndex).all();
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
    return frames.map((f) => ({ version, playerIndex: f.playerIndex, data: f.data, pendingPlayers: f.pendingPlayers }));
  }

  /** One seat's stored live frame at one version: the frames-table PK. */
  #storedView(version: number, seat: number): SeatView | null {
    const row = this.#db
      .select()
      .from(t.frames)
      .where(and(eq(t.frames.version, version), eq(t.frames.playerIndex, seat)))
      .get();
    return row === undefined ? null : { data: row.data, pendingPlayers: row.pendingPlayers };
  }

  #storedResponse(commandId: string): CommandResult | null {
    const row = this.#db.select({ response: t.commands.response }).from(t.commands).where(eq(t.commands.commandId, commandId)).get();
    return row?.response ?? null;
  }
}

/** The grace constant re-exported for hosts arming display timers. */
export { DEADLINE_GRACE_MS };
