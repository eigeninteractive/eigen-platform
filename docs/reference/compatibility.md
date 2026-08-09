---
sidebar_position: 3
title: Versions and compatibility
description: Which engine, client and docs versions pair with each other, what the scaffolder picks for a new project, what a breaking bump actually means pre-1.0, and how old apps survive a server deploy.
---

# Versions and compatibility

Four artifacts ship from three repositories. This page says which ones pair,
and what a version number is actually promising.

:::info[Everything here is pre-1.0]
Every package is still on the `0.x` line and the API is moving. Read the
[breaking axis](#the-breaking-axis-is-the-minor-for-now) section before writing
a version constraint; it is not where you expect.
:::

## What pairs with what

{/* generated:compatibility-table, rewritten by scripts/sync-compatibility.mjs; do not edit between these markers */}

| Docs | Engine (`@eigeninteractive/*`) | Wire client (`eigen_api`) | Flutter shell (`eigen_flutter`) |
| --- | --- | --- | --- |
| **0.2.x** *(this version)* | `^0.2.0` | `^0.2.0` | `0.3.7`, `0.3.6`, `0.3.5`, `0.3.4`, `0.3.3`, `0.3.2`, `0.3.1`, `0.3.0`, `0.2.0` |
| 0.1.x | `^0.1.0` | `^0.1.0` | `0.1.0` |

{/* /generated:compatibility-table */}

The first three columns are one number. The shell column is not, and is listed
as exact versions rather than a range for that reason: `eigen_flutter` declares
which engine it speaks through its own `eigen_api` constraint, so the releases
pairing with a given line need not be contiguous. Retracted releases are
omitted, since they stay installable for anyone already locked to one, but the
solver will not choose them for a new project.

`eigen_api` is not versioned independently. It is generated from the engine's
OpenAPI spec and **stamped with the engine's release version**, which is what the
spec carries as `info.version`, so `0.2.4` there is `0.2.4` here, and they
cannot drift.

The engine bumps that version for any breaking change it ships, including ones
with no wire consequence: a change to what `@eigeninteractive/rules` exports
moves it just as a changed response body does. So a new `eigen_api` is not by
itself evidence that the wire moved, and upgrading it may cost you nothing.
Constrain on the version anyway: it is the number your package managers can
actually enforce.

`eigen_flutter` moves on its own clock. Its version describes its Dart API (the
widgets, the providers, the `GameModule` contract) and it records which engines
it works against through its own `eigen_api` constraint. So `eigen_flutter 0.4.0`
depending on `eigen_api: ^0.2.0` means "this shell speaks the engine's 0.2.x
wire". There is no lockstep release, and there deliberately isn't one: the engine
breaks in ways that have no Dart-side consequence at all, and forcing a shell
release for each would make its version number meaningless.

## What the scaffolder picks

A new project does not choose from the table above. `create-eigen-game` has
already chosen, and **the version of the scaffolder you run decides both
halves**. It writes one engine range into `server/package.json` and one
`eigen_flutter` range into `app/pubspec.yaml`, and it resolves nothing at run
time. Use `@latest` rather than a cached copy:

```bash
pnpm create eigen-game my-game
npm create eigen-game@latest my-game
```

The two numbers reach it differently, and the difference is the point.

**The engine range is derived, not maintained.** The scaffolder emits a caret on
the `@eigeninteractive/server` version it was built against, the same engine its
CI compiled the Worker template with. Nobody types that number, so the templates
cannot ship paired with an engine no build ever saw.

**The `eigen_flutter` range is a pin, deliberately.** It once resolved "the newest
shell for this engine's wire line" from pub.dev, which was wrong: a shell
declares which *wire* it speaks, and says nothing about whether its *Dart API*
still matches the templates. `eigen_flutter 0.4.0` constraining `eigen_api:
^0.2.0` is a legal match that would emit code against an API that moved. The pin
is raised by hand, and only after CI has scaffolded a project and run
`flutter analyze` against that exact shell.

So a scaffolder release trails an engine release, and that gap is real rather
than an oversight. When the engine crosses a line, no shell can speak it yet:
`eigen_flutter` records compatibility through its own `eigen_api` constraint, and
`eigen_api` for the new line does not exist until the engine's release publishes
it. The scaffolder keeps emitting the previous line, a pairing that works,
until a shell for the new one ships and the pin is raised.

If you need a combination the current scaffolder does not emit, take the manual
path: [Set up without the scaffolder](../getting-started/manual-setup.md) uses
the same public contracts, and the table above is what to write into it.

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

This is worth stating plainly because release tooling generally does not
translate it for you: asking for a "major" bump on a `0.1.0` package ships
`1.0.0` and declares a stability guarantee by accident. While a package you
publish is pre-1.0, choose `minor` for breaking and `patch` for everything else.

## Three different version numbers

The word "version" means three unrelated things in this system. Keeping them
apart is most of what compatibility reasoning is:

| | What it versions | Who moves it |
| --- | --- | --- |
| **Package semver** | the developer-facing API of one package | whoever publishes that package |
| **The engine's breaking axis** | the HTTP + socket wire contract | the engine; `eigen_api` mirrors it |
| **Game `schemaVersion`** | one game's own state/action payloads | the game author |

The third is the one people expect to find here and won't. A game's
`schemaVersion` is internal to that game: the engine resolves each request
against the version the game was created at, and old games keep running under
old rules forever. It is not tied to the engine's version, and bumping one never
implies bumping the other. See [Versions](../build-a-game/versions.md).

**The docs are versioned on the engine's release line**, because that is what
decides whether a page is still true. A page describes a task end to end, the
TypeScript rules and the Dart client together, so either half going breaking
invalidates it, and the engine's release line is the one number that moves for
both. That is why it is the release line and not the wire specifically: `0.2.0`
left the wire untouched and still rewrote what a `GameModule` imports.

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
as long as people leave them installed, so an old client meeting a new server
is the normal case, not the edge case, and it is a case you cannot fix by
shipping a patch.

That asymmetry is why the generated client tolerates both kinds of response
widening: unknown fields are ignored, and unknown enum values become
`unknownDefaultOpenApi`. The server can add either without making a current app
fail response decoding.

The sentinel adds a member to every generated enum, so exhaustive switches must
handle it. Enum additions reuse that same member and do not change the Dart
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
Only `0.2.x` is served, and it is served at the root, so every `/docs/*` URL is
a 0.2.x URL.

There is no `/docs/0.1.x/`. This site's first public deploy already described
`0.2.x`, so no 0.1.x page was ever published and there was nothing to freeze.
Read the 0.1.x reference from the packages themselves: npm and pub.dev keep
every published version, and `eigen_api`'s dartdoc is versioned alongside it.

From here on a breaking engine release freezes this line: `0.2.x` moves to
`/docs/0.2.x/*`, those links keep working, and the root becomes the new line.
