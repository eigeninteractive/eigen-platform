/**
 * FCM configuration seam: the parser reads the service account from env by
 * the `FIREBASE_*` convention. `createEngine` turns a missing account into a
 * production configuration error; test workers pair their local verifier with
 * explicit no-op Firebase Admin effects. The network send path needs real
 * Google credentials and is exercised in production, not here.
 */

import { describe, expect, it } from "vitest";
import { createEngine } from "../src/engine.js";
import { fcmMessageForTarget, readServiceAccount } from "../src/notify/fcm.js";

describe("readServiceAccount", () => {
  it("returns null when any FIREBASE_* var is missing or empty", () => {
    expect(readServiceAccount({})).toBeNull();
    expect(readServiceAccount({ FIREBASE_PROJECT_ID: "p", FIREBASE_CLIENT_EMAIL: "e@x" })).toBeNull();
    expect(readServiceAccount({ FIREBASE_PROJECT_ID: "p", FIREBASE_CLIENT_EMAIL: "e@x", FIREBASE_PRIVATE_KEY: "" })).toBeNull();
  });

  it("reads the account and un-escapes newlines in the PEM key", () => {
    const sa = readServiceAccount({
      FIREBASE_PROJECT_ID: "proj",
      FIREBASE_CLIENT_EMAIL: "svc@proj.iam",
      FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nMIIB\\n-----END PRIVATE KEY-----\\n",
    });
    expect(sa).not.toBeNull();
    expect(sa?.projectId).toBe("proj");
    expect(sa?.privateKey).toBe("-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----\n");
  });
});

describe("fcmMessageForTarget", () => {
  const message = {
    title: "Your turn",
    body: "It's your move.",
    data: { category: "yourTurn", deepLink: "/game/game-1" },
  };

  it("targets the Firebase Installation ID", () => {
    expect(fcmMessageForTarget({ fid: "installation-1", platform: "android" }, message)).toEqual({
      fid: "installation-1",
      notification: { title: "Your turn", body: "It's your move." },
      data: message.data,
    });
  });

  it("adds an absolute secure click-through only for web installations", () => {
    expect(fcmMessageForTarget({ fid: "installation-1", platform: "web" }, message, "https://play.example")).toEqual({
      fid: "installation-1",
      notification: { title: "Your turn", body: "It's your move." },
      data: message.data,
      webpush: { fcm_options: { link: "https://play.example/game/game-1" } },
    });
    expect(fcmMessageForTarget({ fid: "installation-1", platform: "ios" }, message, "https://play.example")).not.toHaveProperty("webpush");
    expect(fcmMessageForTarget({ fid: "installation-1", platform: "web" }, message, "http://localhost:7357")).not.toHaveProperty("webpush");
    expect(fcmMessageForTarget({ fid: "installation-1", platform: "web" }, { ...message, data: { ...message.data, deepLink: "//attacker.example/game/game-1" } }, "https://play.example")).not.toHaveProperty("webpush");
  });
});

describe("createEngine Firebase Admin requirement", () => {
  const production = createEngine({
    gameModule: { versions: {} },
    appName: "Config Test",
    d1: (): never => {
      throw new Error("D1 should not be reached");
    },
    gameDO: (): never => {
      throw new Error("GameDO should not be reached");
    },
  });

  it("rejects engine traffic before auth when credentials are missing", async () => {
    const fetch = production.fetch;
    if (fetch === undefined) throw new Error("createEngine returned no fetch");
    const response = await fetch(new Request("https://example.test/api/engine/me"), {}, {} as ExecutionContext);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Firebase Admin is not configured; set FIREBASE_PROJECT_ID, " + "FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY",
    });
  });

  it("keeps the public health probe configuration-free", async () => {
    const fetch = production.fetch;
    if (fetch === undefined) throw new Error("createEngine returned no fetch");
    const response = await fetch(new Request("https://example.test/health"), {}, {} as ExecutionContext);

    expect(response.status).toBe(200);
  });
});

describe("createEngine browser-origin convention", () => {
  const baseConfig = {
    gameModule: { versions: {} },
    appName: "Origin Test",
    d1: (): never => {
      throw new Error("D1 should not be reached");
    },
    gameDO: (): never => {
      throw new Error("GameDO should not be reached");
    },
  };

  async function preflight(handler: ReturnType<typeof createEngine>, env: object, origin: string): Promise<Response> {
    const fetch = handler.fetch;
    if (fetch === undefined) throw new Error("createEngine returned no fetch");
    return await fetch(
      new Request("https://worker.example/api/engine/me", {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
        },
      }),
      env,
      {} as ExecutionContext,
    );
  }

  it("trusts WEB_APP_ORIGIN when clientOrigins is omitted", async () => {
    const response = await preflight(createEngine(baseConfig), { WEB_APP_ORIGIN: "https://app.example/" }, "https://app.example");

    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.example");
  });

  it("lets an explicit clientOrigins list replace the convention", async () => {
    const handler = createEngine({ ...baseConfig, clientOrigins: ["https://preview.example"] });
    const env = { WEB_APP_ORIGIN: "https://app.example" };

    const conventional = await preflight(handler, env, "https://app.example");
    expect(conventional.headers.get("access-control-allow-origin")).toBeNull();

    const explicit = await preflight(handler, env, "https://preview.example");
    expect(explicit.headers.get("access-control-allow-origin")).toBe("https://preview.example");
  });
});
