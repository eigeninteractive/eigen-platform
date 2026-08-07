#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { addContinuousIntegration, applicationId, detectPackageManager, firebaseReadiness, type PackageManager, scaffoldGame } from "./index.js";
import { summarise } from "./summary.js";

const help = `Usage: create-eigen-game <game-slug> [options]
       create-eigen-game add ci [directory] [options]

Creates one repository containing an EigenInteractive Cloudflare Worker and
Flutter app, and commits it. The destination basename is the lowercase
kebab-case game slug; the CLI derives the display name, Dart package name, and
Dart/TypeScript type prefix from it.

Options:
  --ci                   Also emit the GitHub Actions workflows (off by
                         default: release.yml needs an upload keystore and a
                         Play service account, so it fails until both exist)
  --org <reverse-domain> Android/iOS organization (default: com.example). The
                         applicationId is this plus the game name, as in
                         com.example.my_game. Asked for when omitted.
  --no-firebase          Do not configure Firebase. Firebase is configured
                         before the first commit by default, whenever the two
                         CLIs are installed and signed in; this skips it and
                         prints the command to run later
  --firebase-project <id>
                         The Firebase project to configure against, instead of
                         being asked. Works without a terminal, which is how
                         CI drives the step
  --no-git               Do not initialise a repository or commit the scaffold
  --package-manager <pm> npm or pnpm (defaults to the invoking package manager)
  -h, --help             Show this help

Commands:
  add ci [directory]     Add the workflows to an existing project, for when
                         you are ready to ship rather than at scaffold time.
                         Defaults to the current directory.`;

function resolveManager(requested: string | undefined): PackageManager | undefined {
  if (requested === undefined) return undefined;
  if (requested !== "npm" && requested !== "pnpm") {
    throw new Error("--package-manager must be npm or pnpm");
  }
  return requested;
}

/**
 * Whether this run configures Firebase, and against which project.
 *
 * On by default, because a scaffold that stops short of it is not a runnable
 * app: `firebase_options.dart` is a throwing placeholder until this has run,
 * so the first `flutter run` ends at `Firebase is not configured`. Doing it
 * before the scaffold commit also keeps the six files it writes out of the
 * project's first diff.
 *
 * Never at the cost of the scaffold, though. Everything that would make the
 * step fail — no CLIs, no login, no terminal to answer the project prompt on —
 * turns it off and says so, here, before the two minutes of Flutter and pub
 * rather than after them. What is left is exactly a `--no-firebase` scaffold,
 * and the summary ends by naming the command that finishes the job.
 */
function chooseFirebase(disabled: boolean | undefined, project: string | undefined): boolean | string {
  // An explicitly named project settles it: FlutterFire has nothing to ask, so
  // this is also the form that works on a machine with no terminal.
  if (project !== undefined) {
    if (project.trim() === "") throw new Error("--firebase-project needs a project id");
    return project.trim();
  }
  if (disabled === true) return false;

  if (!process.stdin.isTTY) {
    console.log("No terminal to choose a Firebase project on, so Firebase is left unconfigured. Name one with --firebase-project <id>, or run `firebase:configure` later.");
    return false;
  }

  const readiness = firebaseReadiness();
  if (readiness.ready) return true;

  console.log(`\nSkipping Firebase: ${readiness.reason}. Install it with:\n\n  ${readiness.fix}\n\nThe scaffold does not need it — you will be reminded how to configure Firebase at the end.`);
  return false;
}

/**
 * Two or more dot-separated Java identifiers. `flutter create --org` accepts
 * anything and defers the complaint to Gradle, which reports it as a manifest
 * error in a generated file — so `com.example-games` costs a full scaffold and
 * a first build before anyone learns that a hyphen is not legal in a package
 * segment.
 */
const ORG = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+$/;

/** `--org ""` falls through to the default rather than failing, matching what an empty answer to the prompt does. */
function resolveOrg(value: string): string | undefined {
  if (value.trim() === "") return undefined;
  if (!ORG.test(value)) {
    throw new Error(`invalid organization: ${value}\n\nUse reverse domain notation — two or more dot-separated segments of letters, digits and underscores, each starting with a letter, as in com.example or dev.yourname.games.`);
  }
  return value;
}

