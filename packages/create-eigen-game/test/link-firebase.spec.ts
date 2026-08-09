import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configuredProject, configuredWebClientId, readFirebaseLink } from "../src/link-firebase.js";

let root: string;

/** A scaffold as it stands the moment `configure_firebase` returns. */
function project(options: { projectId?: string; clientId?: string } = {}): void {
  mkdirSync(resolve(root, "app"), { recursive: true });
  writeFileSync(resolve(root, "app/app-config.json"), `${JSON.stringify({ API_BASE_URL: "http://localhost:8787", APP_HOST: "", GOOGLE_WEB_CLIENT_ID: options.clientId ?? "", FIREBASE_VAPID_KEY: "" }, null, 2)}\n`);
  if (options.projectId !== undefined) {
    writeFileSync(resolve(root, "app/firebase.json"), JSON.stringify({ flutter: { platforms: { dart: { "lib/firebase_options.dart": { projectId: options.projectId, configurations: { web: "1:1:web:1" } } } } } }));
  }
}

beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), "eigen-link-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("readFirebaseLink", () => {
  it("reports what the Firebase step settled", () => {
    project({ projectId: "go-fish-1a2b3", clientId: "1-web.apps.googleusercontent.com" });

    expect(readFirebaseLink(root)).toEqual({ projectId: "go-fish-1a2b3", googleWebClientId: "1-web.apps.googleusercontent.com" });
  });

  it("reads an empty client id as nothing to report", () => {
    // What a project whose Google sign-in provider was never enabled looks
    // like: configured, but with no OAuth client for `configure_firebase` to
    // have copied.
    project({ projectId: "go-fish-1a2b3" });

    expect(readFirebaseLink(root)).toEqual({ projectId: "go-fish-1a2b3", googleWebClientId: null });
  });

  it("reports nothing when Firebase wrote nothing to read", () => {
    project();

    expect(readFirebaseLink(root)).toEqual({ projectId: null, googleWebClientId: null });
  });

  it("treats an unreadable file as an absent one", () => {
    project({ projectId: "go-fish-1a2b3" });
    writeFileSync(resolve(root, "app/firebase.json"), "{ not json");

    // Nothing here is worth failing a scaffold that has already published a
    // complete project for.
    expect(() => readFirebaseLink(root)).not.toThrow();
    expect(readFirebaseLink(root).projectId).toBeNull();
  });
});

describe("configuredProject", () => {
  it("ignores a firebase.json whose shape is not the one FlutterFire writes", () => {
    project();
    writeFileSync(resolve(root, "app/firebase.json"), JSON.stringify({ flutter: { platforms: { android: { default: { projectId: "go-fish" } } } } }));

    // An Android entry is not the Dart output this app reads its options from.
    expect(configuredProject(resolve(root, "app"))).toBeNull();
  });
});

describe("configuredWebClientId", () => {
  it("is null when there is no app-config.json at all", () => {
    expect(configuredWebClientId(resolve(root, "app"))).toBeNull();
  });
});
