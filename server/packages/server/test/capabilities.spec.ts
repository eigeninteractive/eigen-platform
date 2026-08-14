/**
 * Version resolution: which schemaVersions a deployment can run, and which it
 * creates at.
 *
 * The two are separate questions and neither follows from the other. Support is
 * sparse (a build may ship `{1, 3}` once v2 has drained) and creation is a subset
 * of support (a version is retired by leaving it supported but no longer
 * creatable). The HTTP behaviour these feed — exact membership on join, the
 * creation gate, and `GET /capabilities` — is driven in `engine.spec.ts`.
 */

import type { GameModule } from "@eigeninteractive/rules";
import { describe, expect, it } from "vitest";
import { resolveCreatableSchemaVersions, supportedSchemaVersions } from "../src/engine.js";

/** Only the `versions` keys matter here; the rules units are never invoked. */
const shipping = (...versions: number[]) => ({ versions: Object.fromEntries(versions.map((v) => [v, {}])) }) as unknown as GameModule;

describe("supportedSchemaVersions", () => {
  it("reports the shipped versions ascending, however the map was written", () => {
    expect(supportedSchemaVersions(shipping(3, 1))).toEqual([1, 3]);
  });

  it("reports nothing for a deployment that ships no game", () => {
    expect(supportedSchemaVersions(shipping())).toEqual([]);
  });
});

describe("resolveCreatableSchemaVersions", () => {
  it("defaults to the highest shipped version alone", () => {
    // Ship new rules and new games use them. A client that cannot create at that
    // version is out of date and is told to update; it still joins and replays
    // every version it does ship, because that is governed by `versions`.
    expect(resolveCreatableSchemaVersions(shipping(1, 3), undefined)).toEqual([3]);
  });

  it("takes a configured override, deduplicated and sorted", () => {
    // Rolling creation back to v1 after a bad v3 release, WITHOUT unshipping v3:
    // games already at v3 must keep loading, so removing it from `versions` is
    // not an option and this is.
    expect(resolveCreatableSchemaVersions(shipping(1, 3), [1, 1])).toEqual([1]);
  });

  it("fails fast on a version the deployment does not ship", () => {
    // A boot error beats discovering this from a player's refused create.
    expect(() => resolveCreatableSchemaVersions(shipping(1, 3), [2])).toThrow(/\[2\] are not among the shipped versions \[1, 3\]/);
  });

  it("accepts an empty list, which is how a game-less deployment says so", () => {
    // A site- or notification-only worker creates nothing, and that is not a
    // misconfiguration to reject at boot.
    expect(resolveCreatableSchemaVersions(shipping(1), [])).toEqual([]);
    expect(resolveCreatableSchemaVersions(shipping(), undefined)).toEqual([]);
  });
});
