/**
 * The engine's HTTP failure vocabulary. Handlers return ONLY their declared
 * 200 shape; every failure is an {@link HttpError} throw (or a kernel/lobby
 * rejection converted into one by {@link unwrap}), shaped by the app-level
 * error handler. One error shape everywhere: `{ error, code? }`.
 */

import type { RejectCode } from "@eigen/kernel";
import type { CommandResult, LobbyRejectCode } from "./protocol.js";

export class HttpError extends Error {
  readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 500 | 502;
  readonly code: string | undefined;

  constructor(status: HttpError["status"], message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
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
  if (!result.ok) throw new HttpError(rejectStatus(result.code), result.message, result.code);
  return result;
}
