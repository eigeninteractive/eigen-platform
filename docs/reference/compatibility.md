---
sidebar_position: 3
title: Versions and compatibility
description: Which engine, client and docs versions pair with each other, what a breaking bump actually means pre-1.0, and how old apps survive a server deploy.
---

# Versions and compatibility

Four artifacts ship from three repositories. This page says which ones pair,
and what a version number is actually promising.

:::info Everything here is pre-1.0
Nothing has been published to npm or pub.dev yet. Every package is at `0.1.0`,
and the API is still moving. Read the [breaking axis](#the-breaking-axis-is-the-minor-for-now)
section before writing a version constraint — it is not where you expect.
:::

## What pairs with what

| Docs | Engine — `@eigeninteractive/*` | Wire client — `eigen_api` | Flutter shell — `eigen_flutter` |
| --- | --- | --- | --- |
| **0.1.x** *(this version)* | `^0.1.0` | `^0.1.0` | `^0.1.0` |

`eigen_api` is not versioned independently. It is generated from the engine's
OpenAPI spec and **stamped with the engine's version** — the same `package.json`
field changesets owns also becomes the spec's `info.version` — so `0.1.4` there
is `0.1.4` here, and they cannot drift. That is the whole point: a constraint of
`eigen_api: ^0.1.0` in your app is a statement about which *wire* it speaks, not
about a Dart library's API surface.

`eigen_flutter` moves on its own clock. Its version describes its Dart API — the
widgets, the providers, the `GameModule` contract — and it records which engines
it works against through its own `eigen_api` constraint. So `eigen_flutter 0.4.0`
depending on `eigen_api: ^0.1.0` means "this shell speaks the engine's 0.1.x
wire". There is no lockstep release, and there deliberately isn't one: the engine
breaks the wire in ways that have no Dart-side consequence at all, and forcing a
shell release for each would make its version number meaningless.

The two happen to sit at the same number today. That is a coincidence of both
being new, not a rule — expect them to diverge.

## The breaking axis is the minor, for now

Semver treats `0.x` specially, and both halves of this project are in `0.x`:

```
^0.1.0   resolves to   >=0.1.0 <0.2.0
^1.0.0   resolves to   >=1.0.0 <2.0.0
```

So while a package is pre-1.0, **breakage is announced in the MINOR position**
and the major position is unused. `0.1.4` → `0.1.5` is additive; `0.1.4` →
`0.2.0` is the break. Once a package reaches `1.0.0` this shifts to the usual
major/minor split.

This is worth stating plainly because tooling does not translate it for you.
`pnpm changeset` will happily apply a `major` bump to a `0.1.0` package and ship
`1.0.0` — declaring a stability guarantee by accident. Pre-1.0, pick `minor` for
breaking and `patch` for everything else. `cider` on the Dart side has a
dedicated `cider bump breaking` that does the right thing at either stage.

## Three different version numbers

The word "version" means three unrelated things in this system. Keeping them
apart is most of what compatibility reasoning is:

| | What it versions | Who moves it |
| --- | --- | --- |
| **Package semver** | the developer-facing API of one package | changesets (npm), cider (pub) |
| **The engine's breaking axis** | the HTTP + socket wire contract | the engine; `eigen_api` mirrors it |
| **Game `schemaVersion`** | one game's own state/action payloads | the game author |

The third is the one people expect to find here and won't. A game's
`schemaVersion` is internal to that game: the engine resolves each request
against the version the game was created at, and old games keep running under
old rules forever. It is not tied to the engine's version, and bumping one never
implies bumping the other. See [Versions](../build-a-game/versions.md).

**The docs are versioned on the engine's breaking axis**, because that is what
decides whether a page is still true. A page describes a task end to end — the
TypeScript rules and the Dart client together — and what invalidates it is the
contract underneath changing.

## What a breaking bump means

For the engine, it means **the wire changed in a way an existing client cannot
absorb**. Two categories are less obvious than they look:

**Widening a response enum is additive.** Every generated Dart enum has an
`unknownDefaultOpenApi` member. When an installed client meets a value introduced
by a newer server, decoding succeeds and the app can show generic or
update-required UI rather than losing the whole response.

That sentinel is deliberately **read-side only**. Serialising it produces
`unknown_default_open_api`, which no route accepts. Adding a value that clients
may optionally send is additive; changing a request so an old client must send
the new value is breaking. Removing or renaming an enum member is also breaking.

**Adding a field is not breaking.** The generated models are built with
`disallowUnrecognizedKeys: false`, so an older client silently ignores keys it
does not know. Removing a field, renaming one, or changing its type is breaking.

## Why this matters more here than in a normal library

A library consumer upgrades when they choose to. **An installed app does not.**
Once a release is in the stores, those binaries keep talking to your server for
as long as people leave them installed — so an old client meeting a new server
is the normal case, not the edge case, and it is a case you cannot fix by
shipping a patch.

That asymmetry is why the generated client tolerates both kinds of response
widening: unknown fields are ignored, and unknown enum values become
`unknownDefaultOpenApi`. The server can add either without making a current app
fail response decoding.

The sentinel adds a member to every generated enum, so exhaustive switches must
handle it. It was enabled before the first release, while there were no
published packages or installed apps, so there was no version bump or migration
window. Future enum additions reuse the same member and do not change the Dart
surface.

Anything genuinely breaking needs a deprecation window: ship the additive half
first, let installs turn over, and only then remove the old half.

`eigen_flutter` checks for updates at cold start and on resume. Routine Android
checks use Play's native update flow without interrupting an active game. When
an unknown value makes one surface unsafe, that surface instead shows an
explicit update action: Play in-app update on Android, or a reload of the
current application in a browser. No store or download URL is configured by
the client framework.

For a new value that old clients cannot safely present, release in client-first
order:

1. Publish the compatible Android build and deploy the compatible web client
   while the server still emits the old vocabulary.
2. Wait until the Play build is available to the full intended audience.
3. Only then enable the server behavior that emits the new value.

Do not enable that behavior globally during a staged Play rollout unless the
rollout already covers everyone who may receive it. The sentinel prevents a
decode crash; it cannot make an unpublished or ineligible update available.

## Reading the docs at the right version

The version selector in the navbar names the engine line these pages describe.
Only `0.1.x` exists today, and it is served at the root — so every `/docs/*` URL
is a 0.1.x URL. When the next breaking line arrives, `0.1.x` freezes at
`/docs/0.1.x/*` and those links keep working.
