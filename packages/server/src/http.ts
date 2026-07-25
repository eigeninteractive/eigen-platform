/**
 * The engine's HTTP failure vocabulary. Handlers return ONLY their declared
 * 200 shape; every failure is an {@link HttpError} throw (or a kernel/lobby
 * rejection converted into one by {@link unwrap}), shaped by the app-level
 * error handler. One error shape everywhere: `{ error, code? }`.
 */

import type { RejectCode } from "@eigeninteractive/kernel";
import type { CommandResult, LobbyRejectCode } from "./protocol.js";

/**
 * Every stable machine code an error body may carry — the kernel's and lobby's
 * rejection vocabularies plus the few the routes raise directly. This is the
 * closed set the wire enum (`errorCodeShape`) publishes, so a client can
 * `switch` on it exhaustively; adding a member here is a wire change and needs
 * a schema-version bump, exactly like any other enum on the wire.
 *
 * `abstain` is deliberately excluded: it is a system-intent no-op, never the
 * answer to a client command, so {@link unwrap} converts one into a 500 rather
 * than making every client handle a case it cannot act on.
 */
export type ErrorCode =
  | Exclude<RejectCode, "abstain">
  | LobbyRejectCode
  /** Raised by a route before the command reaches the game. Each one exists
   * because the client renders a distinct response to it — a field-level form
   * error, a "create an account" prompt, a retry with a different file. A
   * failure the client can only report generically stays uncoded. */
  | "schema_unsupported"
  | "username_invalid"
  | "username_taken"
  | "friends_only"
  | "registration_required"
  | "image_too_large"
  | "unsupported_image_type"
  | "rate_limited";

export class HttpError extends Error {
  readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 502;
  readonly code: ErrorCode | undefined;
  /** Seconds the caller should wait before retrying — rendered as the
   * `Retry-After` header. Set only on a 429 (see `ErrorCode.rate_limited`);
   * `undefined` everywhere else. */
  readonly retryAfterSeconds: number | undefined;

  constructor(status: HttpError["status"], message: string, code?: ErrorCode, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Transport mapping for the kernel's + lobby's stable machine codes: client
 * mistakes are 400, ownership refusals 403, a missing game 404, everything
 * else is a state conflict a client resolves by resyncing (409). */
export function rejectStatus(code: RejectCode | LobbyRejectCode): 400 | 403 | 404 | 409 {
  switch (code) {
    case "invalid_payload":
    case "illegal_move":
      return 400;
    case "not_creator":
    case "not_participant":
      return 403;
    case "unknown_game":
      return 404;
    default:
      return 409;
  }
}

/** Narrow a `CommandResult` to its accepted shape, converting a rejection
 * into the HttpError the app's error handler renders. */
export function unwrap(result: CommandResult): Extract<CommandResult, { ok: true }> {
  if (!result.ok) {
    // A timeout that lost its race abstains, and only the DO's alarm raises
    // system intents — so an abstain answering a client command is an engine bug.
    if (result.code === "abstain") throw new HttpError(500, "engine bug: a client command was abstained");
    throw new HttpError(rejectStatus(result.code), result.message, result.code);
  }
  return result;
}
