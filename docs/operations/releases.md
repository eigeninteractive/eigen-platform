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

- Pull requests to `main` call `.github/workflows/checks.yml`. Its five
  validation shards run concurrently; the final `check` job succeeds only when
  all five do. The [repository ruleset](rulesets.md) requires that result before
  squash merge. A successful check of the resulting `main` commit emits
  `workflow_run` events that start `.github/workflows/release.yml` and
  `.github/workflows/publish-dart.yml` at the checked commit.
- Publishing runs only after a successful `Platform checks` push run for
  `main`. The pull-request run protects the merge; the main run protects the
  release and proves the exact commit that will ship.
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
  requests. It has no ruleset bypass and never pushes directly to `main`.
- The Dart tag coordinator runs only after the complete `main` gate. Each
  package-specific pub.dev job repeats its own resolution, analysis, tests, and
  publish dry run. It does not rerun unrelated server, documentation, or
  scaffold shards after the tagged commit has already passed them.
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
- Constraints between the Dart packages are checked by resolution itself. They
  are one pub workspace, so `pub get` uses the local sibling and still enforces
  the declared range; a consumer naming a line its sibling has outgrown fails
  every shard rather than reaching a publish. This replaced
  `tool/check-dart-pin.mjs`, which read the pubspecs by hand because
  `dependency_overrides` meant nothing else resolved them.
- The `manifest` shard still checks that each hand-written Dart package's
  pubspec version is its latest linked changelog release. See
  `tool/check-dart-releases.mjs`.

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
write** on `eigen-platform`. Use the client ID, not the numeric App ID. It needs
no administration permission or ruleset bypass.

## Registry trusted-publisher configuration

These are the active registry bindings. Registry forms do not validate every
value when saved, so preserve them exactly.

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

Configured per package by **tag pattern**, not by workflow file, so the single
`publish-dart.yml` that serves all five patterns needs no change here.

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

`eigen_firebase`:

```text
Repository:  eigeninteractive/eigen-platform
Tag pattern: eigen_firebase-v{{version}}
Environment: pub.dev (required)
```

`eigen_shell`:

```text
Repository:  eigeninteractive/eigen-platform
Tag pattern: eigen_shell-v{{version}}
Environment: pub.dev (required)
```

Pub.dev requires a tag-triggered GitHub Actions identity and the version in the
tag must match `pubspec.yaml`. Separate patterns are mandatory for packages
published from the same repository.

Pub.dev cannot establish trusted publishing for a package that does not exist
yet. All six packages now have their initial publication, so later versions use
GitHub OIDC.

## npm and eigen_api release flow

Contributors add a Changeset from `server/` when a published npm package change
should produce a release and changelog entry:

```bash
cd server
pnpm changeset
```

Not every repository change needs a release. Tests, comments, CI, documentation,
and internal refactors can merge without a Changeset. Do not add an empty
Changeset for them: the release queue should contain only changes that will
actually version at least one package. Whether a package change is release-worthy
is a contributor and reviewer decision rather than a mechanical path-based CI
rule.

After a Changeset reaches `main`, **Release npm packages** opens or refreshes
**Release: version npm packages**. It does not duplicate the main-branch gate
before creating a protected pull request. That deterministic version PR runs
only the manifest and documentation shards: its source `main` commit has already
passed the complete gate, and its final merged `main` commit must pass the
complete gate again before publication. The version PR:

- consumes pending Changesets and updates package changelogs;
- stamps and regenerates `eigen_api`;
- regenerates the OpenAPI and TypeScript documentation;
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

When the engine crosses a documentation release line, the version PR needs no
documentation change. `web/docusaurus.config.ts` derives the site's version
label from `info.version` in `api/openapi.json`, which that same PR regenerates,
so the label moves with the release.

Freezing the old line into `versioned_docs/` is a separate decision, triggered
by an adopter who cannot follow the break rather than by the crossing itself,
and it can be made at any time afterwards. `web/CONTRIBUTING.md` has the
procedure, including how to cut a line the site has already moved past.

