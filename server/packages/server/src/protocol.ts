/**
 * The worker ⇄ DO ⇄ client protocol types: commands
 * are self-contained, pre-authenticated VALUES: loggable, replayable, and a
 * CI fixture is a JSON array of them. The worker verifies the Firebase token
 * and runs every policy check BEFORE minting a command; the DO enforces
 * integrity (seat occupancy, status, versions) under its input gate.
 */

import type { GameStatus, RatingDelta, RejectCode, Seat } from "@eigeninteractive/kernel";
import type { GameAccess, JsonObject, LifecycleType, OutcomeEntry } from "@eigeninteractive/rules";

/** Re-exported from the kernel, where rating math and its shapes live. */
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
      /** The acting seat, carried uniformly by humans and bots. The
       * DO verifies it belongs to the actor (user id from the token, bot id
       * from the HMAC claim) against its own roster and rejects otherwise, so
       * a client can never act on a seat it does not hold. Required because
       * one bot id may hold several seats, and uniform for one code path. */
      seat: number;
      /** The version the client computed the move against; a lower value is
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

/** Why the DO refused a waiting-room command: the integrity column.
 * These are *expected* refusals (accepted lobby staleness: the lobby may show
 * a game that just filled), returned as values exactly like kernel
 * rejections; the worker maps them to HTTP. Genuine protocol violations
 * (acting on a seat you don't own) still throw. */
export type LobbyRejectCode =
  /** No game with this id exists. The DO is authoritative, so commands
   * skip the worker-side D1 existence read entirely. */
  | "unknownGame"
  /** The game is no longer in a lobby status (`waiting`/`ready`). */
  | "notJoinable"
  /** Every seat is taken: the accepted lobby race. */
  | "gameFull"
  /** The actor already holds a seat. */
  | "alreadyJoined"
  /** The actor holds no seat (leave), or may not view (frames). */
  | "notParticipant"
  /** A creator-only command (`cancel`, `add-bot`, `start`) from a non-creator. */
  | "notCreator"
  /** The creator cannot leave; they cancel instead. */
  | "creatorCannotLeave";

/** A stable command id was already committed by this principal for different
 * semantic intent. Retrying or resyncing cannot repair this caller defect. */
export type CommandRejectCode = "commandConflict";

/**
 * The complete live truth about one game, as ONE SEAT sees it: the only message
 * the socket carries, and the body of every accepted command.
 *
 * Sent on socket open whatever the status, and after every committed change,
 * lobby or state. Self-describing and idempotent: a client that applies the
 * newest one it has seen is correct, having missed any number of earlier ones,
 * so there is no state for it to reconstruct and no channel for it to correlate
 * against another.
 *
 * It carries the immutable header as well as the moving parts because a game
 * screen must not need a second source. That is what the old split cost: status
 * lived only in a D1 read nothing re-issued, so a client could observe a frame
 * without the status it belonged to, and never learned a game had started.
 *
 * Hidden information is safe by construction: the envelope is projected per seat
 * before it is sent, and `frame` is only ever the receiving principal's own
 * seat's view.
 */
export interface SessionSnapshot {
  type: "session";
  /** Monotonic per game, incremented by every commit. Totally orders snapshots
   * across every path they arrive by, which `version` cannot do because a lobby
   * change has none. Apply a snapshot when `seq` exceeds the held one, OR when
   * it reports a terminal status the held state does not: `finished` and
   * `aborted` are absorbing, so they need no ordering even if the final socket
   * delivery is missed. */
  seq: number;

  /** Fixed at creation; carried so this is sufficient on its own. */
  gameId: string;
  shortCode: string;
  access: GameAccess;
  schemaVersion: number;
  config: JsonObject;
  turnSeconds: number | null;
  budgetSeconds: number | null;
  incrementSeconds: number | null;
  rated: boolean;
  ratingPool: string | null;
  minPlayers: number;
  maxPlayers: number;
  createdBy: string | null;

  /** What moves. */
  status: GameStatus;
  players: Seat[];
  /** The newest committed version, or null while the game is in the lobby. */
  version: number | null;
  /** The receiving seat's observation at `version`. Null in the lobby, and null
   * for a principal holding no seat, which is how an unseated client still
   * learns that the game started. */
  frame: FrameMessage | null;
}

/** One seat's versioned frame on the wire: the socket fan-out payload, and
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

/** What `GameDO.handle()` returns: one accepted shape for every command kind,
 * the caller's own post-commit {@link SessionSnapshot}, so a lobby command and a
 * move answer with the same value and the client feeds both into one path.
 *
 * Accepted results are stored for commandId dedupe and replayed verbatim to a
 * retry, which means a retry receives the snapshot as it was at first execution.
 * That is harmless rather than stale: `seq` orders it against whatever the
 * client now holds, so an older one is simply discarded. Rejections are computed
 * fresh each time, since re-evaluating one is always sound. */
export type CommandResult = { ok: true; session: SessionSnapshot } | { ok: false; code: RejectCode | LobbyRejectCode | CommandRejectCode; message: string };

/** The DO surface the worker calls: structurally the RPC stub of any
 * `BaseGameDO` subclass. Lives here (not in `engine.ts`) so the lifecycle
 * paths (purge, cron reap) can depend on it without importing the app
 * factory. */
/**
 * What one {@link GameStub.reconcile} call found and repaired.
 *
 * Reported rather than logged so both callers can use it: the cron sweep counts
 * repairs, and the operator route answers with it.
 */
export interface ReconcileReport {
  gameId: string;
  /** False when the object holds no committed state, so D1's row is the only
   * truth there is and there was nothing to reconcile. */
  initialized: boolean;
  /** The authoritative status, or null when uninitialized. */
  status: GameStatus | null;
  /** D1's roster/summary rows were rewritten from this object's state. True for a
   * healthy game too: the rewrite is unconditional and idempotent, because
   * detecting drift would cost a read that tells the caller nothing it can act on
   * differently. */
  mirrorRewritten: boolean;
  /** A retained finish outbox row was re-applied — the divergence that otherwise
   * costs a finished game its rating deltas permanently. */
  finishRepoked: boolean;
  /** The armed alarm disagreed with the committed deadline and was corrected. */
  alarmRearmed: boolean;
}

export interface GameStub {
  handle(cmd: Command): Promise<CommandResult>;
  /** The current snapshot for one principal, for the paths with no socket: a
   * cold HTTP read, a deep-link preview, a spectator. Null when no such game
   * exists. `userId` null means "no seat", which yields `frame: null`. */
  session(gameId: string, userId: string | null): Promise<SessionSnapshot | null>;
  frames(args: { seat: number | null; from: number; to: number; isReplay?: boolean }): Promise<FrameMessage[]>;
  repokeFinish(): Promise<boolean>;
  /** Re-derive D1's read model from committed state and retry a finish whose
   * apply never landed. Idempotent; safe on a healthy game. */
  reconcile(gameId: string): Promise<ReconcileReport>;
  /** Unconditional teardown: mark the game aborted and compact game data while
   * retaining command receipts. Used by the cron reap for abandoned lobbies /
   * untimed games, with no creator gate, unlike the `cancel` command. */
  abort(gameId: string): Promise<void>;
  fetch(request: Request): Promise<Response>;
}
