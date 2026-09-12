/**
 * The worker ⇄ DO ⇄ client protocol types: commands
 * are self-contained, pre-authenticated values. The worker verifies the Firebase token
 * and runs every policy check BEFORE minting a command; the DO enforces
 * integrity (seat occupancy, status, versions) under its input gate.
 */

import type { GameStatus, RatingDelta, RejectCode, Seat, TransitionAction } from "@eigeninteractive/kernel";
import type { GameAccess, JsonObject, LifecycleType, OutcomeEntry } from "@eigeninteractive/rules";

/** Re-exported from the kernel, where rating math and its shapes live. */
export type { RatingDelta };

/**
 * Where a game is played, fixed at creation and immutable.
 *
 * `online` is the ordinary game: every transition is decided by this server.
 * `local` is a game the device played offline against on-device bot brains and
 * imported afterwards, transition by transition, through the two import routes.
 * The server still commits every one of them through the same rules, so an
 * imported game is an ordinary game once it lands; `origin` says how it got
 * here, which is what lets a client badge it, keep it unrated, and know that it
 * may continue appending to it from the device.
 *
 * Lives here rather than beside the D1 column because it is protocol: it rides
 * {@link SessionSnapshot} and the game summary, so a game screen needs no
 * second source to know what it is looking at.
 */
export type GameOrigin = "online" | "local";

/** Who a command acts as, resolved at the edge. Exactly one id is set. */
export interface Principal {
  userId: string | null;
  botId: string | null;
}

/** Everything that crosses the worker → DO boundary after creation (
 * create itself is a worker-direct D1 write; the DO does not exist yet). */
export type Command =
  | { kind: "join" | "leave"; gameId: string; actor: Principal }
  | { kind: "cancel"; gameId: string; actor: Principal }
  | {
      kind: "start";
      gameId: string;
      actor: Principal;
      /** The game's base RNG seed. Carried ONLY by the local-import create
       * (`POST /games/local`): the device already played the game from this
       * seed, so the server's replay has to draw the same values or every
       * random hook would diverge on the first transition. Absent on every
       * other path, where the DO generates one (`randomSeed()`) and the seed
       * never leaves it. */
      seed?: string;
    }
  | { kind: "add-bot"; gameId: string; actor: Principal; botId: string }
  | {
      kind: "action";
      gameId: string;
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
      /** Null for identity-less system lifecycles (timeout, autoForfeit). */
      actor: Principal | null;
      type: LifecycleType;
      /** The affected seat: `forfeit` carries the resigning seat (verified
       * against the actor, like an action); `autoForfeit` the purged seat;
       * `timeout` carries none (it resolves all pending). */
      seat?: number;
    }
  | {
      /**
       * Import a run of a local game's transitions into the authoritative
       * object, in order, as one request.
       *
       * A batch rather than one command per transition because a finished local
       * game is a whole transcript: sending it move by move would cost a Worker
       * and a Durable Object request each, and would let a client stop halfway
       * through with the server's copy in a state the device never saw.
       */
      kind: "local-transitions";
      gameId: string;
      /** The game's creator: the only principal a local game has. */
      actor: Principal;
      /** The version the device believes the server is at. The import is
       * append-only, so a mismatch means another device already appended and
       * this batch is refused whole (`stateUpdated`). */
      fromVersion: number;
      transitions: LocalTransition[];
    };

/** Every command that is exactly one commit: what {@link GameStub.handle}
 * takes. The import batch is the one command that is not, and it has its own
 * entry point, because it answers with how far it got rather than with one
 * commit's result. */
export type SingleCommand = Exclude<Command, { kind: "local-transitions" }>;

/**
 * One transition of a local game's log, as the device recorded it.
 *
 * `data` is the game's own action payload for `game`, and a `LifecycleAction`
 * for `lifecycle` — of which only `forfeit` is importable, because a local game
 * is untimed (so it can never time out) and `autoForfeit` is engine-driven.
 * The worker validates the lifecycle payload before minting the command, so the
 * DO reads the seat and nothing else.
 */
