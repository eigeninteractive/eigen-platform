---
sidebar_position: 15
title: The scaffolder
description: What create-eigen-game asks, why each question exists, what it writes, and why an unanswered question in a non-interactive run is an error rather than a default.
---

# The scaffolder

`create-eigen-game` writes one repository holding both halves of a game, wires
them together, connects Firebase, and commits the result. It is a convenience
rather than part of the engine: nothing it produces is private, and
[Set up without the scaffolder](../getting-started/manual-setup.md) reaches the
same place by hand.

[Quickstart](../getting-started/quickstart.md) is the short version. This page
is the whole of the command, and the reasoning behind the parts of it that look
strict.

## One argument, and everything derived from it

```bash
pnpm create eigen-game my-game
# or: npm create eigen-game@latest my-game
```

`my-game` is the only naming argument, a lowercase kebab-case slug. From it the
scaffolder derives:

| Derived | Example | Used as |
| --- | --- | --- |
| Display name | `My Game` | The app title and the commit message |
| Dart package | `my_game` | The Flutter package, and the suffix of the `applicationId` |
| Type prefix | `MyGame` | The generated payload types in both languages |

Everything else is a question.

## Every question has exactly one flag

Pass the flag and the question is skipped. Leave it out and you are asked. That
one-to-one mapping is deliberate: the flag list and the question list are the
same list, so there is nothing a prompt can set that a script cannot.

| Question | Flag | Default |
| --- | --- | --- |
| The organization, which prefixes the permanent `applicationId` | `--org <reverse-domain>` | `com.example` |
| Whether to scaffold without Firebase (asked only when the CLIs are missing) | `--no-firebase` | no, stop and set them up |
| Which Firebase project to configure against | `--firebase-project <id>` | FlutterFire asks |
| Initialise a repository and commit the scaffold | `--git`, `--no-git` | yes |
| Emit the GitHub Actions workflows | `--workflows`, `--no-workflows` | no |
| Which package manager the generated scripts use | `--package-manager npm\|pnpm` | whichever invoked it |

