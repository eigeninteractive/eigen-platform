/**
 * The worker ⇄ DO ⇄ client protocol types (engine_stack.md §3.3): commands
 * are self-contained, pre-authenticated VALUES — loggable, replayable, and a
 * CI fixture is a JSON array of them. The worker verifies the Firebase token
 * and runs every policy check BEFORE minting a command; the DO enforces
 * integrity (seat occupancy, status, versions) under its input gate.
 */

import type { RatingDelta, RejectCode } from "@eigen/kernel";
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
  | { kind: "join" | "leave" | "cancel"; gameId: string; commandId: string; actor: Principal }
  | { kind: "start"; gameId: string; commandId: string; actor: Principal }
  | { kind: "add-bot"; gameId: string; commandId: string; actor: Principal; botId: string }
  | {
      kind: "action";
      gameId: string;
      commandId: string;
      actor: Principal;
      seat: number;
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
      /** The forfeiting seat; absent for timeout (resolves all pending). */
      seat?: number;
    };

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
 * fresh each time — re-evaluating one is always sound. */
export type CommandResult = { ok: true; version: number; frame: FrameMessage | null } | { ok: false; code: RejectCode; message: string };