export interface LocalTransition {
  seat: number;
  kind: "game" | "lifecycle";
  data: unknown;
}

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
   * change has none. Apply a snapshot only when `seq` exceeds the held one.
   * `finished` and `aborted` are absorbing, so a client also refuses a later
   * non-terminal snapshot rather than resurrecting a completed game. */
  seq: number;

  /** Fixed at creation; carried so this is sufficient on its own. */
  gameId: string;
  shortCode: string;
  access: GameAccess;
  /** Where this game is played; never changes. */
  origin: GameOrigin;
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
 * Rejections are values and are recomputed against the authoritative current
 * state on every attempt. */
export type CommandResult = { ok: true; session: SessionSnapshot } | { ok: false; code: RejectCode | LobbyRejectCode; message: string };

/** Which transition of an import batch the game refused, and why.
 *
 * Not a transport error: everything before `index` is committed and permanent,
 * so the batch answers 200 carrying this. It means the device's Dart twin and
 * the authoritative TypeScript rules disagreed, which the client surfaces as a
 * diverged record rather than retrying. `abstain` cannot appear: only the
 * alarm's system timeout abstains, and a local game is untimed. */
export interface LocalRejection {
  index: number;
  code: Exclude<RejectCode, "abstain"> | LobbyRejectCode;
  message: string;
}

/** What one import batch returns: how far it got, the creator's session after
 * the last committed transition, and the rejection that stopped it (null when
 * the whole batch landed). A refusal of the batch *as a whole* (an unknown
 * game, a non-creator, a `fromVersion` another device moved past) is the same
 * rejection value shape every command uses. */
export type LocalBatchResult = { ok: true; applied: number; session: SessionSnapshot; rejection: LocalRejection | null } | { ok: false; code: RejectCode | LobbyRejectCode; message: string };

/** One row of a local game's stored log: the raw state and the action that
 * produced it, which is everything a device needs to rebuild its local engine.
 * The ONLY place raw state leaves the Durable Object, and only to the game's
 * single human (see {@link GameStub.localRecord}). */
export interface LocalTransitionRow {
  version: number;
  state: JsonObject;
  action: TransitionAction | null;
  pending: number[];
}

/** What a device needs to continue a local game it holds no record for: the
 * seed every transition's randomness derives from, plus the log itself. */
export interface LocalRecord {
  seed: string;
  transitions: LocalTransitionRow[];
}

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
  handle(cmd: SingleCommand): Promise<CommandResult>;
  /** The import batch: one request, one entry through the input gate, every
   * transition committed in sequence by the same kernel path a live move takes.
   *
   * Its own entry point rather than a `handle()` kind because it does not answer
   * with one commit's result: it reports how far it got, which `CommandResult`
   * has nowhere to put. Keeping `handle()` single-commit is what lets every
   * existing call site stay `unwrap(await stub.handle(...))`. */
  localTransitions(cmd: Extract<Command, { kind: "local-transitions" }>): Promise<LocalBatchResult>;
  /** A local game's stored log, for a device continuing it (or picking it up
   * for the first time). Null when no such game exists, and for any game whose
   * origin is not `local`: raw state leaves the object only here, so the
   * origin gate is restated at the object rather than trusted from the route. */
  localRecord(gameId: string, from: number, to: number): Promise<LocalRecord | null>;
  /** The current snapshot for one principal, for the paths with no socket: a
   * cold HTTP read, a deep-link preview, a spectator. Null when no such game
   * exists. `userId` null means "no seat", which yields `frame: null`. */
  session(gameId: string, userId: string | null): Promise<SessionSnapshot | null>;
  frames(args: { seat: number | null; from: number; to: number; isReplay?: boolean }): Promise<FrameMessage[]>;
  /** The one repair entry point: re-derive D1's read model from committed state,
   * retry a finish whose apply never landed, and re-arm the alarm if it
   * disagrees. Idempotent; safe on a healthy game. */
  reconcile(gameId: string): Promise<ReconcileReport>;
  /** Unconditional teardown: mark the game aborted and compact game data. Used
   * by the cron reap for abandoned lobbies /
   * untimed games, with no creator gate, unlike the `cancel` command. */
  abort(gameId: string): Promise<void>;
  fetch(request: Request): Promise<Response>;
}
