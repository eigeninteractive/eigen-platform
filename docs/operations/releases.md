# Release operations

This is the source of truth for publishing the EigenInteractive platform from
`eigeninteractive/eigen-platform`. Package registries authorize this repository
directly; no npm or pub.dev publishing credential is stored in GitHub.

## What is published

| Artifact | Source | Registry | Versioning |
| --- | --- | --- | --- |
| `@eigeninteractive/rules` | `server/packages/rules` | npm | fixed engine group |
| `@eigeninteractive/kernel` | `server/packages/kernel` | npm | fixed engine group |
| `@eigeninteractive/server` | `server/packages/server` | npm | fixed engine group |
| `@eigeninteractive/testkit` | `server/packages/testkit` | npm | fixed engine group |
| `create-eigen-game` | `server/packages/create-eigen-game` | npm | independent |
| `eigen_api` | `server/clients/dart` | pub.dev | follows the engine group |
| `eigen_client` | `dart/eigen_client` | pub.dev | independent |
| `eigen_codegen` | `dart/eigen_codegen` | pub.dev | independent |
| `eigen_flutter` | `flutter` | pub.dev | independent |
| `eigen_shell` | `shell` | pub.dev | independent first-party app |
| `eigen_firebase` | `firebase` | pub.dev | independent optional adapter |
| Implementor documentation | `web` | Cloudflare | continuous from `main` |

The four engine npm packages move together because their public types and
runtime are tightly coupled. `eigen_api` carries the same version as the engine
whose HTTP contract generated it. The scaffolder and the five hand-written Dart
packages move only when their own user-visible contents change.

## Safety model

- Pull requests and direct pushes to `main` call `.github/workflows/checks.yml`.
  Its five validation shards run concurrently; the final `check` job succeeds
  only when all five do. A successful `main` run emits a `workflow_run` event
  that starts `.github/workflows/release.yml` at the checked commit, so the exact
  same commit is not checked twice before it ships.
- Publishing is the one place that gate is still mandatory. `main` itself is in
  [iteration mode](branch-protection.md) and reports the check without gating a
  merge or push, but the publish job runs only after a successful `Platform
  checks` push run for `main`.
- npm and pub.dev use short-lived GitHub OIDC identities. There are no registry
  tokens to store or rotate.
- The `npm` and `pub.dev` GitHub environments bind each registry identity to
  the intended publishing job. Publishing begins automatically after the
  whole-platform gate and exact-version checks pass.
- npm validates the top-level workflow identity. Keeping publication in the
  event-triggered `release.yml` workflow is therefore significant: invoking it
  through `workflow_call` from `checks.yml` would make npm see the caller's
  filename instead.
- The release GitHub App can push release branches and tags and can open pull
  requests. It holds no permission `main`'s protected posture would need to
  exempt it from.
- Pub.dev tag jobs repeat the tagged package's own resolution, analysis, tests,
  and publish dry run. They do not rerun unrelated server, documentation, or
  scaffold shards after the tag's `main` commit has already passed them.
- An unprivileged registry-comparison job proves that at least one exact local
  version is absent before the platform gate and OIDC-enabled npm job start.
  A no-op main push therefore finishes quickly. Changesets then resolves
  workspace ranges and publishes only missing versions, so a retry after a
  partial upload is safe.
- Pub.dev tags are package-namespaced because multiple Dart packages share this
  repository.
- The `eigen_api` tag guard polls npm rather than asking once. It runs seconds
  after the publish step wrote to the same registry, and npm's read path is
  eventually consistent, so both the 0.5.0 and 0.5.1 releases failed there with a
  404 for a version that was already live. It still refuses to tag a version npm
  never accepted; it waits up to two minutes first.
- The `manifest` shard asserts that every direct `eigen_api` consumer uses a
  caret on the generated client's line. Nothing else can: `tool/check.sh` links
  the local client first, so a publish is otherwise the first thing to resolve
  the declared range. See `tool/check-dart-pin.mjs`.