## Hand-written Dart package release flow

`eigen_client`, `eigen_codegen`, `eigen_flutter`, `eigen_shell`, and
`eigen_firebase` have independent versions and namespaced tags. User-visible
changes belong under `## [Unreleased]` in the affected package's
`CHANGELOG.md`, added with Cider while making the change. From the repository
root, for example:

```bash
cider --project-root=dart/eigen_client log fixed "Ignore stale game snapshots."
cider --project-root=flutter log added "Show spectators in the game screen."
```

Open **Actions → Version Dart packages → Run workflow** and choose a bump, or
run:

```bash
gh workflow run version-dart-package.yml -f bump=patch
```

There is no package to choose. The workflow versions every package that has
`## [Unreleased]` entries, and Melos works out the rest: `--dependent-constraints`
rewrites the caret ranges these packages name each other by in the same commit,
and `--dependent-versions` gives a patch release to anything whose only change
was one of those ranges.

That is the whole reason it works this way. A caret range names a **published**
version, so before Melos a consumer's pin could only be raised after its
dependency published -- which made every release serial, one round per level of
the dependency graph, and cost the offline-play release three hand-written pull
requests. Versioning and constraint-rewriting in one commit removes the rounds.

Pre-1.0 choices mean:

| Choice | Meaning |
| --- | --- |
| `patch` | compatible fix or addition |
| `minor` | substantial compatible work |
| `breaking` | advances the minor line for an incompatible change |

`minor` and `breaking` do the same thing below 1.0, because the breaking change
*is* the minor bump there -- that is what `^0.2.0` resolving to `>=0.2.0 <0.3.0`
means. They separate at 1.0.

Melos and cider disagree about 0.x, and the workflow maps between them. On
0.2.0, cider gives patch 0.2.1, minor 0.3.0, breaking 0.3.0; Melos gives patch
0.2.1, minor 0.2.1, major 0.3.0 -- it shifts each name down one position below
1.0 and cider does not. The table above is what a dispatch means; the mapping is
in the workflow.

The workflow refuses to bump while any package's current local version is absent
from pub.dev, or to release when no package has an `Unreleased` entry. It opens
**Release Dart packages** carrying versions, rewritten constraints and dated
changelogs. Review and merge it.

Once the merged commit passes the complete platform gate, **Tag Dart packages**
creates each namespaced tag whose version is neither tagged nor published. Each
tag then starts **Publish Dart package**, which resolves the package from the
tag name, checks that the tag and the pubspec agree, and uploads through OIDC.
Existing tags and published versions are no-ops.

One workflow serves all five tag patterns, where there used to be five. It has
to be triggered by a tag, and that is pub.dev's rule rather than a preference:

> Pub.dev only allows automated publishing from GitHub Actions when the workflow
> is triggered by pushing a git tag to GitHub. Pub.dev rejects publishing from
> GitHub Actions triggered without a tag.

So the `workflow_run`-on-green-`main` shape `release.yml` uses for npm is not
available here, however alike the two halves otherwise look. What pub.dev
validates is the repository, the tag against each package's configured pattern,
and the `pub.dev` environment -- **not** which workflow file published it. That
last one is npm's rule and does not transfer, which is why five tag patterns can
share one workflow and why consolidating them needed no change to any package's
pub.dev settings.

Tags are pushed together, so the publish runs are concurrent and unordered. That
used to matter, because each run resolved its dependencies from pub.dev and
`eigen_shell` could fail on an `eigen_flutter` that was still uploading. It no
longer does: these packages are one pub workspace, so a run resolves its
siblings from the checkout. What remains is a window of minutes in which a
published package names a sibling version pub.dev does not have yet, where a
consumer resolving gets a solver error and succeeds on retry.

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
  unpublished tag, and recreate it at the corrected commit. The package publish
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
