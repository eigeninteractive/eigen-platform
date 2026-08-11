---
sidebar_position: 2
title: Quickstart
description: Scaffold a turn-based multiplayer game, run both halves locally (the Cloudflare Worker and the Flutter app), and make your first rules change.
---

# Quickstart

One command scaffolds both halves of a game into your own repository: the
Cloudflare Worker that owns the rules, and the Flutter app that draws them.

## Before you start

- **Node.js 22 or newer**, with npm or pnpm.
- **Flutter 3.44 or newer**, which brings the Dart 3.12 the client needs.
- **Network access throughout**, since scaffolding installs both halves as it
  goes.
- **A Firebase project** (free) for sign-in and push. Optional while
  scaffolding, but the app throws `Firebase is not configured` at launch until
  one is connected.
- **A Cloudflare account** (free) only when you deploy.

Firebase needs two CLIs, and they are the only global installs:

```bash
curl -sL https://firebase.tools | bash       # the `firebase` CLI
dart pub global activate flutterfire_cli     # the `flutterfire` CLI
export PATH="$PATH":"$HOME/.pub-cache/bin"   # add `flutterfire` to PATH
firebase login                               # both CLIs share these credentials
```

You do not need a Firebase _project_ yet; the scaffolder offers to create one.
[Prerequisites](./prerequisites.md) has the full toolchain, including Android.

## Scaffold

```bash
pnpm create eigen-game my-game
# or: npm create eigen-game@latest my-game
```

- `my-game` is the only argument, a lowercase kebab-case slug. Everything else
  is asked.
- The **organization** is the answer worth reading twice. It prefixes the
  Android `applicationId`, which Google Play makes permanent at first upload.
- The scaffolder connects Firebase, then commits, so your first `git diff` is
  your first game change.
- Use `@latest` rather than a cached copy. The scaffolder pins the engine and
  `eigen_flutter` as a tested pair.

You get one repository holding both halves:

```text
my-game/
├── server/   # Cloudflare Worker: the authoritative rules
└── app/      # Flutter app: the screens
```

The details to use the scaffolder in non-interactive mode are present
[here](../how-it-works/the-scaffolder.md).

## Run the Worker

```bash
cd server
pnpm dev                              # applies the D1 migrations, then wrangler dev
curl http://localhost:8787/health
```

`wrangler dev` simulates D1, the Durable Objects and the cron trigger locally.
`/health` answering `{"status":"ok"}` means the whole Worker stack is up, and
rules and fixture tests need nothing more than this.

## Setup the Firebase Project

**1. Turn on Google sign-in.** Firebase Console → Security → Authentication →
Sign-in method → Get Started → Google → Enable.

**2. Populate `GOOGLE_WEB_CLIENT_ID`** If `GOOGLE_WEB_CLIENT_ID` in
`app/app-config.json` is empty, the provider was off when you scaffolded, so
there was no OAuth client to copy. Enabling it creates one; take the value from
**Web SDK configuration** under Firebase Console → Authentication → Sign-in
method → Google

**3. Get the Web Push key.** Firebase Console → Settings → General → **Cloud
Messaging** → Web configuration, **Generate key pair** if the list is empty.
Paste it into `FIREBASE_VAPID_KEY` in `app/app-config.json`. The web app will
not start without it.

Both are public values compiled into the app, not secrets.
[Configuration](../ship-it/configure.md) is the full reference for every value
on both sides, and what changes when they stop pointing at localhost.

<details>
<summary>If you scaffolded without Firebase</summary>

You answered yes to scaffolding without it, or passed `--no-firebase`, so
`app/lib/firebase_options.dart` is still the throwing seam, the app will not
launch, and nothing above was filled in. Run this once from the repository root:

```bash
pnpm firebase:configure
# add `-- --project my-project-id` to skip the project picker
```

It configures Android and web with FlutterFire, writes the service worker's
Firebase configuration, and fills in `FIREBASE_PROJECT_ID` and
`GOOGLE_WEB_CLIENT_ID` exactly as scaffolding would have. It ends by naming the
project, both app IDs, and each value it set, so you can see which of the two
steps above are still owed.

**Commit everything it writes**: `app/firebase.json`,
`app/android/app/google-services.json`, `app/lib/firebase_options.dart`,
`app/web/firebase-config.js` and FlutterFire's two Android Gradle edits. They
are public app identifiers rather than credentials, they are not git-ignored,
and Android and web builds fail without them.

</details>

<details>
<summary>Optional: push and account deletion locally</summary>

Copy `server/.dev.vars.example` to `server/.dev.vars` and fill it from Firebase
Console → Settings → Service accounts → **Generate new private key**.

The downloaded JSON file contains the client email and the private key. Paste
the entire private key string with the quotes as the `FIREBASE_PRIVATE_KEY`
variable.

Those two features are all it powers. Token verification uses
`FIREBASE_PROJECT_ID` alone, so ordinary local play needs none of this.
`.dev.vars` is git-ignored and must stay that way: unlike everything else on
this page, it is a real credential.

</details>

## Run the app

```bash
cd app
flutter run -d chrome --web-hostname localhost --web-port 7357 \
  --dart-define-from-file=app-config.json
```

Port 7357 is the `WEB_APP_ORIGIN` the Worker scaffold already trusts, so leave
it as it is. Pass `--dart-define-from-file=app-config.json` to every
`flutter
run` and `flutter build`; there is no generated config class.

## The development loop

`wrangler dev` reloads Worker source on save, which covers most rules work. What
it does not do is regenerate anything: `game-contract.json` and the Dart it
produces are build outputs, not watched files.

```bash
cd server && pnpm run test:watch   # keep the fixture runner going while you edit
pnpm run contract                  # from the root, after a schema or fixture change
cd app && flutter test             # check the Dart side agrees
```

## Bring an agent

A game is six pure functions and a widget against a sharply-specified contract,
which is work a coding agent does well once it knows the contract. Install the
skill that states it:

```text
/plugin marketplace add eigeninteractive/eigen-server
/plugin install eigen@eigeninteractive
```

That adds `building-a-game`, which loads when the work is writing or reviewing
an EigenInteractive game and carries the four invariants, what the engine has
already validated before your hook runs, and a review checklist. It ships from
the engine repository, so it moves with the engine.

[Working with an agent](../build-a-game/with-an-agent.md) adds the Cloudflare
and Flutter skills for the other 90% of the repository, the retrieval surface
that keeps an agent reading current documentation, and the mistakes worth
reviewing for on this contract.

## What a game is

Four Zod schemas and a handful of pure hooks, in one
[`GameRules`](../build-a-game/the-contract.md) unit:

- **`state`** is the authoritative truth, held by the Worker and never sent to a
  player.
- **`observation`** is the slice one seat is allowed to see, computed from
  `state`. It is what the app draws, and where
  [hidden information](../build-a-game/hidden-information.md) is enforced.
- **`action`** is what a player submits; **`config`** is what the creator chose
  before the game started.
- Each unit is registered under a **schema version**, and shipped versions are
  immutable: an incompatible change becomes a new `v2` unit beside `v1`.

See [Payload types](../build-a-game/schemas.md),
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
