/**
 * The worker ⇄ DO ⇄ client protocol types: commands
 * are self-contained, pre-authenticated VALUES — loggable, replayable, and a
 * CI fixture is a JSON array of them. The worker verifies the Firebase token
 * and runs every policy check BEFORE minting a command; the DO enforces
 * integrity (seat occupancy, status, versions) under its input gate.
 */

import type { GameStatus, RatingDelta, RejectCode, Seat } from "@eigeninteractive/kernel";
import type { JsonObject, LifecycleType, OutcomeEntry } from "@eigeninteractive/rules";

/** Re-exported from the kernel — rating math and its shapes live there. */
export type { RatingDelta };

/** Who a command acts as, resolved at the edge. Exactly one id is set. */
export interface Principal {
  userId: string | null;
  botId: string | null;
}

/** Everything that crosses the worker → DO boundary after creation (
 * create itself is a worker-direct D1 write; the DO does not exist yet). */
export type Command =
  | { kind: "join" | "leave"; gameId: string; commandId: string; actor: Principal }
  | { kind: "cancel"; gameId: string; commandId: string; actor: Principal }
  | { kind: "start"; gameId: string; commandId: string; actor: Principal }
  | { kind: "add-bot"; gameId: string; commandId: string; actor: Principal; botId: string }
  | {
      kind: "action";
      gameId: string;
      commandId: string;
      actor: Principal;
      /** The acting seat — carried uniformly by humans and bots. The
       * DO verifies it belongs to the actor (user id from the token, bot id
       * from the HMAC claim) against its own roster and rejects otherwise, so
       * a client can never act on a seat it does not hold. Required because
       * one bot id may hold several seats, and uniform for one code path. */
      seat: number;
      /** The version the client computed the move against — a lower value is
       * arbitrated by the same-view rule. */
      expectedVersion: number;
      data: unknown;
    }
  | {
      kind: "lifecycle";
      gameId: string;
      commandId: string;
      /** Null for identity-less system lifecycles (timeout, autoForfeit). */
      actor: Principal | null;
      type: LifecycleType;
      /** The affected seat: `forfeit` carries the resigning seat (verified
       * against the actor, like an action); `autoForfeit` the purged seat;
       * `timeout` carries none (it resolves all pending). */
      seat?: number;
    };

/** Why the DO refused a waiting-room command — the integrity column.
 * These are *expected* refusals (accepted lobby staleness: the lobby may show
 * a game that just filled), returned as values exactly like kernel
 * rejections; the worker maps them to HTTP. Genuine protocol violations
 * (acting on a seat you don't own) still throw. */
export type LobbyRejectCode =
  /** No game with this id exists — the DO is authoritative, so commands
   * skip the worker-side D1 existence read entirely. */
  | "unknownGame"
  /** The game is no longer in a lobby status (`waiting`/`ready`). */
  | "notJoinable"
  /** Every seat is taken — the accepted lobby race. */
  | "gameFull"
  /** The actor already holds a seat. */
  | "alreadyJoined"
  /** The actor holds no seat (leave), or may not view (frames). */
  | "notParticipant"
  /** A creator-only command (`cancel`, `add-bot`, `start`) from a non-creator. */
  | "notCreator"
  /** The creator cannot leave — they cancel instead. */
  | "creatorCannotLeave";

/** The unversioned pre-game snapshot: pushed to every socket on any
 * roster change, idempotent — a reconnect just gets the current one. Also the
 * response body of an accepted waiting-room command. */
export interface RosterSnapshot {
  type: "roster";
  status: GameStatus;
  players: Seat[];
}

/** One seat's versioned frame on the wire — the socket fan-out payload, and
 * (for the acting seat) the command-response ride-along. `ratings` appears
 * only on the post-finish ratings transition. */
export interface FrameMessage {
  type: "frame";
  version: number;
  data: JsonObject;
  pendingPlayers: number[];
  /** The true client-facing deadline (grace is display-only there). */
  deadline: number | null;
  playerTimes: number[] | null;
  outcomes?: OutcomeEntry[];
  ratings?: RatingDelta[];
}

/** Sent once, on a mid-game socket open, saying where the game currently is.
 *
 * The pre-game equivalent is the {@link RosterSnapshot} that rides the open;
 * from v0 onward the roster is frozen, so this carries the one thing that does
 * still move — the newest committed version.
 *
 * It exists so a client can reconcile in one step instead of guessing. A cold
 * open learns which version to load without replaying the whole game, and a
 * reconnect can compare against its own cursor and skip the catch-up fetch
 * entirely when nothing was missed — the common case on a flaky connection,
 * where reconnects are frequent but usually miss nothing. */
export interface SyncMessage {
  type: "sync";
  version: number;
}

/** What `GameDO.handle()` returns; accepted results are stored for commandId
 * dedupe and replayed verbatim to a retry. Rejections are computed
 * fresh each time — re-evaluating one is always sound. State-transitioning
 * commands answer with a version (+ the acting seat's frame); waiting-room
 * commands answer with the post-commit roster snapshot. */
export type CommandResult = { ok: true; version: number; frame: FrameMessage | null } | { ok: true; roster: RosterSnapshot } | { ok: false; code: RejectCode | LobbyRejectCode; message: string };

/** The DO surface the worker calls — structurally the RPC stub of any
 * `BaseGameDO` subclass. Lives here (not in `engine.ts`) so the lifecycle
 * paths (purge, cron reap) can depend on it without importing the app
 * factory. */
export interface GameStub {
  handle(cmd: Command): Promise<CommandResult>;
  frames(args: { seat: number | null; from: number; to: number; isReplay?: boolean }): Promise<FrameMessage[]>;
  repokeFinish(): Promise<boolean>;
  /** Unconditional teardown: mark the game aborted, drop DO storage.
   * Used by the cron reap for abandoned lobbies / untimed games — no creator
   * gate, unlike the `cancel` command. */
  abort(gameId: string): Promise<void>;
  fetch(request: Request): Promise<Response>;
}
