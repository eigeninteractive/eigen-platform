/**
 * `withRetry` and its transient-D1 predicate: the durability wrapper around
 * the fire-and-forget summary mirrors.
 */

import { describe, expect, it, vi } from "vitest";
import { isTransientD1Error, withRetry } from "../src/index.js";

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

describe("withRetry", () => {
  it("returns the first success without retrying", async () => {
    const op = vi.fn(async () => "ok");
    expect(await withRetry(op, { sleep: noSleep })).toBe("ok");
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
    const result = await withRetry(op, { sleep: noSleep, onRetry });
    expect(result).toBe(3);
    expect(op).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("throws a non-retryable failure on the first attempt", async () => {
    const op = vi.fn(async () => {
      throw wrapped("UNIQUE constraint failed: x");
    });
    await expect(withRetry(op, { sleep: noSleep })).rejects.toThrow(/Failed query/);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("gives up after `attempts` and rethrows the last error", async () => {
    const op = vi.fn(async () => {
      throw wrapped("Network connection lost");
    });
    await expect(withRetry(op, { attempts: 3, sleep: noSleep })).rejects.toThrow(/Failed query/);
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
      await withRetry(op, { baseDelayMs: 10, maxDelayMs: 15, sleep: async (ms) => void waits.push(ms) });
    } finally {
      randomSpy.mockRestore();
    }
    // 10, then 20 capped to 15, then 15.
    expect(waits).toEqual([10, 15, 15]);
  });
});
