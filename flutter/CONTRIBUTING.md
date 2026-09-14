# Contributing to eigen-flutter

This repository contains the Flutter client framework, app shell, transport,
and Dart half of the game contract.

Game-implementor documentation lives at
[eigeninteractive.com](https://eigeninteractive.com). This guide is for people
changing framework code. Publishing, registry configuration, release tags, and
failure recovery live in [MAINTAINERS.md](MAINTAINERS.md).

## Getting set up

```bash
flutter pub get
dart run build_runner build
flutter analyze
flutter test
```

The example is a separate package with its own dependency resolution:

```bash
cd example
flutter pub get
flutter analyze
flutter test
```

No Firebase project or `.env` is needed. Applications inject runtime values
through `EngineConfig`.

> [!WARNING]
> Never commit a real game's `.env`, Firebase client files, keystores, or `.p8`
> keys to this engine repository. Firebase client identifiers are public, but
> they belong in the consuming game repository. The checked-in RPS example
> keeps only throwing placeholders so analysis and browser compilation work
> without an engine-owned Firebase project.

## Branching

Work on a branch and open a pull request. `main` is protected and release tags
must point at commits already on it.

## The CI gate

The framework job resolves dependencies, checks formatting, regenerates source,
applies Dart fixes, verifies a clean diff, analyzes, validates Dartdoc, and
tests. The example job resolves its own package, regenerates game payloads from
`game-contract.json`, formats, analyzes, and tests.

The clean-diff check is intentional: generated Dart source is committed, so CI
must prove the checked-in output matches its inputs.

Formatting runs against tracked handwritten Dart files rather than `.` because
`dart format` has no exclude flag and generated `*.g.dart`/`*.freezed.dart`
output should not be mechanically reformatted.

## The example

`example/` is Rock–Paper–Scissors: a complete game and the package's
consumer-style integration test. Keep it using the public barrel and a
hand-built `GameContentContext`; do not give it privileged access to internal
libraries.

Its payload types and fixture copies are generated from the server example's
deterministic `game-contract.json`:

```bash
cd example
dart run eigen_codegen:generate_payloads \
  --contract ../../server/examples/rps/game-contract.json \
  --output lib/src/v1/payloads.dart \
  --fixtures-output test/fixtures
```

Never hand-edit generated payloads or fixture copies. The example is also
included on pub.dev, so treat its code as executable API documentation.

## Working with `eigen_api`

The generated REST client is owned by `server/clients/dart` in this monorepo and
published separately as `eigen_api`. It is a member of the pub workspace rooted
at the repository's own `pubspec.yaml`, so local development and CI resolve it
from this checkout with no wiring step: run `flutter pub get` from anywhere in
the tree and pub walks up to the workspace root.

Never add `dependency_overrides` to a workspace member. An override BYPASSES the
declared constraint, which is the failure mode the workspace exists to remove:
`eigen_flutter` could name `eigen_api: ^0.6.0` while resolving 0.7.0 from the
working tree, and every shard would pass on a range only a publish would ever
read. Workspace resolution uses the local package AND still checks the declared
constraint, so a stale pin now fails `pub get` for everyone, immediately. Raise
the pin in the same change that moves the engine to a new line.

Generated response enums include `unknownDefaultOpenApi`. Exhaustive switches
must handle it, normally by presenting an update-required state. It is a
read-side sentinel and must never be serialized back to the server.

## Game contracts and twin fixtures

A game's Worker emits schemas and validated fixtures into one deterministic
`game-contract.json`. The Flutter generator emits payload classes, typed rules
bases, and fixture copies from that artifact.

In separate repositories, pin the contract artifact by checksum and run the
generator in `--check` mode in CI. A fixture or payload change must land with
the matching TypeScript rules change.

## Describing your change

`CHANGELOG.md` follows Keep a Changelog and is maintained with
[`cider`](https://pub.dev/packages/cider). Install it once:

```bash
dart pub global activate cider
```

In the pull request that introduces a user-visible change, add the line package
consumers should read:

```bash
cider log added "Spectator mode on the game screen."
cider log fixed "Avatar cache not invalidated after upload."
```

Valid categories are `added`, `changed`, `deprecated`, `removed`, `fixed`, and
`security`. Commit the resulting `CHANGELOG.md` edit with the code. A purely
internal change needs no entry.

Do this while making the change, not at release time. The maintainer later
turns the accumulated `Unreleased` section into a version without rewriting
the contributor's intent.

**Use the command; do not hand-write the section.** Every `## [x]` heading needs
a matching `[x]: <url>` reference definition at the bottom of the file, because
that is the only thing that makes the heading parse as a link, and cider finds
its sections by looking for links, not by matching text. A heading without one is
invisible to `cider release`, which then leaves your entry in place, appends an
empty version section, and exits 0. `cider log` writes both halves; typing the
heading yourself writes one. CI checks this, since the failure is otherwise
silent until a release is already open.

Reformatting is expected and fine. cider re-serialises the whole file, so it will
unindent your wrapped list continuations and drop blank lines after headings. It
renders identically. Leave it alone rather than restoring the wrapping, which
only guarantees the next release diff is noisy again.

## Generated code

`*.g.dart` and `*.freezed.dart` are committed. Consumers do not run
`build_runner` on dependencies, and the committed output lets code generation
plus a clean-diff check detect drift.

Publishing uses `.pubignore`, which mirrors the repository's local-output and
credential exclusions while also excluding generated monorepo dependency
overrides as a defense in depth. Pub replaces rather than extends `.gitignore`
when that file exists, so keep the two lists aligned when adding an exclusion.

## Documentation changes

Public behavior belongs in the task-first guides in
[`../web`](../web), with the
TypeScript and Dart halves on the same page. Public API detail belongs in `///`
comments so pub.dev's Dartdoc reference stays attached to the declaration.

Repository-development instructions belong here. Privileged operational
instructions belong in [MAINTAINERS.md](MAINTAINERS.md).
