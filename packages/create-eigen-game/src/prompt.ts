/**
 * Every question this CLI asks, in one module so the wording lives together
 * and can be asserted — `cli.ts` is the bin entry and runs `main` on import,
 * which makes anything defined there untestable.
 *
 * The organization prompt is the reason this drops to `@clack/core` rather
 * than using `@clack/prompts`' `text`. The suffix: `flutter create --org X
 * --project-name Y` derives `X.Y`, so the organization is a *prefix*, and the
 * reliable way to say so is to render the rest of the identifier, dimmed,
 * while it is being typed. `text` has no hook for that; a custom `TextPrompt`
 * render returns a string, so it does.
 *
 * Everything else comes from `@clack/prompts` rather than being drawn here.
 * Its symbols are exported for exactly this, and they are not constants: each
 * falls back to ASCII on a terminal that cannot show the box-drawing
 * characters, which a hand-typed `│` cannot do.
 */
import type { Readable, Writable } from "node:stream";
import { TextPrompt } from "@clack/core";
import { confirm, isCancel, S_BAR, S_BAR_END, select, symbol } from "@clack/prompts";
import color from "picocolors";
import type { PackageManager } from "./index.js";

/**
 * Where a question reads its answer from. Parameters for the same reason every
 * clack prompt takes them: a prompt is otherwise the one part of a CLI that
 * cannot be driven by a test.
 */
export interface Io {
  input?: Readable;
  output?: Writable;
}

/**
 * Two or more dot-separated Java identifiers. `flutter create --org` accepts
 * anything and defers the complaint to Gradle, which reports it as a manifest
 * error in a generated file — so `com.example-games` costs a full scaffold and
 * a first build before anyone learns that a hyphen is not legal in a package
 * segment.
 */
export const ORG = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+$/;

/** The default, which an empty answer accepts. */
export const DEFAULT_ORG = "com.example";

const bar = color.gray(S_BAR);

/** A `com.acme.chess` answer to a game called `chess`, which yields `com.acme.chess.chess`. */
export function repeatsGameName(org: string, game: string): boolean {
  return org.split(".").at(-1) === game;
}

/** The organization implied by an answer that already ends in the game name. */
export function withoutGameName(org: string): string | undefined {
  const shorter = org.split(".").slice(0, -1).join(".");
  return ORG.test(shorter) ? shorter : undefined;
}

/**
 * Asks, with the game name rendered dimmed after the cursor so the shape of
 * the answer is visible while it is being given.
 *
 * Returns the organization, `undefined` for the default, or `null` when
 * cancelled.
 *
 * `input` and `output` default to this process's, and are parameters for the
 * same reason every clack prompt takes them: a prompt is otherwise the one
 * part of a CLI that cannot be driven by a test.
 */
export async function askForOrg(game: string, registering: boolean, io: Io = {}): Promise<string | undefined | null> {
  const input = io.input ?? process.stdin;
  const output = io.output ?? process.stdout;
  const suffix = color.dim(`.${game}`);
  const prompt = new TextPrompt({
    input,
    output,
    // An empty answer is the default, not a mistake.
    validate: (value) => (value === undefined || value === "" || ORG.test(value) ? undefined : "Two or more dot-separated segments, as in com.example or dev.yourname.games."),
    render() {
      const typed = String(this.value ?? "");
      const shown = typed === "" ? `${color.dim(DEFAULT_ORG)}${suffix}` : `${this.userInputWithCursor}${suffix}`;
      const problem = this.state === "error" ? `\n${bar}  ${color.yellow(this.error ?? "")}` : "";
      return [`${bar}`, `${symbol(this.state)}  Organization in reverse domain notation`, `${bar}  ${shown}${problem}`, color.gray(S_BAR_END)].join("\n");
    },
  });

  // The two things that make this answer permanent, said before it is given
  // rather than after: Google Play freezes the identifier at the first upload,
  // and FlutterFire matches an existing Android app on exactly this string, so
  // it also decides whether the run adopts an app the chosen Firebase project
  // already has or registers a new one.
  output.write(`${bar}  ${color.dim("Prefixes the Android applicationId, which Google Play makes permanent at first upload.")}\n`);
  if (registering) output.write(`${bar}  ${color.dim("Also the Android app registered in the Firebase project you pick next.")}\n`);

  const answer = await prompt.prompt();
  if (isCancel(answer)) return null;

  const org = String(answer).trim();
  if (org === "" || org === DEFAULT_ORG) return undefined;

  // The mistake the dimmed suffix is there to prevent, caught for the person
  // who pasted an identifier rather than typing one and never watched it grow.
  const shorter = repeatsGameName(org, game) ? withoutGameName(org) : undefined;
  if (shorter !== undefined) {
    const shorten = await confirm({
      message: `That gives ${color.yellow(`${org}.${game}`)} — the game name twice. Use ${color.green(shorter)} instead?`,
      initialValue: true,
      input,
      output,
    });
    if (isCancel(shorten)) return null;
    if (shorten) return shorter;
  }

  return org;
}

