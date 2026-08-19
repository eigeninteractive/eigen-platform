/**
 * `withRetry` and the two predicates that drive it: `isTransientD1Error` for the
 * fire-and-forget summary mirrors, and `isRetryableDoError` for Worker-to-Durable
 * -Object calls.
 */

import { describe, expect, it, vi } from "vitest";
import { isRetryableDoError, isTransientD1Error, retryingGameStub, withRetry } from "../src/index.js";
import type { GameStub } from "../src/protocol.js";

/** No real delays: resolve immediately so the backoff schedule is exercised
 * without wall-clock waits. */
const noSleep = () => Promise.resolve();

/** Wraps drizzle-style rethrow so the predicate must walk `.cause`. */
function wrapped(message: string): Error {
  return new Error(`Failed query: update ...`, { cause: new Error(`D1_ERROR: ${message}`) });
}

describe("isTransientD1Error", () => {
  it("matches the transient infrastructure errors, down the cause chain", () => {
    for (const message of ["Network connection lost", "Internal error in D1 DB storage caused object to be reset", "D1 DB reset because its code was updated", "Cannot resolve D1 DB due to transient issue on remote node"]) {
      expect(isTransientD1Error(wrapped(message)), message).toBe(true);
    }
  });

  it("does not match a deterministic failure", () => {
    expect(isTransientD1Error(wrapped("UNIQUE constraint failed: users.username"))).toBe(false);
    expect(isTransientD1Error(new Error("NOT NULL constraint failed"))).toBe(false);
    expect(isTransientD1Error("a bare string")).toBe(false);
  });

  it("does not retry an overloaded or resource-exhausted DB, since the remedy is to shed load, not retry", () => {
    for (const message of ["D1 DB is overloaded. Requests queued for too long", "D1 DB is overloaded. Too many requests queued", "D1 DB's isolate exceeded its memory limit and was reset", "D1 DB exceeded its CPU time limit and was reset"]) {
      expect(isTransientD1Error(wrapped(message)), message).toBe(false);
    }
  });
});

describe("isRetryableDoError", () => {
  /** Cloudflare sets these as properties on the error, not in its message. */
  const doError = (props: Record<string, unknown>) => Object.assign(new Error("durable object unavailable"), props);

  it("matches an error the runtime marked retryable", () => {
    expect(isRetryableDoError(doError({ retryable: true }))).toBe(true);
  });

  it("refuses an overloaded object even when it is also marked retryable", () => {
    // The documented remedy for overload is to shed load, so `overloaded` vetoes.
    expect(isRetryableDoError(doError({ retryable: true, overloaded: true }))).toBe(false);
    expect(isRetryableDoError(doError({ overloaded: true }))).toBe(false);
  });

  it("fails closed on anything the runtime did not mark", () => {
    // A game's own exception (a GameBugError, an integrity violation) arrives
    // with no such property: retrying it would only delay the report.
    expect(isRetryableDoError(new Error("engine bug: roster has no seat 0"))).toBe(false);
    expect(isRetryableDoError(doError({ retryable: "true" }))).toBe(false);
    expect(isRetryableDoError("a bare string")).toBe(false);
    expect(isRetryableDoError(null)).toBe(false);
    expect(isRetryableDoError(undefined)).toBe(false);
  });
});

