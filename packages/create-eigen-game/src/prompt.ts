/**
 * The organization prompt, which is the one question this CLI asks and the one
 * answer that is expensive to get wrong.
 *
 * Its own module because it drops to `@clack/core` rather than using
 * `@clack/prompts`' `text`. The reason is the suffix: `flutter create --org X
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
import { confirm, isCancel, S_BAR, S_BAR_END, symbol } from "@clack/prompts";
import color from "picocolors";

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
export async function askForOrg(game: string, registering: boolean, io: { input?: Readable; output?: Writable } = {}): Promise<string | undefined | null> {
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
