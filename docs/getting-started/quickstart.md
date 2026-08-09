---
sidebar_position: 2
title: Quickstart
description: Scaffold a turn-based multiplayer game, run both halves locally (the Cloudflare Worker and the Flutter app), and make your first rules change.
---

# Quickstart

One command scaffolds both halves of a game into your own repository: the
Cloudflare Worker that owns the rules, and the Flutter app that draws them.

## Before you start

Node.js 22 or newer, npm or pnpm, and Flutter 3.44 or newer, which brings the
Dart 3.12 the client needs. Scaffolding installs both halves as it goes, so it
needs network access.

A Firebase project (free) is needed for authentication and push notification
setup. It can be skipped while scaffolding, but we recommend installing the
firebase and flutter_fire cli as detailed in
[Prerequisites](./prerequisites.md). A Cloudflare Account (free) is only
required to deploy your game.

<details>
<summary>The two Firebase CLIs, and the sign-in</summary>

Neither ships with Flutter or Node, and this is the one place the setup installs
something globally:

```bash
curl -sL https://firebase.tools | bash       # the `firebase` CLI
dart pub global activate flutterfire_cli     # the `flutterfire` CLI
export PATH="$PATH":"$HOME/.pub-cache/bin"   # add `flutterfire` to PATH
firebase login                               # both CLIs share these credentials
```