## Required GitHub configuration

The repository must remain public for npm provenance. Configure these values at
the organization or repository level:

| Kind | Name | Purpose |
| --- | --- | --- |
| Actions variable | `RELEASE_APP_CLIENT_ID` | Client ID of the Eigen Release GitHub App |
| Actions secret | `RELEASE_APP_PRIVATE_KEY` | PEM private key for that App |
| Environment | `npm` | npm trusted-publishing identity boundary |
| Environment | `pub.dev` | pub.dev trusted-publishing identity boundary |

The App needs **Contents: read and write** and **Pull requests: read and
write** on `eigen-platform`. Use the client ID, not the numeric App ID. During
the current pre-production iteration phase, `main` permits direct pushes and
reports checks without making them a branch-protection requirement. Publishing
still requires a successful `main` check run. Tighten branch protection when
multiple contributors or production consumers make review enforcement useful.

## One-time registry cutover

Do these steps only after the workflow files have merged to `main`. Registry
forms do not validate every value when saved, so copy them exactly.

### npm

For each of these package pages, open **Settings → Trusted Publisher**, choose
**GitHub Actions**, and replace the previous repository connection:

- `@eigeninteractive/rules`
- `@eigeninteractive/kernel`
- `@eigeninteractive/server`
- `@eigeninteractive/testkit`
- `create-eigen-game`

Use the same values for all five:

```text
Organization or user: eigeninteractive
Repository:           eigen-platform
Workflow filename:    release.yml
Environment name:     npm
Allowed actions:      npm publish
```

The workflow filename is only the basename, not
`.github/workflows/release.yml`. Each package permits one trusted publisher, so
editing/replacing the old entry is the cutover.

After the first successful release, set **Publishing access** to **Require
two-factor authentication and disallow tokens** and revoke any obsolete
automation token. Keep an owner account's interactive recovery access.

### pub.dev

Open **Admin → Automated publishing** for each package and replace the previous
GitHub repository:

`eigen_api`:

```text
Repository:  eigeninteractive/eigen-platform
Tag pattern: eigen_api-v{{version}}
Environment: pub.dev (required)
```

`eigen_flutter`:

```text
Repository:  eigeninteractive/eigen-platform
Tag pattern: eigen_flutter-v{{version}}
Environment: pub.dev (required)
```

`eigen_client`:

```text
Repository:  eigeninteractive/eigen-platform
Tag pattern: eigen_client-v{{version}}
Environment: pub.dev (required)
```

`eigen_codegen`:

```text
Repository:  eigeninteractive/eigen-platform
Tag pattern: eigen_codegen-v{{version}}
Environment: pub.dev (required)
```

`eigen_firebase` (after its first interactive publication):

```text
Repository:  eigeninteractive/eigen-platform
Tag pattern: eigen_firebase-v{{version}}
Environment: pub.dev (required)
```

`eigen_shell` (after its first interactive publication):

```text
Repository:  eigeninteractive/eigen-platform
Tag pattern: eigen_shell-v{{version}}
Environment: pub.dev (required)
```

Pub.dev requires a tag-triggered GitHub Actions identity and the version in the
tag must match `pubspec.yaml`. Separate patterns are mandatory for packages
published from the same repository.

Pub.dev cannot establish trusted publishing for a package that does not exist
yet. Publish `eigen_shell` 0.1.0 interactively once, transfer it to the
EigenInteractive verified publisher if applicable, then configure the
automated-publishing form above. All later versions use GitHub OIDC.

### One-time Flutter comparison anchor

The imported history contains the old generic `v0.6.0` tag. Cider now composes
future comparisons from namespaced tags, so add one alias after this cutover
merges and before opening the first Flutter release:

```bash
git fetch origin --tags
git tag eigen_flutter-v0.6.0 v0.6.0
git push origin eigen_flutter-v0.6.0
```

