---
sidebar_position: 1
title: Prerequisites
description: The system-level tools an Eigen game needs — Node, a package manager, Flutter, the Android and web toolchains, and the Cloudflare and Firebase accounts — with one command block that verifies the lot.
---

# Prerequisites

You build an Eigen game in your own repository, and the engine ships as ordinary
packages. **You never clone the Eigen repositories**, and there is nothing to
install globally from Eigen itself — `create-eigen-game` runs through
`npm create`, and `wrangler` arrives as a project dependency.

What you do need is the toolchain underneath both halves: a JavaScript runtime
for the Worker, Flutter for the app, and accounts at the two services the engine
is built on.

Skip ahead to [check everything at once](#check-everything-at-once) if you
already have a Flutter setup that builds Android apps — that is most of this
page.

## To write and test game rules

This much is enough to scaffold a project, write rules in both languages, and
run every test. No account, no device, no Android SDK.

| Tool | Version | Why |
| --- | --- | --- |
| [Node.js](https://nodejs.org/en/download) | 22 or newer | Runs the scaffolder, `wrangler`, and the Worker's tests |
| [pnpm](https://pnpm.io/installation) *or* npm | any current release | pnpm is the default the scaffolder assumes; npm works identically |
| [Flutter](https://docs.flutter.dev/get-started/install) | 3.44 or newer, bringing Dart 3.12 or newer | The app half, the Dart rules twin, and the payload generator |
| [Git](https://git-scm.com/downloads) | any | Flutter uses it internally, and it is your project's history |

Dart is not a separate install — it ships inside Flutter, and
`flutter --version` prints both.

:::info[Scaffolding needs network access]
`create-eigen-game` installs both halves as it goes — npm for the Worker,
pub.dev for the app — so it needs the network throughout, not just at the start.
An interrupted run leaves a partly installed project on disk; delete the
directory and start again.

It does not negotiate versions while it runs. The engine and `eigen_flutter`
releases it pairs are fixed in the scaffolder itself, tested together before it
ships, and shown in [Versions and
compatibility](../reference/compatibility.md).
:::

## To run the app

The Worker runs locally with no extra tooling — `wrangler dev` is enough. The
Flutter app needs a platform to run on, and a scaffolded project targets two:

**Web** needs [Chrome](https://www.google.com/chrome/), which `flutter run -d
chrome` drives directly. It is the fastest loop and the one to start with.

**Android** needs the full mobile toolchain:

| Tool | Version | Notes |
| --- | --- | --- |
| [Android Studio](https://developer.android.com/studio) | current | The simplest way to get the SDK, platform tools and an emulator. The command-line tools alone also work |
| Android SDK | API 36 to compile | The app's `minSdk` is 24, so it runs on Android 7.0 and later |
| [JDK](https://adoptium.net/temurin/releases/) | 17 or newer | Gradle compiles against Java 17. Android Studio bundles one |

Do not install these by hand and hope. `flutter doctor` inspects all of it and
tells you exactly what is missing — see below.

:::note[iOS is not part of a scaffolded project]
The scaffolder runs `flutter create --platforms android,web`, so there is no
Xcode requirement and no macOS requirement. Nothing prevents you adding the iOS
platform yourself later; it simply is not set up for you.
:::

## To deploy it

Both are free to start, and neither is needed until you deploy.

**A [Cloudflare account](https://dash.cloudflare.com/sign-up)** for the Worker,
its D1 database and its Durable Objects. You do *not* install `wrangler`
globally — a scaffolded project depends on it directly, and `wrangler login`
authenticates through your browser on first use.

**A [Firebase project](https://console.firebase.google.com/)** for player
identity and push notifications. One project serves both. Configuring it needs
two command-line tools, and this is the one place something is installed
globally:

```bash
npm install -g firebase-tools                    # the `firebase` CLI
dart pub global activate flutterfire_cli         # the `flutterfire` CLI
```

`pnpm firebase:configure` in a scaffolded project drives both. If your shell
cannot find `flutterfire` afterwards, add Dart's global package directory to
your `PATH`:

```bash
export PATH="$PATH":"$HOME/.pub-cache/bin"
```

See [Configure a game](../ship-it/configure.md) for what the configuration step
actually writes, and [Push notifications](../ship-it/push.md) for the messaging
half.

## Check everything at once

Run this from anywhere. Every line should print a version at or above what the
tables list:

```bash
node -v                # v22.x or newer
pnpm -v                # or: npm -v
git --version
flutter --version      # Flutter 3.44+ · Dart 3.12+
```

Then let Flutter audit its own half, which covers the Android SDK, the JDK,
device connections and Chrome in one pass:

```bash
flutter doctor -v
```

Read the output rather than the summary count. A green **Flutter**, **Android
toolchain** and **Chrome** is everything a scaffolded project needs; unrelated
categories — Xcode, Linux desktop, Visual Studio — are expected to be missing
and do not affect you.

If you have already set up Firebase:

```bash
firebase --version
flutterfire --version
```

## Now build something

[Quickstart](./quickstart.md) scaffolds both halves and gets them running
locally. [Your first game](./your-first-game.md) writes Rock–Paper–Scissors end
to end, in both languages.

Adding Eigen to an app you already have, or want to lay the project out
yourself? [Set up without the scaffolder](./manual-setup.md) uses the same
public packages and skips `create-eigen-game` entirely — which also means it
does not need network access at project-creation time.