describe("retryingGameStub", () => {
  const retryable = () => Object.assign(new Error("Durable Object reset because its code was updated"), { retryable: true });

  /** A stub whose `handle` fails `failures` times, counting how many stubs were
   * built along the way. */
  function flaky(failures: number) {
    let connects = 0;
    let calls = 0;
    const connect = () => {
      connects++;
      return {
        handle: async () => {
          calls++;
          if (calls <= failures) throw retryable();
          return { ok: true as const, session: { gameId: "g" } } as never;
        },
      } as unknown as GameStub;
    };
    return { connect, stats: () => ({ connects, calls }) };
  }

  it("retries a transient failure and returns the eventual result", async () => {
    const { connect, stats } = flaky(2);
    const stub = retryingGameStub(connect, { sleep: noSleep });
    await expect(stub.handle({} as never)).resolves.toMatchObject({ ok: true });
    // A fresh stub per attempt: Cloudflare documents that a stub must not be
    // reused after it throws, so the count tracks the calls, not one connection.
    expect(stats()).toEqual({ connects: 3, calls: 3 });
  });

  it("gives up after the bounded attempts, rethrowing the last failure", async () => {
    const { connect, stats } = flaky(Number.POSITIVE_INFINITY);
    const stub = retryingGameStub(connect, { sleep: noSleep });
    await expect(stub.handle({} as never)).rejects.toThrow(/code was updated/);
    // Three attempts, not an unbounded loop inside a player's request.
    expect(stats().calls).toBe(3);
  });

  it("does not retry an exception the game itself threw", async () => {
    let calls = 0;
    const connect = () =>
      ({
        handle: async () => {
          calls++;
          throw new Error("engine bug: attempted to persist a rejection");
        },
      }) as unknown as GameStub;
    const stub = retryingGameStub(connect, { sleep: noSleep });
    await expect(stub.handle({} as never)).rejects.toThrow(/engine bug/);
    expect(calls).toBe(1);
  });

  it("passes the WebSocket upgrade straight through, unretried", async () => {
    // The client is upgrading one connection and the Request is not replayable,
    // so a retry here would be meaningless rather than merely wasteful.
    let calls = 0;
    const connect = () =>
      ({
        fetch: async () => {
          calls++;
          throw retryable();
        },
      }) as unknown as GameStub;
    const stub = retryingGameStub(connect, { sleep: noSleep });
    await expect(stub.fetch(new Request("https://x/socket"))).rejects.toThrow(/code was updated/);
    expect(calls).toBe(1);
  });

  it("retries the reads and the teardown too, all of which are repeatable", async () => {
    for (const call of [(s: GameStub) => s.session("g", "u"), (s: GameStub) => s.frames({ seat: 0, from: 0, to: 1 }), (s: GameStub) => s.reconcile("g"), (s: GameStub) => s.abort("g")]) {
      let calls = 0;
      const connect = () =>
        new Proxy(
          {},
          {
            get: () => async () => {
              calls++;
              if (calls === 1) throw retryable();
              return null;
            },
          },
        ) as GameStub;
      await call(retryingGameStub(connect, { sleep: noSleep }));
      expect(calls).toBe(2);
    }
  });
});

describe("withRetry", () => {
  it("returns the first success without retrying", async () => {
    const op = vi.fn(async () => "ok");
    expect(await withRetry(op, { shouldRetry: isTransientD1Error, sleep: noSleep })).toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries a retryable failure until it succeeds", async () => {
    let calls = 0;
    const op = vi.fn(async () => {
      calls++;
      if (calls < 3) throw wrapped("Network connection lost");
      return calls;
    });
    const onRetry = vi.fn();
    const result = await withRetry(op, { shouldRetry: isTransientD1Error, sleep: noSleep, onRetry });
    expect(result).toBe(3);
    expect(op).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("throws a non-retryable failure on the first attempt", async () => {
    const op = vi.fn(async () => {
      throw wrapped("UNIQUE constraint failed: x");
    });
    await expect(withRetry(op, { shouldRetry: isTransientD1Error, sleep: noSleep })).rejects.toThrow(/Failed query/);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("gives up after `attempts` and rethrows the last error", async () => {
    const op = vi.fn(async () => {
      throw wrapped("Network connection lost");
    });
    await expect(withRetry(op, { shouldRetry: isTransientD1Error, attempts: 3, sleep: noSleep })).rejects.toThrow(/Failed query/);
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("backs off with a growing, capped, jittered delay", async () => {
    const waits: number[] = [];
    let calls = 0;
    const op = async () => {
      calls++;
      if (calls < 4) throw wrapped("caused object to be reset");
      return calls;
    };
    // Deterministic jitter: Math.random() = 0 makes each wait exactly `delay`.
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      await withRetry(op, { shouldRetry: isTransientD1Error, baseDelayMs: 10, maxDelayMs: 15, sleep: async (ms) => void waits.push(ms) });
    } finally {
      randomSpy.mockRestore();
    }
    // 10, then 20 capped to 15, then 15.
    expect(waits).toEqual([10, 15, 15]);
  });
});