Both names point to the same historical commit. The old commit contains no
root publish workflow, and 0.6.0 is already on pub.dev, so this is a changelog
anchor, not a republication.

## npm and eigen_api release flow

Contributors add a Changeset from `server/` for every published npm package
change:

```bash
cd server
pnpm changeset
```

For an internal-only change, use `pnpm changeset --empty`. CI rejects a
published-package diff with neither kind, on a pull request and on a direct push
to `main` alike; the version commit is the only exception, since it consumes the
queue and bumps the versions together. If only empty markers are pending,
the release workflow opens a small protected cleanup PR so they cannot block
later registry detection.

After a Changeset reaches `main`, **Release npm packages** opens or refreshes
**Release: version npm packages**. It does not duplicate the main-branch gate
before creating a protected pull request; that version PR runs the complete
platform gate itself. The version PR:

- consumes pending Changesets and updates package changelogs;
- stamps and regenerates `eigen_api`;
- regenerates the OpenAPI and TypeScript documentation;
- updates `platform.json`;
- carries all of that as a single commit. Changesets diffs the whole worktree
  against the base commit, so the cross-workspace regeneration lands with the
  version bump rather than needing a second commit transported onto the branch.

Review and merge that PR to publish. After the next `main` platform run is
green, the resulting `workflow_run` starts **Release npm packages** at that
exact checked commit. It compares every exact local version with npm and
publishes the missing versions automatically. If the matching
`eigen_api-vX.Y.Z` tag does not exist, the publish job creates it after verifying
that exact server version is on npm. **Publish eigen_api** then analyzes and
dry-runs the tagged Dart package before publishing it automatically.

A scaffolder-only release does not create a new client version; it only verifies
that the tag for the current engine already exists.

When the engine crosses a documentation release line, the version PR is
expected to fail `check-docs-version` on its `web` shard. That is the gate doing
its job on a complete, reviewable pull request. Before merging, deliberately
choose one:

1. Relabel current docs in `web/docusaurus.config.ts` when no supported user
   needs the old line.
2. Freeze the old Docusaurus line first when it must remain supported.

That decision is intentionally not automated.

## eigen_flutter release flow

User-visible Flutter changes belong under `## [Unreleased]` in
`flutter/CHANGELOG.md`, normally added with `cider log` while making the change.

Open **Actions → Version eigen_flutter → Run workflow**, choose a bump, or run:

```bash
gh workflow run version-eigen-flutter.yml -f bump=patch
```

Pre-1.0 choices mean:

| Choice | Meaning |
| --- | --- |
| `patch` | compatible fix or addition |
| `minor` | substantial compatible work |
| `breaking` | advances the minor line for an incompatible change |

The workflow opens **Release eigen_flutter vX.Y.Z**. Review the version and
dated changelog, then merge it. **Tag eigen_flutter** creates
`eigen_flutter-vX.Y.Z`; **Publish eigen_flutter** reruns the platform gate,
resolves dependencies without the monorepo override, and publishes
automatically.

## eigen_client, eigen_codegen, eigen_shell, and eigen_firebase release flow

These packages use independent versions and namespaced tags. After their first
interactive publication, change the package version and changelog together and
merge to `main`. The matching **Tag eigen_client**, **Tag eigen_codegen**,
**Tag eigen_firebase**, or **Tag eigen_shell** workflow creates the namespaced
tag automatically; the matching **Publish** workflow validates and uploads
that tag through OIDC. A
manual workflow dispatch safely repairs a missed tag. For a package that does
not yet exist on pub.dev, the tag helper deliberately exits without creating a
tag so its first version can be published interactively.

`eigen_client` must be published before any `eigen_flutter` version that
depends on its new line. `eigen_flutter` must be published before either
`eigen_shell` or `eigen_firebase` versions that depend on that line. The shell
and Firebase adapter are siblings and may then publish independently.
`eigen_codegen` is dev-only and does not affect runtime resolution.

