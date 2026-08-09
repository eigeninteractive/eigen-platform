/**
 * Reads the two deployment values that exist only once a Firebase project
 * does, so the closing summary can name what is still missing.
 *
 * Reading only. `configure_firebase` writes them, into `wrangler.jsonc` and
 * `app-config.json`, because it is also what a project runs later when
 * reconfiguring, and one implementation is what keeps the scaffold-time path
 * and the re-run path identical. This module exists so the summary can tell
 * the difference between "filled in" and "still owed", not to do it again.
 *
 * Its own module for the same reason `summary.ts` is: `index.ts` runs a
 * scaffold, and this is worth asserting without one. The package `exports` map
 * does not expose it.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** What the Firebase step managed to settle, and what it left for the console. */
export interface FirebaseLink {
  /** The project now in `wrangler.jsonc`, or null when FlutterFire recorded none. */
  projectId: string | null;
  /** The OAuth web client now in `app-config.json`, or null when Google sign-in is not enabled yet. */
  googleWebClientId: string | null;
}

function readJson(path: string): unknown {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // A file this step only reads is never worth failing a finished scaffold
    // for. The value counts as unset, and the summary says so.
    return undefined;
  }
}

/**
 * The project FlutterFire recorded for the Dart output this app uses.
 *
 * `firebase.json` is FlutterFire's own record rather than something this
 * scaffold writes, so it is read defensively: a shape that does not match is
 * treated as "not configured", which is the same answer as a run that never
 * happened.
 */
export function configuredProject(appRoot: string): string | null {
  const record = readJson(resolve(appRoot, "firebase.json")) as { flutter?: { platforms?: { dart?: Record<string, { projectId?: unknown }> } } } | undefined;
  const projectId = record?.flutter?.platforms?.dart?.["lib/firebase_options.dart"]?.projectId;
  return typeof projectId === "string" && projectId !== "" ? projectId : null;
}

/**
 * The OAuth web client id that `configure_firebase` copied into
 * `app-config.json`, when there was one to copy.
 *
 * Empty is an ordinary outcome rather than a failure. Firebase creates that
 * client when the Google sign-in provider is enabled, which is a console
 * action no CLI can perform, so a project that has never had it enabled has
 * nothing to offer here.
 */
export function configuredWebClientId(appRoot: string): string | null {
  const config = readJson(resolve(appRoot, "app-config.json")) as Record<string, unknown> | undefined;
  const value = config?.GOOGLE_WEB_CLIENT_ID;
  return typeof value === "string" && value !== "" ? value : null;
}

/** What the Firebase step settled, for the summary to report. */
export function readFirebaseLink(root: string): FirebaseLink {
  const appRoot = resolve(root, "app");
  return { projectId: configuredProject(appRoot), googleWebClientId: configuredWebClientId(appRoot) };
}