`--help` prints the same list, and `-v` prints the version, which is also the
version pairing (see [below](#versions-are-pinned-as-a-tested-pair)).

## The organization is the one permanent answer

The Android `applicationId` is the organization plus the game name, and Google
Play makes it permanent at the first upload. The prompt shows that:

```text
│  Prefixes the Android applicationId, which Google Play makes permanent at first upload.
│  Also the Android app registered in the Firebase project you pick next.
│
◆  Organization in reverse domain notation
│  dev.yourname.games.my_game
└
```

The `.my_game` is dimmed and grows as you type, because the organization is the
**prefix** and the game name is appended to it, exactly as `flutter create --org`
does. Answering `dev.yourname.games.my_game`, which reads like the whole
identifier, would produce `dev.yourname.games.my_game.my_game`, so the CLI spots
the doubled suffix and offers to shorten it.

The Firebase question that follows is the second half of the same decision: the
`applicationId` above is what gets registered in the project you pick.

## Firebase is asked first, and can end the run

Before anything is written, the scaffolder checks three things: the `firebase`
CLI, the `flutterfire` CLI, and whether you are signed in. When any is missing
it lists all of them at once, with the command that fixes each, and asks whether
to scaffold anyway.

**The default is no.** Almost everything in a scaffolded project runs without
Firebase (the rules, the fixtures, the Worker, its tests), but the app throws
`Firebase is not configured` the moment it launches, because identity is how a
player gets a seat at all. Stopping costs two commands; carrying on costs a
project that cannot be run.

Nothing is written when it stops, and the exit code is non-zero only so a script
that wrapped the command can tell there is no project.

This question is asked before the organization for the same reason: it is the
only answer that can end the run, and ending it afterwards would mean having
asked for a permanent decision about a project that never gets created.

Answer yes, or pass `--no-firebase`, and
[`firebase:configure`](../ship-it/configure.md) picks the step up later.

## What it writes

```text
my-game/
├── package.json       # one contract / contract:check command
├── server/            # Cloudflare Worker: the authoritative rules
└── app/               # Flutter app: the screens
```

Both halves are installed as it goes, npm for the Worker and pub.dev for the
app, so the run needs network access throughout rather than only at the start.
An interrupted run leaves a partly installed project on disk; delete the
directory and start again.

Then it commits, so your first `git diff` is your first game change rather than
the ninety generated files underneath it. Firebase is configured **before** that
commit, which is why it happens during the scaffold rather than as your first
diff: six files, four of them edits to files the scaffold had just written.

The git question is not asked at all when the destination is already inside a
repository, since the scaffolder declines to nest one there whatever it is told.
It says so in the closing summary.

See [Project layout](../reference/repository-model.md) for what each directory
owns and which generated files cross between them.

## What it fills in, and what it cannot

A deployment has values that no template can contain, because they do not exist
until a Firebase project does. The scaffolder copies the ones it can, from what
FlutterFire wrote moments earlier:

| Value | Where it lands | Read from |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | `server/wrangler.jsonc` | The project FlutterFire recorded in `app/firebase.json` |
| `GOOGLE_WEB_CLIENT_ID` | `app/app-config.json` | The `"client_type": 3` entry of the `google-services.json` it downloaded |
| `API_BASE_URL` | `app/app-config.json` | Nothing. It is `http://localhost:8787`, which is where `pnpm dev` puts the Worker |

The `wrangler.jsonc` edit rewrites that one assignment in place rather than
decoding and re-encoding the file, which would delete every comment in it.
Cloudflare recommends JSONC for new projects, and it is a file its owner edits,
so the comments are worth keeping. It insists the key appear exactly once and
writes nothing otherwise, which is what makes rewriting in place safe.

Two values are left, and the closing summary names exactly the ones that apply:

- **`FIREBASE_VAPID_KEY`**, always. A Web Push certificate is not something the
  Firebase CLI serves, and the web target refuses to start without one.
- **`GOOGLE_WEB_CLIENT_ID`**, when Firebase had not created that OAuth client
  yet. It appears when the Google sign-in provider is enabled, which is a
  console action no CLI performs, so a project that never had it enabled has an
  empty `oauth_client` array and there is nothing to copy.

None of this is the scaffolder's own code. `configure_firebase` does the
writing, and the scaffolder invokes it as `--worker ../server`, which is the
flag that widens it from the app to the Worker beside it. The generated
`firebase:configure` script passes the same flag, so **running that command
later lands in exactly the same place a scaffold does**. An app-only repository
omits the flag and gets the app half.

It happens between the Firebase step and the commit, so the filled-in values
are part of the scaffold commit rather than the project's first diff.

[Where each value comes from](../ship-it/configure.md#where-each-value-comes-from)
is the full list, including what to change at deploy.

## Workflows are opt out, and can be added later

`release.yml` needs an upload keystore and a Play service account, and fails on
every push until both exist. That is noise for a project on its first day, so
the workflows default to off:

```bash
npx create-eigen-game add workflows
```

Run it in an existing project when shipping is the next step. See
[Release to the Play Store](../ship-it/store-release.md).

## With no terminal, an unanswered question is an error

CI, a pipe, an agent session: there is nowhere to ask, so every answer has to
arrive as a flag, and a missing one stops the run rather than being chosen for
you.

`--org` is why. A non-interactive run that quietly defaulted it would ship
`com.example.my_game`, and Google Play makes that permanent at the first upload.
A default applied where nobody can see it is exactly how that happens.

Every unanswered question is collected and reported together, and the message
prints the whole command to re-run with each default already filled in, so the
fix is one paste and the value worth changing is visible in it:

```bash
npx create-eigen-game my-game --no-firebase --org com.example --git --no-workflows
```

## Versions are pinned as a tested pair

The engine and `eigen_flutter` versions live inside the scaffolder and are
released together, so **the `create-eigen-game` you run decides both**. A new
project starts on a pairing already known to work rather than on whatever was
newest that morning, which is why `@latest` matters more than it usually does:
a cached older copy pins an older pair.

See [Versions and compatibility](../reference/compatibility.md) for the table,
and for what to do when you want a combination the current scaffolder does not
emit.

## What it deliberately is not

There is no server-only or app-only mode, and no private runtime contract that
only a scaffolded project satisfies. A game is valid when its Worker and app
satisfy the two public package contracts and share one generated
`game-contract.json`. That is the whole requirement, and
[Set up without the scaffolder](../getting-started/manual-setup.md) is the same
result assembled by hand, with the added property of needing no network access
at project-creation time.
