#!/usr/bin/env node
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import { cancel, intro, isCI, isTTY, log, note, outro, taskLog } from "@clack/prompts";
import color from "picocolors";
import { addContinuousIntegration, applicationId, detectPackageManager, firebaseReadiness, normaliseTerminalWidth, type PackageManager, plainReporter, type Reporter, scaffoldGame } from "./index.js";
import { askForOrg, DEFAULT_ORG, ORG } from "./prompt.js";
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

normaliseTerminalWidth(process.stdout);

/**
 * Whether to draw, using clack's own predicates rather than a hand-rolled
 * `isTTY` — the same pair `taskLog` consults internally. A pipe has nowhere to
 * put a redraw, and a CI log is read after the fact, in full, by someone who
 * wants every line a tool printed.
 */
const decorated = isTTY(process.stdout) && !isCI();

/**
 * The CLI's voice, in whichever of the two registers this terminal supports.
 *
 * Every message goes through here so the undecorated path cannot drift into
 * being the untested one.
 */
const ui = decorated
  ? {
      open: () => intro(color.inverse(" create-eigen-game ")),
      info: (message: string) => log.info(message),
      warn: (message: string) => log.warn(message),
      success: (message: string) => log.success(message),
      block: (body: string) => note(body, "Next"),
      close: (message: string) => outro(color.bold(message)),
      stop: (message: string) => cancel(message),
    }
  : {
      open: () => console.log("\ncreate-eigen-game\n"),
      info: (message: string) => console.log(message),
      warn: (message: string) => console.warn(message),
      success: (message: string) => console.log(message),
      block: (body: string) => console.log(`\n${body}\n`),
      close: (message: string) => console.log(message),
      stop: (message: string) => console.error(message),
    };

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
    ui.info("No terminal to choose a Firebase project on, so Firebase is left unconfigured.\nName one with --firebase-project <id>, or configure it later.");
    return false;
  }

  const readiness = firebaseReadiness();
  if (readiness.ready) return true;

  ui.warn(`Skipping Firebase: ${readiness.reason}.\n\n  ${color.cyan(readiness.fix)}\n\nThe scaffold does not need it, and ends by naming the command that finishes the job.`);
  return false;
}

/** `--org ""` falls through to the default rather than failing, matching what an empty answer to the prompt does. */
function resolveOrg(value: string): string | undefined {
  if (value.trim() === "") return undefined;
  if (!ORG.test(value)) {
    throw new Error(`invalid organization: ${value}\n\nUse reverse domain notation — two or more dot-separated segments of letters, digits and underscores, each starting with a letter, as in ${DEFAULT_ORG} or dev.yourname.games.`);
  }
  return value;
}

/**
 * Shows each step running, and keeps its output only when it fails.
 *
 * Every tool a scaffold drives has plenty to say — pub resolving 179
 * dependencies, two icon generators, a package manager — and none of it is
 * read while it scrolls past. `taskLog` is exactly that bargain: the stream is
 * visible while the step runs, cleared when it succeeds, and left on screen
 * when it does not, so a failure is still debuggable from what is in the
 * terminal.
 *
 * `handOver` is the exception, and the reason `interactive` exists at all.
 * FlutterFire asks which Firebase project to use, so that step needs the
 * terminal rather than a captured pipe.
 */
function clackReporter(): Reporter {
  // `taskLog` redraws by clearing lines, which is an escape-sequence storm in
  // anything that is not a terminal — a CI log, a pipe, `scaffold-e2e.mjs`.
  // There, the honest thing is the plain reporter: every tool's output, in
  // full, which is what a log gets read for anyway.
  if (!decorated) return plainReporter;

  let task: ReturnType<typeof taskLog> | undefined;
  let interactive = false;

  return {
    step(label, body) {
      task = taskLog({ title: label });
      try {
        const value = body();
        task.success(label);
        return value;
      } catch (error) {
        task.error(label);
        throw error;
      } finally {
        task = undefined;
      }
    },
    handOver(label, body) {
      log.step(`${label} ${color.dim("— FlutterFire takes over here")}`);
      interactive = true;
      try {
        return body();
      } finally {
        interactive = false;
      }
    },
    emit(output) {
      const text = output.trimEnd();
      if (text !== "") task?.message(text);
    },
    warn(message) {
      ui.warn(message);
    },
    get interactive() {
      return interactive;
    },
  };
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
  const manager = requestedManager ?? detectPackageManager() ?? "pnpm";

  ui.open();

  // Both decisions about what this run will do, settled before any of it
  // starts. `applicationId` validates the slug on the way, so a destination
  // that cannot be a game name fails here rather than after the first prompt.
  const game = basename(resolve(directory));
  applicationId(directory);
  const firebase = chooseFirebase(values["no-firebase"], values["firebase-project"]);

  let org: string | undefined;
  if (values.org === undefined && process.stdin.isTTY) {
    const answer = await askForOrg(game.replaceAll("-", "_"), firebase !== false);
    if (answer === null) {
      ui.stop("Nothing was written.");
      process.exitCode = 130;
      return;
    }
    org = answer;
  } else if (values.org !== undefined) {
    org = resolveOrg(values.org);
  }

  ui.success(`applicationId ${color.bold(applicationId(directory, org))}`);

  const result = scaffoldGame({
    directory,
    org,
    packageManager: manager,
    ci: values.ci,
    git: !values["no-git"],
    firebase,
    reporter: clackReporter(),
  });

  const { status, next, footnotes, headline } = summarise(result, manager, values.ci === true);
  for (const line of status) ui.success(line);
  ui.block(next);
  for (const line of footnotes) ui.info(line);
  ui.close(headline);
}

try {
  await main(process.argv.slice(2));
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  ui.stop(`create-eigen-game: ${message}`);
  process.exitCode = 1;
}