The first line is Google's own installer, and it picks a standalone binary or
npm to suit the machine;
[the Firebase CLI reference](https://firebase.google.com/docs/cli) has the other
ways, including Windows.

`dart pub global activate` puts `flutterfire` somewhere that is not on `PATH` by
default, which is why the third line is there. Add it to your shell profile
rather than typing it once.

```bash
export PATH="$PATH":"$HOME/.pub-cache/bin"   # add `flutterfire` to PATH
```

Check all three with:

```bash
firebase --version
flutterfire --version
firebase login:list
```

You do not need a Firebase _project_ yet. The scaffolder's first run offers to
create one.

Skipping this section is fine, but the scaffolder will notice and ask. Its
default is to stop, because everything on this page except launching the app
works without Firebase and launching the app does not as it requires a user
authentication method. [Configure a game](../ship-it/configure.md) picks the
step up.

</details>

## Scaffold

```bash
pnpm create eigen-game my-game
# or: npm create eigen-game@latest my-game
```

`my-game` is the only naming argument: a lowercase kebab-case slug, from which
the scaffolder derives `My Game`, `my_game` and the `MyGame` type prefix.

Everything else it asks. **Each question has exactly one flag that answers it**,
so passing the flag skips the question, which is why the list below is both the
questions and the options:

| Question                                                                    | Flag                            | Default                  |
| --------------------------------------------------------------------------- | ------------------------------- | ------------------------ |
| The organization, which prefixes the permanent `applicationId`              | `--org <reverse-domain>`        | `com.example`            |
| Whether to scaffold without Firebase (asked only when the CLIs are missing) | `--no-firebase`                 | no, stop and set them up |
| Which Firebase project to configure against                                 | `--firebase-project <id>`       | FlutterFire asks         |
| Initialise a repository and commit the scaffold                             | `--git`, `--no-git`             | yes                      |
| Emit the GitHub Actions workflows                                           | `--workflows`, `--no-workflows` | no                       |
| Which package manager the generated scripts use                             | `--package-manager npm\|pnpm`   | whichever invoked it     |

The organization is the one worth reading twice:

```text
│  Prefixes the Android applicationId, which Google Play makes permanent at first upload.
│  Also the Android app registered in the Firebase project you pick next.
│
◆  Organization in reverse domain notation
│  dev.yourname.games.my_game
└
```

The `.my_game` is dimmed, and grows as you type: the organization is the
**prefix**, and the game name is appended to it, exactly as
`flutter create
--org` does. So answering `dev.yourname.games.my_game`, which
reads like the whole identifier, produces `dev.yourname.games.my_game.my_game`,
and the CLI offers to shorten it if you do. Worth getting right at scaffold
time, because Google Play treats the result as the app's permanent identity and
it cannot be changed after the first upload.

Then FlutterFire asks which Firebase project to use, and offers to create one.
That is the second half of the same decision: the `applicationId` above is what
gets registered there.

You get one repository holding both halves:

```text
my-game/
├── server/   # Cloudflare Worker: the authoritative rules
└── app/      # Flutter app: the screens
```

The scaffold commits itself when it finishes, so your first `git diff` is your
first game change rather than the ninety generated files underneath it. That is
the git question, defaulted to yes, and not asked at all when you are already
inside a repository, since it declines to nest one there anyway. Firebase is
configured before that commit, which is why it happens here rather than as your
first diff: six files, four of them edits to files the scaffold had just
written.

:::warning[With no terminal, an unanswered question is an error] CI, a pipe, an
agent session: there is nowhere to ask, so every answer has to arrive as a flag,
and a missing one stops the run rather than being chosen for you. `--org` is
why. A non-interactive run that quietly defaulted it would ship
`com.example.my_game`, and Google Play makes that permanent at the first upload.

The error prints the whole command to re-run, with each default already filled
in, so the fix is one paste, and the value worth changing is visible in it:

```bash
npx create-eigen-game my-game --no-firebase --org com.example --git --no-workflows
```

:::

The engine and `eigen_flutter` versions are pinned inside the scaffolder and
released as a tested pair, so the `create-eigen-game` you run decides both. Use
`@latest` rather than a cached older copy. See
[Versions and compatibility](../reference/compatibility.md).

## Run it

```bash
cd server
pnpm dev                              # applies the D1 migrations, then wrangler dev
curl http://localhost:8787/health
```

`wrangler dev` simulates D1, the Durable Objects and the cron trigger locally.
`/health` answering `{"status":"ok"}` means the whole Worker stack is up, and
rules and fixture tests need nothing more than this.

The Flutter app needs Firebase, which the scaffolder has already done unless it
told you otherwise. If it was skipped, because you answered yes to scaffolding
without it or passed `--no-firebase`, do it now, from the repository root:

```bash
pnpm firebase:configure
```

That configures Android and web with FlutterFire and writes the service worker's
Firebase configuration. It asks which Firebase project to use, and can create
one; pass `-- --project my-project-id` to answer that up front. Each run ends by
naming the project and the two app IDs it configured against.

Commit everything it writes: `app/firebase.json`,
`app/android/app/google-services.json`, `app/lib/firebase_options.dart`,
`app/web/firebase-config.js` and FlutterFire's two Android Gradle edits. They
are public app identifiers, not credentials, and Android and web builds fail
without them.

Then fill in the public values and VAPID key in `app/app-config.json` (see
[Deploy the web app](../ship-it/deploy-the-web-app.md)), and copy
`server/.dev.vars.example` to `server/.dev.vars` with the Firebase Admin
credentials, which the Worker needs to verify player tokens.

```bash
cd app
flutter run -d chrome --web-hostname localhost --web-port 7357 \
  --dart-define-from-file=app-config.json
```

Port 7357 is the origin the Worker scaffold already trusts, so leave it as it
is.

## The development loop

`wrangler dev` reloads Worker source on save, which covers most rules work. What
it does not do is regenerate anything: `game-contract.json` and the Dart it
produces are build outputs, not watched files.

Keep the fixture runner going while you edit rules:

```bash
cd server
pnpm run test:watch
```

Then run `pnpm run contract` from the repository root whenever a schema or a
fixture changes, and `flutter test` in `app/` to check the Dart side agrees.

## What a game is

A game is four Zod schemas and a handful of pure hooks, in one
[`GameRules`](../build-a-game/the-contract.md) unit:

- **`state`** is the authoritative truth, held by the Worker and never sent to a
  player.
- **`observation`** is the slice one seat is allowed to see, computed from
  `state`. It is what the app draws, and it is where
  [hidden information](../build-a-game/hidden-information.md) is enforced.
- **`action`** is what a player submits; `config` is what the creator chose
  before the game started.

Each unit is registered under a **schema version**, and shipped versions are
immutable: an incompatible change becomes a new `v2` unit beside `v1`, so games
already in progress keep the rules they started under. See
[Payload types](../build-a-game/schemas.md),
[The hooks](../build-a-game/hooks.md) and
[Versions](../build-a-game/versions.md).

## Change the rules

The seeded game is a race to a target count. Open `server/src/module/v1.ts` and
bound what a player may add per turn:

```ts
const actionSchema = z.object({ amount: z.int().min(1).max(3) }).meta({
  id: "ExampleGameV1Action",
});
```

That is a schema change, so regenerate the contract from the repository root:

```bash
pnpm run contract
```

It rewrites `server/game-contract.json` (every schema version plus the shared
fixtures), and from it the Dart payload types and fixture copies in `app/`.
Commit both: they are the boundary between the two halves, and the app now
rejects `amount: 4` before it ever reaches the Worker.

Changing hook _behaviour_ rather than a schema works the same way, except that
you update the fixture in `server/src/module/fixtures/v1/` alongside it. The
fixtures are part of the contract, and both languages run them. That is what
keeps the app's prediction and the Worker's ruling from drifting apart.

Before anything has shipped, edit the seeded v1 unit freely.

---

Next: [Your first game](./your-first-game.md) walks through Rock–Paper–Scissors
in both languages. Prefer to wire the two halves up yourself, or add
EigenInteractive to an app you already have? See
[Set up without the scaffolder](./manual-setup.md).