/**
 * The one value worth interrupting for. It prefixes the Android
 * `applicationId`, which Google Play treats as the permanent identity of the
 * app: it cannot be changed after the first upload, and a game published under
 * the wrong one has to be relisted, losing its install base and reviews.
 * Everything else the scaffolder decides is a find-and-replace away.
 *
 * So the question shows the identifier each answer produces rather than
 * describing how one is derived. `--org com.acme.chess` for a game called
 * `chess` reads like the whole id and is not — it yields
 * `com.acme.chess.chess`, and by the time that is visible in the Play Console
 * it is too late.
 *
 * Skipped when there is no terminal, so `--org` remains the whole interface
 * for CI, `scripts/scaffold-e2e.mjs` and anything piping input.
 */
async function askForOrg(directory: string, registering: boolean): Promise<string | undefined> {
  if (!process.stdin.isTTY) return undefined;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(
      `\nThe organization prefixes the Android applicationId, which Google Play makes permanent at first upload.\nLeaving it gives ${applicationId(directory)}.${
        // The moment the answer stops being local. FlutterFire matches an
        // existing Android app on exactly this string, so it decides whether
        // the run adopts an app the chosen project already has or registers a
        // new one — and it is worth knowing that before answering, not after.
        registering ? "\nThis is also the Android app registered in the Firebase project you pick next." : ""
      }`,
    );
    for (;;) {
      const answer = (await rl.question("Organization in reverse domain notation [com.example]: ")).trim();
      if (answer === "" || ORG.test(answer)) {
        const org = answer === "" ? undefined : answer;
        console.log(`applicationId: ${applicationId(directory, org)}\n`);
        return org;
      }
      console.log("Two or more dot-separated segments, as in com.example or dev.yourname.games.\n");
    }
  } finally {
    rl.close();
  }
}

async function main(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      ci: { type: "boolean" },
      org: { type: "string" },
      // Declared under the name it is typed with, as `no-git` is: `parseArgs`
      // has no boolean negation.
      "no-firebase": { type: "boolean" },
      "firebase-project": { type: "string" },
      // Node's `parseArgs` has no boolean negation, so the flag is declared
      // under the name it is typed with rather than as `git: false`.
      "no-git": { type: "boolean" },
      "package-manager": { type: "string" },
    },
  });

  if (values.help) {
    console.log(help);
    return;
  }

  const requestedManager = resolveManager(values["package-manager"]);

  if (positionals[0] === "add") {
    if (positionals[1] !== "ci") {
      throw new Error(`unknown subcommand: add ${positionals[1] ?? ""}\n\n${help}`.trim());
    }
    if (positionals.length > 3) {
      throw new Error(`expected at most one directory\n\n${help}`);
    }
    const result = addContinuousIntegration({
      directory: positionals[2] ?? process.cwd(),
      packageManager: requestedManager,
    });
    console.log(`Added ${result.files.join(" and ")} in ${result.root}`);
    return;
  }

  if (positionals.length !== 1) {
    throw new Error(`expected exactly one destination directory\n\n${help}`);
  }

  const directory = positionals[0];
  // Before the organization question, so both answers about what this run will
  // do are settled before any of it starts.
  const firebase = chooseFirebase(values["no-firebase"], values["firebase-project"]);
  const org = values.org === undefined ? await askForOrg(directory, firebase !== false) : resolveOrg(values.org);
  const manager = requestedManager ?? detectPackageManager() ?? "pnpm";

  const result = scaffoldGame({
    directory,
    org,
    packageManager: manager,
    ci: values.ci,
    git: !values["no-git"],
    firebase,
  });
  console.log(summarise(result, manager, values.ci === true));
}

try {
  await main(process.argv.slice(2));
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`create-eigen-game: ${message}`);
  process.exitCode = 1;
}
