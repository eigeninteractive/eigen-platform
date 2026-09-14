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
flutter pub get
```

The seven Dart packages form one pub workspace, declared in the `pubspec.yaml`
at the repository root, so a single `flutter pub get` there resolves all of them
together and each consumes its siblings from this checkout. There is one
`pubspec.lock`, at the root.

Workspace resolution uses the local package **and still checks the declared
constraint**, which is the difference from the `dependency_overrides` this
replaced: a pubspec naming a range its sibling has outgrown now fails
`pub get` here rather than at a publish weeks later.

Run `flutter pub get` from the root after changing any pubspec. Running it
inside a single package works too -- pub finds the workspace root above it.

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
refactors that should not release a package. User-visible changes to any of the
five hand-written Dart packages need an entry in that package's changelog. Use
`cider --project-root=<package-path> log <type> "<description>"`; do not edit
package versions.

Write those entries with `cider` rather than by hand. Its parser recognises a
section heading only as `## [Unreleased]` or `## [X.Y.Z] - YYYY-MM-DD` whose
bracketed label resolves to a link definition at the foot of the file. A heading
that misses either rule is not rejected: it is demoted to ordinary text, and the
next rewrite folds every entry below it into the neighbouring release. The loss
is silent and the file still reads correctly to a human, which is why
`tool/check-dart-releases.mjs` checks for it.

Maintainers release through the root workflow described in
[`docs/operations/releases.md`](docs/operations/releases.md); contributors do
not edit package versions or create release tags.
