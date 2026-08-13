# Contributing to the EigenInteractive platform

The platform is one compatibility unit even though its imported build systems
remain separate for now. A protocol or game-contract change is incomplete until
the server, generated Dart API, Flutter runtime, examples, and documentation all
agree in the same commit.

## Setup

Use Node and Flutter versions from `server/.nvmrc` and `flutter/.fvmrc`. Dart
API regeneration also needs a JDK 21; CI installs Temurin, and Android Studio's
bundled JDK is suitable locally. Then install dependencies:

```bash
(cd server && pnpm install --frozen-lockfile)
(cd web && pnpm install --frozen-lockfile)
./tool/link-local-dart.sh
(cd flutter && flutter pub get && flutter pub get --directory example)
```

`link-local-dart.sh` creates ignored `pubspec_overrides.yaml` files so Flutter
consumes the generated Dart API under `server/clients/dart` from this checkout.
They are local build wiring, not source; published package constraints remain
unchanged.

## Validation

Run the complete baseline before handoff:

```bash
./tool/check.sh all
```

During iteration, `contracts`, `server`, `flutter`, `web`, and `scaffold` may
be passed instead of `all`. CI runs those same five shards concurrently and
requires their aggregate `check` result. The complete check additionally builds
and tests a freshly scaffolded game. Generation checks compare both tracked
content and the exact file set; commit generated changes with their source
rather than bypassing those checks.

## Scope and history

Read the nested `AGENTS.md` and `CONTRIBUTING.md` before changing a component.
Do not rewrite imported history or mutate the original repository remotes. The
archive refs and import anchors are described in
`docs/architecture/0000-monorepo-import.md`.

## Release notes

Changes to a published npm package under `server/` need a Changeset:

```bash
(cd server && pnpm changeset)
```

Use `pnpm changeset --empty` when the package diff is intentionally not a
release. User-visible changes under `flutter/` need an entry in the Unreleased
section of `flutter/CHANGELOG.md`, normally added with `cider log`. Maintainers
release through the root workflows described in
[`docs/operations/releases.md`](docs/operations/releases.md); contributors do
not edit package versions or create release tags.
