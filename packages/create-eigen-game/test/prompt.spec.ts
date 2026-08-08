import { PassThrough, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { askForGit, askForOrg, askForPackageManager, askForWorkflows, askToScaffoldWithoutFirebase, DEFAULT_ORG, type Io, ORG, repeatsGameName, withoutGameName } from "../src/prompt.js";

/** Drives a prompt with `keystrokes`, and returns its answer and everything it drew. */
async function drive<T>(question: (io: Io) => Promise<T>, keystrokes: string[]) {
  const input = new PassThrough();
  let drawn = "";
  const output = new Writable({
    write(chunk, _encoding, done) {
      drawn += String(chunk);
      done();
    },
  });

  const answered = question({ input, output });
  // After the prompt is listening, and one at a time so each is a keypress
  // rather than a paste.
  for (const key of keystrokes) {
    await new Promise((resolve) => setImmediate(resolve));
    input.write(key);
  }

  return { answer: await answered, drawn };
}

const ask = (game: string, keystrokes: string[], registering = false) => drive((io) => askForOrg(game, registering, io), keystrokes);

describe("the organization answer", () => {
  it("accepts reverse domain notation and nothing else", () => {
    for (const value of [DEFAULT_ORG, "dev.yourname.games", "com.acme", "a.b.c.d"]) {
      expect(ORG.test(value)).toBe(true);
    }
    // A hyphen is not legal in a Java package segment, and `flutter create`
    // accepts it anyway — the complaint arrives from Gradle, in a generated
    // manifest, after a full scaffold and a first build.
    for (const value of ["com.example-games", "com", "1com.example", "com..example", ""]) {
      expect(ORG.test(value)).toBe(false);
    }
  });

  it("recognises an answer that already ends in the game name", () => {
    // The mistake: `com.acme.chess` reads like the whole applicationId, and
    // becomes `com.acme.chess.chess`.
    expect(repeatsGameName("com.acme.chess", "chess")).toBe(true);
    expect(withoutGameName("com.acme.chess")).toBe("com.acme");

    expect(repeatsGameName("com.acme", "chess")).toBe(false);
    expect(repeatsGameName("com.chess.acme", "chess")).toBe(false);
  });

  it("draws the game name after whatever is typed", async () => {
    const { answer, drawn } = await ask("chess", ["com.acme", "\r"]);

    expect(answer).toBe("com.acme");
    // The whole point of the custom prompt: the organization is a prefix, and
    // the identifier it produces is visible while it is being given.
    expect(drawn).toContain("com.acme");
    expect(drawn).toContain(".chess");
    expect(drawn).toContain("Google Play makes permanent");
    // Only said when it is true — this run is not configuring Firebase.
    expect(drawn).not.toContain("Firebase project you pick next");
  });

  it("shows the default, and returns nothing for an empty answer", async () => {
    const { answer, drawn } = await ask("chess", ["\r"], true);

    expect(answer).toBeUndefined();
    expect(drawn).toContain(DEFAULT_ORG);
    expect(drawn).toContain("Firebase project you pick next");
  });

  it("refuses an answer Gradle would reject, and says what it wants", async () => {
    const { answer, drawn } = await ask("chess", ["com.example-games", "\r", ""]);

    // A hyphen is not legal in a package segment, and the complaint would
    // otherwise arrive from Gradle, in a generated manifest, after a build.
    expect(drawn).toContain("Two or more dot-separated segments");
    expect(answer).toBeNull();
  });

  it("returns nothing at all when cancelled", async () => {
    const { answer } = await ask("chess", ["com.acme", ""]);

    expect(answer).toBeNull();
  });

  it("declines to shorten an answer into something that is not an organization", () => {
    // `com.chess` would leave a single segment, which is not a package name —
    // so there is nothing to offer, and the answer stands as given.
    expect(repeatsGameName("com.chess", "chess")).toBe(true);
    expect(withoutGameName("com.chess")).toBeUndefined();
  });
});

describe("the yes/no questions", () => {
  // Enter takes whatever is pre-selected, which is how each default is
  // asserted: nothing here types a "y" or an "n".
  const accept = ["\r"];

  it("defaults to not scaffolding without Firebase", async () => {
    const { answer, drawn } = await drive(askToScaffoldWithoutFirebase, accept);

    // The tools are two commands away, and the alternative is an app that
    // throws at launch — so the default is to stop, and the reason is on
    // screen next to it rather than in the message that follows.
    expect(answer).toBe(false);
    expect(drawn).toContain("firebase:configure");
  });

  it("defaults to committing the scaffold", async () => {
    const { answer, drawn } = await drive(askForGit, accept);

    expect(answer).toBe(true);
    expect(drawn).toContain("first game change");
  });

  it("defaults to no workflows, and says why", async () => {
    const { answer, drawn } = await drive(askForWorkflows, accept);

    // Not an arbitrary default: `release.yml` needs an upload keystore and a
    // Play service account, so taking it early means a red `main` from the
    // first push.
    expect(answer).toBe(false);
    expect(drawn).toContain("keystore");
    expect(drawn).toContain("add workflows");
  });

  it("returns nothing at all when cancelled", async () => {
    // ^C during any question has to mean the run stops having written
    // nothing, which is only true if every one of them reports it.
    const questions: ((io: Io) => Promise<unknown>)[] = [askToScaffoldWithoutFirebase, askForGit, askForWorkflows, askForPackageManager];
    for (const question of questions) {
      expect((await drive(question, [""])).answer).toBeNull();
    }
  });

  it("offers pnpm first, since that is what the generated scripts assume", async () => {
    const { answer } = await drive(askForPackageManager, accept);

    expect(answer).toBe("pnpm");
  });
});