/**
 * A yes/no question, with its reason on the line above.
 *
 * The three below share this so cancellation is handled in one place: ^C
 * during any question has to mean the run stops having written nothing, and
 * that is only true if every call site checks. `null` is that answer.
 *
 * `hint` is written rather than passed to `confirm`, which has nowhere to put
 * it. It is the same dimmed line the organization prompt uses, and carries the
 * thing that makes the default the default — a question whose answer is
 * pre-chosen owes the reader why.
 */
async function ask(message: string, initialValue: boolean, hint: string, io: Io): Promise<boolean | null> {
  const input = io.input ?? process.stdin;
  const output = io.output ?? process.stdout;
  output.write(`${bar}\n${bar}  ${color.dim(hint)}\n`);
  const answer = await confirm({ message, initialValue, input, output });
  return isCancel(answer) ? null : answer;
}

/**
 * Asked only when {@link firebaseReadiness} found something missing, and
 * defaulted to "no" because the honest answer usually is: the tools are two
 * commands away, and the alternative is an app that throws at launch until
 * they are installed anyway.
 */
export function askToScaffoldWithoutFirebase(io: Io = {}): Promise<boolean | null> {
  return ask("Scaffold anyway, and connect Firebase yourself later?", false, "Everything except the app's sign-in still works, and `firebase:configure` finishes the job.", io);
}

/** Defaulted to yes: the scaffold is a few hundred generated files, and a commit is what makes the first `git diff` the first game change rather than all of them. */
export function askForGit(io: Io = {}): Promise<boolean | null> {
  return ask("Initialise a git repository and commit the scaffold?", true, "Commits once, so your first diff is your first game change.", io);
}

/**
 * Defaulted to no, and the hint says why rather than leaving it as an
 * arbitrary-looking choice: `release.yml` needs an upload keystore and a Play
 * service account, so a project that takes the workflows before it has either
 * gets a red `main` from its first push.
 */
export function askForWorkflows(io: Io = {}): Promise<boolean | null> {
  return ask("Add the GitHub Actions workflows?", false, "Release needs a signing keystore and a Play service account, so this fails until you have both. `add workflows` writes them later.", io);
}

/**
 * The package manager, asked only when nothing else could say.
 *
 * `npm create` and `pnpm create` both set `npm_config_user_agent`, so this is
 * reached by the paths that do not: a global install, or running the binary
 * directly. Rare, but it decides what every generated script says, and the old
 * silent fallback to pnpm was a guess printed into a project's package.json.
 */
export async function askForPackageManager(io: Io = {}): Promise<PackageManager | null> {
  const answer = await select({
    message: "Which package manager should the generated scripts use?",
    options: [
      { value: "pnpm", label: "pnpm" },
      { value: "npm", label: "npm" },
    ],
    input: io.input ?? process.stdin,
    output: io.output ?? process.stdout,
  });
  return isCancel(answer) ? null : (answer as PackageManager);
}
