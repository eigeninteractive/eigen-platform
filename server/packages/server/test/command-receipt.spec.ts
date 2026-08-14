import { describe, expect, it } from "vitest";
import { commandIdentity, commandPrincipal } from "../src/do/command-receipt.js";
import type { Command } from "../src/protocol.js";

const GAME = "game-1";
const ID = "018f5f59-9f9a-7f47-a6f1-d13b33ef4410";

type ActionCommand = Extract<Command, { kind: "action" }>;

function action(data: unknown, actor: "a" | "b" = "a"): ActionCommand {
  return {
    kind: "action",
    gameId: GAME,
    commandId: ID,
    actor: { userId: `user-${actor}`, botId: null },
    seat: actor === "a" ? 0 : 1,
    expectedVersion: 4,
    data,
  };
}

function request(cmd: Command, resource = GAME, data: unknown = cmd.kind === "action" ? cmd.data : null): string {
  const identity = commandIdentity(cmd, resource, data);
  if (identity === null) throw new Error("expected an identity");
  return identity.request;
}

describe("command principals", () => {
  it("scopes a receipt to one immutable id", () => {
    expect(commandPrincipal({ userId: "user-a", botId: null })).toBe("user:user-a");
    expect(commandPrincipal({ userId: null, botId: "bot-1" })).toBe("bot:bot-1");
  });

  it("has no principal for an identity-less system command, so it stores no receipt", () => {
    expect(commandPrincipal(null)).toBeNull();
    expect(commandIdentity({ kind: "lifecycle", type: "timeout", gameId: GAME, commandId: ID, actor: null }, GAME, null)).toBeNull();
  });
});

describe("canonical command requests", () => {
  it("is independent of the order the caller happened to send keys in", () => {
    expect(request(action({ z: 2, a: 1 }))).toBe(request(action({ a: 1, z: 2 })));
  });

  it("separates principal, operation, resource and payload", () => {
    const base = action({ a: 1 });
    const actor = { userId: "user-a", botId: null };
    const join: Command = { kind: "join", gameId: GAME, commandId: ID, actor };
    const leave: Command = { kind: "leave", gameId: GAME, commandId: ID, actor };
    expect(request(base)).not.toBe(request(action({ a: 1 }, "b")));
    expect(request(base)).not.toBe(request(base, "game-2"));
    expect(request(base)).not.toBe(request(base, GAME, { a: 2 }));
    expect(request(base)).not.toBe(request({ ...base, expectedVersion: 5 }));
    expect(request(base)).not.toBe(request({ ...base, seat: 1 }));
    expect(request(join)).not.toBe(request(leave));
  });

  it("uses the schema-normalized payload, so an omitted default and an explicit one agree", () => {
    expect(request(action({}), GAME, { mode: "normal" })).toBe(request(action({ mode: "normal" }), GAME, { mode: "normal" }));
  });

  it("carries the resource the owning object supplied, not the id the caller asked for", () => {
    // `commandIdentity` never reads `cmd.gameId`; the Durable Object passes its
    // own `meta.gameId`, so a receipt cannot name a game it is not authoritative for.
    expect(request({ ...action({ a: 1 }), gameId: "spoofed" }, GAME)).toBe(request(action({ a: 1 }), GAME));
  });

  it("holds a stable document, so an unrelated deploy cannot invalidate live retries", () => {
    expect(request(action({ b: [1, 2], a: "x" }))).toBe('{"operation":"game.action","payload":{"data":{"a":"x","b":[1,2]},"expectedVersion":4,"seat":0},"principal":"user:user-a","resource":"game-1","version":1}');
  });
});
