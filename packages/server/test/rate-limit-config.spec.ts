/**
 * The engine owns the rate-limit policy: the default numbers, the conventional
 * binding names, and the Wrangler block built from them. These guard that the
 * three stay internally consistent, so the "paste the block and it wires
 * itself" contract cannot silently break — a renamed convention or a stray
 * period would surface here rather than as rate limiting that never engages.
 */

import { describe, expect, it } from "vitest";
import { defaultRateLimitsConfig, RATE_LIMIT_BINDING, RATE_LIMIT_DEFAULTS } from "../src/rate-limit.js";

const NAMES = Object.keys(RATE_LIMIT_DEFAULTS) as (keyof typeof RATE_LIMIT_DEFAULTS)[];

describe("rate-limit defaults", () => {
  it("only uses periods the platform accepts (10 or 60)", () => {
    for (const name of NAMES) {
      expect([10, 60]).toContain(RATE_LIMIT_DEFAULTS[name].period);
      expect(RATE_LIMIT_DEFAULTS[name].limit).toBeGreaterThan(0);
    }
  });

  it("names a conventional binding for every limiter", () => {
    // Exhaustive both ways: a limiter with no binding name would never resolve
    // by convention, and a binding name with no limiter is dead config.
    expect(Object.keys(RATE_LIMIT_BINDING).sort()).toEqual([...NAMES].sort());
  });
});

describe("defaultRateLimitsConfig", () => {
  const block = defaultRateLimitsConfig();

  it("emits one entry per limiter, under its conventional name and default rule", () => {
    expect(block).toHaveLength(NAMES.length);
    for (const entry of block) {
      const name = NAMES.find((n) => RATE_LIMIT_BINDING[n] === entry.name);
      expect(name, `binding ${entry.name} maps to a known limiter`).toBeDefined();
      expect(entry.simple).toEqual(RATE_LIMIT_DEFAULTS[name as keyof typeof RATE_LIMIT_DEFAULTS]);
    }
  });

  it("gives each limiter a distinct namespace, so they count independently", () => {
    const ids = block.map((e) => e.namespace_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
