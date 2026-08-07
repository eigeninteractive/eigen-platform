import { PassThrough, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { askForOrg, DEFAULT_ORG, ORG, repeatsGameName, withoutGameName } from "../src/prompt.js";

/** Drives the prompt with `keystrokes`, and returns its answer and everything it drew. */
async function ask(game: string, keystrokes: string[], registering = false) {
  const input = new PassThrough();
  let drawn = "";
  const output = new Writable({
    write(chunk, _encoding, done) {
      drawn += String(chunk);
      done();
    },
  });

  const answered = askForOrg(game, registering, { input, output });
  // After the prompt is listening, and one at a time so each is a keypress
  // rather than a paste.
  for (const key of keystrokes) {
    await new Promise((resolve) => setImmediate(resolve));
    input.write(key);
  }

  return { answer: await answered, drawn };
}

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