After an `eigen_flutter` publication, its workflow dispatches **Sync
compatibility table**, which reads registry state and opens a generated PR if
necessary. A manual recovery run accepts an exact expected package:

```bash
gh workflow run sync-compatibility.yml -f expect=eigen_flutter@0.8.0
```

### Publish Dart dependencies before updating the scaffold

`create-eigen-game` writes fixed, published ranges for the server,
`eigen_flutter`, `eigen_shell`, and `eigen_firebase`. Those constants are one
tested dependency set; the CLI does not query registries or choose versions at
scaffold time.

After publishing the required Dart packages, raise `flutterClientVersion`,
`flutterShellVersion`, and `firebaseAdapterVersion` in
`packages/create-eigen-game/src/index.ts` as needed, add a Changeset, and let
the normal npm flow ship the reproducible set. `scripts/scaffold-e2e.mjs`
compiles the same-revision graph with local overrides and checks the published
wire pairing separately.

## Release sequence for the shell extraction

The first split release must follow dependency order:

1. Publish `eigen_flutter` 0.9.0.
2. Publish `eigen_shell` 0.1.0 interactively, then configure its pub.dev trusted
   publisher exactly as shown above.
3. Publish `eigen_firebase` 0.2.0.
4. Publish the `create-eigen-game` Changeset that starts generating all three
   hosted constraints.

Do not publish the scaffolder first: its generated `pubspec.yaml` intentionally
contains registry dependencies and must resolve for a user without monorepo
overrides.

## Historical repository-cutover checklist

This checklist records the original monorepo cutover. It is not the current
shell-extraction release sequence:

1. Merge **Release: version npm packages**.
2. Verify the npm packages show the new source repository and provenance.
3. Verify the generated `eigen_api` tag publishes on pub.dev.
4. Add the Flutter comparison anchor described above.
5. Run **Version eigen_flutter** with `patch`, review and merge the release PR.
6. Verify pub.dev source links and the generated compatibility-table PR.
7. Verify the Cloudflare project still deploys `web` from monorepo `main`.
8. Only then archive the three old repositories and point their READMEs at
    `eigen-platform`; keep their tags and history readable.

## Verification after publication

For npm, inspect each published package:

- version and changelog are expected;
- repository links resolve to `eigen-platform/server/...`;
- provenance identifies `eigeninteractive/eigen-platform` and `release.yml`;
- internal dependencies contain registry versions, never `workspace:*`.

For pub.dev:

- the audit log links to the expected GitHub Actions run;
- source and issue links resolve to this repository;
- Dartdoc builds successfully;
- the package tarball contains no `pubspec_overrides.yaml`;
- a clean tag checkout contains no generated local dependency overrides;
- the version and tag match exactly.

## Failure recovery

- **Gate or version PR fails:** fix the branch. Nothing is published yet.
- **npm publish fails before any package uploads:** correct the workflow or
  registry trust and rerun.
- **Some npm packages uploaded:** never reuse their versions. Changesets' mode
  detection is registry-aware; inspect the publish plan before rerunning and
  release a patch if source changed.
- **Dart tag exists but publication did not happen:** fix `main`, delete the
  unpublished tag, and recreate it at the corrected commit. Rerunning a tag
  workflow uses the workflow definition stored at the tag.
- **Dart version is already published:** never move its tag or overwrite the
  version. Publish a new patch. The workflows treat a retry as a clean no-op.
- **Compatibility dispatch failed after Flutter published:** manually run
  `sync-compatibility.yml` with `expect=eigen_flutter@<version>`.
- **A harmful Dart release shipped:** retract it on pub.dev, communicate the
  affected range, and publish a replacement version.

Keep exceptional recovery notes in a repository issue so registry, tag, and
source history remain reconstructable.

## Primary references

- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [pub.dev automated publishing](https://dart.dev/tools/pub/automated-publishing)
