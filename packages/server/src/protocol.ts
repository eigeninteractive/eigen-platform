/**
 * The worker ⇄ DO ⇄ client protocol types (engine_stack.md §3.3): commands
 * are self-contained, pre-authenticated VALUES — loggable, replayable, and a
 * CI fixture is a JSON array of them. The worker verifies the Firebase token
 * and runs every policy check BEFORE minting a command; the DO enforces
 * integrity (seat occupancy, status, versions) under its input gate.
 */

import type { GameStatus, RatingDelta, RejectCode, Seat } from "@eigen/kernel";
import type { JsonObject, LifecycleType, OutcomeEntry } from "@eigen/rules";

/** Re-exported from the kernel — rating math and its shapes live there. */
export type { RatingDelta };

/** Who a command acts as, resolved at the edge. Exactly one id is set. */
export interface Principal {
  userId: string | null;
  botId: string | null;
}

/** Everything that crosses the worker → DO boundary after creation (§4.1:
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
      /** Omitted for humans — the DO resolves the seat from its own roster
       * (the authoritative copy; the D1 mirror only displays, §4.2). Bots
       * name theirs: one bot id may hold several seats. A named seat must
       * belong to the actor or the DO throws. */
      seat?: number;
      /** The version the client computed the move against — a lower value is
       * arbitrated by the same-view rule (§3.5). */
      expectedVersion: number;
      data: unknown;
    }
  | {
      kind: "lifecycle";
      gameId: string;
      commandId: string;
      /** Null for identity-less system lifecycles (timeout, auto_forfeit). */
      actor: Principal | null;
      type: LifecycleType;
      /** The affected seat; forfeit resolves it from the actor when omitted,
       * timeout never carries one (resolves all pending). */
      seat?: number;
    };

/** Why the DO refused a waiting-room command — the §4.2 integrity column.
 * These are *expected* refusals (accepted lobby staleness: the lobby may show
 * a game that just filled), returned as values exactly like kernel
 * rejections; the worker maps them to HTTP. Genuine protocol violations
 * (acting on a seat you don't own) still throw. */
export type LobbyRejectCode =
  /** No game with this id exists — the DO is authoritative, so commands
   * skip the worker-side D1 existence read entirely. */
  | "unknown_game"
  /** The game is no longer in a lobby status (`waiting`/`ready`). */
  | "not_joinable"
  /** Every seat is taken — the §4.2 accepted lobby race. */
  | "game_full"
  /** The actor already holds a seat. */
  | "already_joined"
  /** The actor holds no seat (leave), or may not view (frames). */
  | "not_participant"
  /** A creator-only command (`cancel`, `add-bot`, `start`) from a non-creator. */
  | "not_creator"
  /** The creator cannot leave — they cancel instead (§4.2). */
  | "creator_cannot_leave";

/** The unversioned pre-game snapshot (§4.2): pushed to every socket on any
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
  pending_players: number[];
  /** The true client-facing deadline (grace is display-only there). */
  deadline: number | null;
  player_times: number[] | null;
  outcomes?: OutcomeEntry[];
  ratings?: RatingDelta[];
}

/** What `GameDO.handle()` returns; accepted results are stored for commandId
 * dedupe and replayed verbatim to a retry (§3.6). Rejections are computed
 * fresh each time — re-evaluating one is always sound. State-transitioning
 * commands answer with a version (+ the acting seat's frame); waiting-room
 * commands answer with the post-commit roster snapshot. */
export type CommandResult = { ok: true; version: number; frame: FrameMessage | null } | { ok: true; roster: RosterSnapshot } | { ok: false; code: RejectCode | LobbyRejectCode; message: string };
