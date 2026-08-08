#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { cancel, intro, isCI, isTTY, log, note, outro, taskLog } from "@clack/prompts";
import color from "picocolors";
import { addContinuousIntegration, applicationId, destinationProblem, detectPackageManager, type FirebaseProblem, firebaseReadiness, insideWorkTree, normaliseTerminalWidth, type PackageManager, plainReporter, type Reporter, scaffoldGame } from "./index.js";
import { askForGit, askForOrg, askForPackageManager, askForWorkflows, askToScaffoldWithoutFirebase, DEFAULT_ORG, ORG } from "./prompt.js";
import { summarise } from "./summary.js";

const version = (JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8")) as { version: string }).version;

const PREREQUISITES = "https://eigeninteractive.com/docs/getting-started/prerequisites";

const help = `Usage: create-eigen-game <game-slug> [options]
       create-eigen-game add workflows [directory] [options]

Creates one repository containing an EigenInteractive Cloudflare Worker and
Flutter app, and commits it. The destination basename is the lowercase
kebab-case game slug; the CLI derives the display name, Dart package name, and
Dart/TypeScript type prefix from it.

Every option below answers a question the CLI would otherwise ask. Pass it to
skip the question; leave it out to be asked. With no terminal to ask on — CI, a
pipe, an agent session — an unanswered question is an error rather than a
default quietly chosen for you, and the message prints the command to re-run.

Options:
  --org <reverse-domain> Android/iOS organization. The applicationId is this
                         plus the game name, as in com.example.my_game, and
                         Google Play makes it permanent at first upload
  --firebase-project <id>
                         The Firebase project to configure against. Also the
                         form that works with no terminal, since otherwise
                         FlutterFire asks
  --no-firebase          Do not configure Firebase, leaving firebase:configure
                         as a step for later
  --git, --no-git        Initialise a repository and commit the scaffold
  --workflows, --no-workflows
                         Emit the GitHub Actions workflows. release.yml needs
                         an upload keystore and a Play service account, so it
                         fails on every push until both exist
  --package-manager <pm> npm or pnpm. Taken from the invoking package manager
                         when there is one, so this is for global installs
  -h, --help             Show this help
  -v, --version          Show the version

Commands:
  add workflows [directory]
                         Add the workflows to an existing project, for when
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
      open: () => intro(color.inverse(" EigenInteractive ")),
      info: (message: string) => log.info(message),
      warn: (message: string) => log.warn(message),
      success: (message: string) => log.success(message),
      block: (body: string) => note(body, "Next"),
      close: (message: string) => outro(color.bold(message)),
      stop: (message: string) => cancel(message),
    }
  : {
      open: () => console.log("\nEigenInteractive\n"),
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
 * Why a scaffold asks about a second service at all, said once, before the
 * first question rather than in the error that follows it.
 *
 * Firebase is not an integration this engine offers; it is where a player
 * comes from. Somebody meeting that for the first time deserves the reason in
 * the same breath as the requirement, and deserves to know the size of it —
 * one free project, shared by every game they build.
 */
function greet(): void {
  ui.open();
  ui.info("A game is one repository with two halves: a Cloudflare Worker that owns the rules,\nand a Flutter app for Android and the web. This writes both, wired together and\nalready playable.");
  ui.info(
    `Firebase signs your players in. The Worker verifies Firebase ID tokens to decide who\nholds a seat, and sends turn notifications through the same project — so a scaffolded\napp throws ${color.dim("Firebase is not configured")} at launch until one is connected.\n\nIt is free to start, one project serves every game you build, and this connects yours\nas it goes. ${color.dim(PREREQUISITES)}`,
  );
}

/** What is missing, and the one command that fixes each — the same list the warning and the parting message are both built from. */
function firebaseReport(problems: FirebaseProblem[]): string {
  const lines = problems.flatMap((problem) => [`  ${problem.reason}`, `    ${color.cyan(problem.fix)}`]);
  // `dart pub global activate` does not put the binary on PATH, which is the
  // next thing to go wrong for anyone who has just run the command above.
  if (problems.some((problem) => problem.fix.startsWith("dart pub"))) {
    lines.push(`    ${color.dim('…then, if your shell cannot find it: export PATH="$PATH":"$HOME/.pub-cache/bin"')}`);
  }
  return lines.join("\n");
}

/**
 * The parting message when someone answers "no" to scaffolding without
 * Firebase — every command they need, in the order they run in.
 *
 * Deliberately not a failure of the scaffold: nothing has been written, they
 * asked for that, and the exit code is non-zero only so a script that wrapped
 * this can tell there is no project.
 */
function stopForFirebase(problems: FirebaseProblem[]): void {
  // The commands only. What each one is for is in the warning directly above,
  // and a `note` draws a box sized to its longest line — so repeating the
  // reasons here is what makes it wrap into something unreadable at 80
  // columns, which is exactly the width this is most likely to be read at.
  note(`${problems.map((problem) => `  ${color.cyan(problem.fix)}`).join("\n")}\n\nThen run this again.\n${color.dim(PREREQUISITES)}`, "Set up Firebase");
  ui.stop("Nothing was written.");
  process.exitCode = 1;
}

/**
 * The error for a run with no terminal and an unanswered question.
 *
 * The strictness is the point — a default applied where nobody can see it is
 * how `com.example.my_game` reaches Google Play, which freezes it at the first
 * upload. What keeps that from being merely annoying is this message: the
 * whole command, with every default already filled in, so the fix is one
 * paste and the one value worth changing is visible in it.
 */
function unanswered(directory: string, missing: { flags: string; suggestion: string }[]): string {
  const command = ["npx create-eigen-game", directory, ...missing.map((question) => question.suggestion)].join(" ");
  return [`No terminal to ask on, so every answer has to come from a flag. These were not given:`, "", ...missing.map((question) => `  ${question.flags}`), "", "That command, with each default filled in — read them before you run it:", "", `  ${command}`].join("\n");
}

/** `--foo` and `--no-foo`, which `parseArgs` has no notion of: `undefined` means nobody said, which is what makes it a question. */
function flagPair(yes: boolean | undefined, no: boolean | undefined, name: string): boolean | undefined {
  if (yes === true && no === true) throw new Error(`--${name} and --no-${name} contradict each other`);
  if (yes === true) return true;
  if (no === true) return false;
  return undefined;
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
      version: { type: "boolean", short: "v" },
      org: { type: "string" },
      "firebase-project": { type: "string" },
      // Each negation is declared under the name it is typed with, because
      // `parseArgs` has no boolean negation of its own. `flagPair` puts the
      // two halves back together, and the third state — neither given — is the
      // one that matters: it is what turns the flag into a question.
      "no-firebase": { type: "boolean" },
      git: { type: "boolean" },
      "no-git": { type: "boolean" },
      workflows: { type: "boolean" },
      "no-workflows": { type: "boolean" },
      "package-manager": { type: "string" },
    },
  });

  if (values.help) {
    console.log(help);
    return;
  }
  if (values.version) {
    console.log(version);
    return;
  }

  const requestedManager = resolveManager(values["package-manager"]);

  if (positionals[0] === "add") {
    // `ci` is the name this shipped under, and it is written into the README
    // of every project already scaffolded. Those READMEs are on disk and are
    // not going to be edited, so the old spelling keeps working; only the new
    // one is documented.
    if (positionals[1] !== "workflows" && positionals[1] !== "ci") {
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

  // Everything that makes the command impossible, before the greeting rather
  // than after the last question. `applicationId` validates the slug;
  // `destinationProblem` is the one `scaffoldGame` would raise at the far end,
  // asked here instead — being told the directory was occupied *after* giving
  // an organization is the same insult as being told about `flutterfire` after
  // two minutes of Flutter and pub.
  const game = basename(resolve(directory));
  applicationId(directory);
  const occupied = destinationProblem(directory);
  if (occupied !== undefined) throw new Error(occupied);

  greet();

  // Every question this run will ask, settled before any of it starts. A flag
  // is an answer already given; anything left over is asked, or — with nothing
  // to ask on — collected here and reported together, so one re-run can carry
  // all of them.
  const interactive = process.stdin.isTTY === true;
  const missing: { flags: string; suggestion: string }[] = [];
  const cancelled = () => {
    ui.stop("Nothing was written.");
    process.exitCode = 130;
  };

  /**
   * Records a question that could not be asked, and hands back the default it
   * suggested. The value is never used — `missing` throws before anything is
   * written — but returning it keeps each answer definitely typed instead of
   * carrying a `| undefined` all the way to the scaffold call.
   */
  const needsFlag = <T>(flags: string, suggestion: string, fallback: T): T => {
    missing.push({ flags, suggestion });
    return fallback;
  };

  // Firebase goes first because it is the only answer that can end the run,
  // and ending it after the organization prompt would mean asking for a
  // permanent decision about a project that never gets created.
  const project = values["firebase-project"]?.trim();
  if (project === "") throw new Error("--firebase-project needs a project id");
  if (project !== undefined && values["no-firebase"] === true) {
    throw new Error("--firebase-project and --no-firebase contradict each other");
  }

  let firebase: boolean | string = false;
  if (project !== undefined) {
    firebase = project;
  } else if (values["no-firebase"] !== true) {
    const readiness = firebaseReadiness();
    if (readiness.ready) {
      // Nothing for this CLI to ask: FlutterFire runs its own project picker
      // during the scaffold, and needs a terminal to do it.
      if (interactive) firebase = true;
      else firebase = needsFlag("--firebase-project <id>, or --no-firebase", "--no-firebase", false);
    } else {
      ui.warn(`Firebase is not set up on this machine:\n\n${firebaseReport(readiness.problems)}`);
      if (!interactive) {
        firebase = needsFlag("--no-firebase, to scaffold without it", "--no-firebase", false);
      } else {
        const carryOn = await askToScaffoldWithoutFirebase();
        if (carryOn === null) return cancelled();
        if (!carryOn) return stopForFirebase(readiness.problems);
      }
    }
  }

  let org: string | undefined;
  if (values.org !== undefined) {
    org = resolveOrg(values.org);
  } else if (interactive) {
    const answer = await askForOrg(game.replaceAll("-", "_"), firebase !== false);
    if (answer === null) return cancelled();
    org = answer;
  } else {
    org = needsFlag("--org <reverse-domain>", `--org ${DEFAULT_ORG}`, undefined);
  }

  // A destination inside a repository someone already has is not a question:
  // `scaffoldGame` declines to nest one repository in another whatever it is
  // told, and says so in the summary.
  let git = flagPair(values.git, values["no-git"], "git");
  if (git === undefined && insideWorkTree(directory)) git = true;
  if (git === undefined) {
    if (!interactive) git = needsFlag("--git or --no-git", "--git", true);
    else {
      const answer = await askForGit();
      if (answer === null) return cancelled();
      git = answer;
    }
  }

  let workflows = flagPair(values.workflows, values["no-workflows"], "workflows");
  if (workflows === undefined) {
    if (!interactive) workflows = needsFlag("--workflows or --no-workflows", "--no-workflows", false);
    else {
      const answer = await askForWorkflows();
      if (answer === null) return cancelled();
      workflows = answer;
    }
  }

  // Reached only when nothing else could say — `npm create` and `pnpm create`
  // both announce themselves in `npm_config_user_agent`. What is left is a
  // global install, where the old silent fallback to pnpm was a guess written
  // into every script in the generated project.
  let manager = requestedManager ?? detectPackageManager();
  if (manager === undefined) {
    if (!interactive) manager = needsFlag("--package-manager <npm|pnpm>", "--package-manager pnpm", "pnpm" as PackageManager);
    else {
      const answer = await askForPackageManager();
      if (answer === null) return cancelled();
      manager = answer;
    }
  }

  if (missing.length > 0) throw new Error(unanswered(directory, missing));

  ui.success(`applicationId ${color.bold(applicationId(directory, org))}`);

  const result = scaffoldGame({
    directory,
    org,
    packageManager: manager,
    ci: workflows,
    git,
    firebase,
    reporter: clackReporter(),
  });

  const { status, next, footnotes, headline } = summarise(result, manager, workflows);
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
