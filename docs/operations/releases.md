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
| `eigen_flutter` | `flutter` | pub.dev | independent |
| Implementor documentation | `web` | Cloudflare | continuous from `main` |

The four engine npm packages move together because their public types and
runtime are tightly coupled. `eigen_api` carries the same version as the engine
whose HTTP contract generated it. The scaffolder and Flutter package move only
when their own user-visible contents change.

## Safety model

- Pull requests and every publish run call `.github/workflows/checks.yml`, the
  exact same whole-platform gate. Its five validation shards run concurrently;
  the final `check` job succeeds only when all five do.
- npm and pub.dev use short-lived GitHub OIDC identities. There are no registry
  tokens to store or rotate.
- The `npm` and `pub.dev` GitHub environments bind each registry identity to
  the intended publishing job. Publishing begins automatically after the
  whole-platform gate and exact-version checks pass.
- The release GitHub App can push release branches and tags and can open pull
  requests. It never bypasses `main` protection.
- An unprivileged registry-comparison job proves that at least one exact local
  version is absent before the OIDC-enabled npm job starts. Changesets then
  resolves workspace ranges and publishes only missing versions, so a retry
  after a partial upload is safe.
- Pub.dev tags are package-namespaced because two Dart packages share this
  repository.

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
write** on `eigen-platform`. Use the client ID, not the numeric App ID.

`main` must require the `check` job from **Platform checks** and disallow direct
pushes. The automation pushes branches and opens ordinary pull requests.

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

Pub.dev requires a tag-triggered GitHub Actions identity and the version in the
tag must match `pubspec.yaml`. Separate patterns are mandatory here because the
repository publishes two Dart packages.

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
published-package diff with neither kind. If only empty markers are pending,
the release workflow opens a small protected cleanup PR so they cannot block
later registry detection.

After a Changeset reaches `main`, **Release npm packages** reruns the platform
gate and opens or refreshes **Release: version npm packages**. The version PR:

- consumes pending Changesets and updates package changelogs;
- stamps and regenerates `eigen_api`;
- regenerates the OpenAPI and TypeScript documentation;
- updates `platform.json`;
- carries the server-owned version commit and root/docs generation commit on
  the same protected release PR.

Review and merge that PR to publish. The next `main` run compares every exact
local version with npm, then publishes the missing versions automatically. If
the engine group published, it creates `eigen_api-vX.Y.Z`; **Publish
eigen_api** reruns the platform gate and publishes the generated client
automatically.

A scaffolder-only release does not create an `eigen_api` tag.

When the engine crosses a documentation release line, the version PR is
expected to fail `check-docs-version`. Before merging, deliberately choose one:

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

After publication it dispatches **Sync compatibility table**, which reads the
registry state, opens a generated PR if necessary, and enables auto-merge after
the platform gate. A manual recovery run accepts an exact expected package:

```bash
gh workflow run sync-compatibility.yml -f expect=eigen_flutter@0.6.1
```

## First releases after cutover

The cutover Changeset intentionally queues compatible patches for all npm
artifacts. Once registry trust points at this repository:

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
