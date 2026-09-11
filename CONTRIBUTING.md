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
(cd flutter && flutter pub get)
(cd shell && flutter pub get)
(cd firebase && flutter pub get)
(cd flutter/example && flutter pub get)
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

During iteration, `manifest`, `server`, `flutter`, `web`, and `scaffold` may
be passed instead of `all`. CI runs those same five shards concurrently and
requires their aggregate `check` result. The complete check additionally builds
and tests a freshly scaffolded game. Generation checks compare both tracked
content and the exact file set; commit generated changes with their source
rather than bypassing those checks.

## Scope and history

Read the nested `AGENTS.md` and `CONTRIBUTING.md` before changing a component.
Do not rewrite imported history or mutate the archived predecessor remotes. The
archive refs and import anchors are described in
`docs/architecture/0000-monorepo-import.md`.

## Release notes

Add a Changeset when a published npm package change under `server/` should
produce a release and changelog entry:

```bash
(cd server && pnpm changeset)
```

Do not add a Changeset for tests, comments, CI, documentation, or internal
refactors that should not release a package. User-visible changes under
`flutter/`, `shell/`, or `firebase/` need an entry in that package's changelog.
`eigen_flutter` and `eigen_shell` use `cider` for future releases. Maintainers
release through the root workflows described in
[`docs/operations/releases.md`](docs/operations/releases.md); contributors do
not edit package versions or create release tags.
