# Maintaining eigen-server

This guide is for people authorized to publish the engine packages, configure
registries and repository secrets, coordinate downstream releases, or operate
the reference deployment.

For local setup, generated artifacts, pull requests, and Changeset selection,
start with [CONTRIBUTING.md](CONTRIBUTING.md).

## Release artifacts

The repository publishes six artifacts:

| Artifact | Registry | Source | Versioning |
|---|---|---|---|
| `@eigeninteractive/rules` | npm | `packages/rules` | fixed group |
| `@eigeninteractive/kernel` | npm | `packages/kernel` | fixed group |
| `@eigeninteractive/server` | npm | `packages/server` | fixed group |
| `@eigeninteractive/testkit` | npm | `packages/testkit` | fixed group |
| `eigen_api` | pub.dev | `clients/dart` | follows the group |
| `create-eigen-game` | npm | `packages/create-eigen-game` | fixed group |

All five npm packages are fixed together in `.changeset/config.json`: they carry
one version and always bump together. `eigen_api` carries the same version as
`@eigeninteractive/server`, whose wire contract it implements.

`create-eigen-game` is in that group for a specific reason. It scaffolds
projects that depend on the engine, so it has to emit an engine range — and it
derives that range from **its own version**, which is only correct because the
two are the same number:

```jsonc
// templates/worker/package.json
"@eigeninteractive/server": "{{ENGINE_VERSION}}"   // → ^<this package's version>
```

That makes the pin incapable of drifting: there is no second number to forget.
A literal in the template would keep scaffolding the previous engine after every
release, silently, and pre-1.0 that previous engine is an incompatible one.

It also leaves pinned scaffolders coherent rather than broken —
`create-eigen-game@0.1.0` emits `^0.1.0`, which still resolves. `npm create`
takes the latest by default, so only a deliberate pin reaches an older one.

The **Flutter** client range is the exception: `eigen_flutter` lives in another
repository and versions independently, so it cannot be derived. It is a single
named constant, `flutterClientVersion` in `src/index.ts`, and must be updated by
hand when a compatible client ships. See the [compatibility
matrix](https://eigeninteractive.com/docs/reference/compatibility).

`create-eigen-game` is also **unscoped**, because that is what makes
`npm create eigen-game` resolve — so it is not owned by the npm organization via
a scope, and the org's team is granted access explicitly instead:

```bash
npm access grant read-write eigeninteractive:developers create-eigen-game
```

npm has no way to publish an unscoped package *as* an organization; ownership
follows whichever account ran `npm publish`. Unpublishing to retry does not
change that and permanently burns the version number.

## Required configuration

The release workflows use:

- `RELEASE_APP_CLIENT_ID` (**variable**, not a secret) and
  `RELEASE_APP_PRIVATE_KEY` (secret): credentials for the **Eigen Release**
  GitHub App, installed on the organization with access to `eigen-server` and
  `eigen-web`. Use the App's **Client ID** (`Iv23li…`), not the numeric App ID —
  `actions/create-github-app-token` deprecated its `app-id` input.
- An **`npm`** repository environment, named by each package's trusted publisher
  on npmjs.com.

There is deliberately **no npm token**. npm authentication is trusted publishing
(OIDC): GitHub's short-lived identity is the credential, and provenance is
emitted automatically without a `--provenance` flag. That is why the publish job
must never set `registry-url` on `actions/setup-node` — it writes an `.npmrc`
whose token npm prefers over an OIDC exchange.

`release.yml` mints a short-lived token from that App and uses it for all three
privileged operations: opening the version pull request, pushing the
`eigen_api-v<version>` tag, and dispatching to `eigen-web`. One credential, no
expiry to track.

Two properties make the App necessary rather than merely tidier. GitHub
suppresses workflow triggers for events raised by the built-in `GITHUB_TOKEN`,
so a version PR it opened would carry no checks and a tag it pushed would start
no workflow — an App's token is not that token, so both work. And
`GITHUB_TOKEN` is scoped to the repository that minted it, so it can never
dispatch to `eigen-web`.

The App must be granted **Contents: Read and write** and **Pull requests: Read
and write**. Its private key is the only long-lived credential here; rotate it
from the App's settings page if it is ever exposed.

npm publishing requests GitHub OIDC for provenance. The Dart workflow uses
GitHub OIDC instead of storing a pub.dev credential.

### This repository must stay public

Provenance only works from a public source repository. npm rejects a
provenance-signed tarball built from a private repo, and the wrapper chain hides
the real error behind `E404 ... is not in this registry`. Trusted publishing
emits provenance unconditionally, so going private would break publishing
outright rather than merely dropping the attestation.

### Branch ruleset

`main` is guarded by a **repository ruleset** (Settings → Rules → Rulesets), not
the legacy branch-protection screen. Rulesets target `~DEFAULT_BRANCH`, so they
keep working if the default branch is ever renamed, and they are readable and
re-creatable through the API.

The required checks are named as they report **from a pull request run**:

```text
Lint, typecheck & test
Dart client is in sync with the spec
```

Do not require the `Checks / …` prefixed variants. Those are the same jobs
reached through `workflow_call` from `release.yml`, which never runs on a pull
request — requiring them would block every merge permanently.

Two deliberate settings:

- **Zero required approvals.** The pull request rule exists to force the checks
  to run and to keep history linear, not to simulate review on a solo project.
- **Non-strict status checks** (branches need not be up to date before merging).
  `release.yml` re-runs the whole gate against the merge commit, so a stale base
  is caught there rather than by forcing a rebase on every merge.

No bypass actor is configured. The release App never pushes to `main` — it
pushes the `changeset-release/main` branch and opens a pull request like anyone
else.

### The release runs as four jobs

`select-mode` decides version-vs-publish, then either `version` opens the
release pull request or `pack` builds tarballs for `publish` to upload. The
split exists because `id-token: write` and `environment:` attach to jobs rather
than steps, so a single job would carry publishing privileges on runs that only
open a pull request.

The sub-actions are pinned to a prerelease commit, which is a deliberate,
bounded choice — see [docs/blockers.md](docs/blockers.md) for the reasoning and
the move to a stable `v2`.

### Registry configuration

Each registry authorises this repository directly; no publishing credential is
stored anywhere. The settings below are already in place — they are recorded so
a change can be recognised as a change.

All five npm packages, under each package's **Settings → Trusted publisher**:

```text
Repository:   eigeninteractive/eigen-server
Workflow:     release.yml
Environment:  npm
```

`eigen_api`, under **Admin → Automated publishing**:

```text
Repository:  eigeninteractive/eigen-server
Tag pattern: eigen_api-v{{version}}
```

All three fields must match exactly. A mismatch fails the OIDC exchange and
surfaces as a misleading `E404 ... is not in this registry` rather than an
authentication error.

## Adding a new published package

Publishing a brand-new package is the one flow CI cannot do for you, because
both registries authorise a package that already exists:

- **npm** — a trusted publisher is configured on an existing package, so the
  first version must be pushed by hand.
- **pub.dev** — automated publishing cannot be configured until the package
  exists, and a *new* package cannot be published straight into a verified
  publisher at all.

So the first version of any new package is manual, and everything after is not.

1. Decide its versioning. Adding it to the `fixed` group in
   `.changeset/config.json` means it shares the engine's version and bumps with
   it; leaving it out means Changesets versions it on its own. Prefer the fixed
   group unless the package genuinely has an independent release cadence.
2. **npm:** run `npm login` from *outside* this repository — npm evaluates
   `devEngines` before any command and refuses here because that field names
   pnpm. Then `pnpm pack` the package and publish the tarball with
   `npm publish <tarball> --access public --otp=<code>`.

   Use `npm publish`, not `pnpm publish`: pnpm 11 implements publishing natively
   and does not send the OTP header, so it fails with a 403 that reads like a
   permissions problem. Packing with pnpm first is what resolves `workspace:*`
   into real versions. One OTP per upload.

   Do **not** create a bypass-2FA token instead. npm restricted those in July
   2026 and removes their publish access in January 2027.
3. **pub.dev:** `dart pub publish`, then package page → **Admin** → **Transfer
   to Publisher** → `eigeninteractive.com`. The transfer is irreversible and
   requires you to be both an uploader of the package and an administrator of
   the publisher.
4. Register it under [Registry configuration](#registry-configuration) so CI can
   publish every subsequent version.
5. An **unscoped** npm package is owned by whoever published it, not by the
   organisation — there is no way to publish one *as* an org, and unpublishing
   to retry only burns the version number. Grant the org team access instead:

   ```bash
   npm access grant read-write eigeninteractive:developers <package>
   ```

## Routine npm releases

Changesets owns versioning and changelog generation. Contributors commit a
`.changeset/*.md` file with their change; versions are never edited by hand.

`checks.yml` enforces this with `changeset status`: a pull request that touches
a published package without a changeset fails. That guard exists because the
omission is otherwise invisible — the pull request merges green, no version
pull request appears, and the change is simply never released. For a change
that genuinely should not ship a version, `pnpm changeset --empty` records the
decision as a committed file. It has to be *committed*: `changeset status`
reads tracked files, so an unstaged empty changeset still fails locally.

The routine flow is:

1. Changes land on `main`.
2. `.github/workflows/release.yml` opens or updates
   **Release: version packages**.
3. Review the combined changelogs and generated `eigen_api` diff.
4. Merge the version pull request.
5. The workflow reruns the full gate and publishes the npm packages with
   provenance.
6. It pushes `eigen_api-v<version>` and dispatches the documentation refresh.

In CI the `workspace:*` rewriting is the `pack` job's responsibility — it
resolves those constraints into tarballs that `publish` then uploads, which is
what keeps the workspace handling away from the authenticated upload. When
publishing **manually**, use `pnpm publish -r` and never `npm publish`: pnpm
does the same rewriting and publishes in topological order.
`publishConfig.access: "public"` is set because scoped npm packages otherwise
default to restricted access.

While the packages are pre-1.0, a breaking change is a `minor` bump and other
user-visible changes are `patch`. A deliberate 1.0 release changes that policy
to ordinary SemVer.

## Publishing `eigen_api`

`.github/workflows/publish-eigen-api.yml` runs when
`.github/workflows/release.yml` pushes `eigen_api-v<version>`.

The separate workflow is required because pub.dev's automated publisher
validates a tag-ref OIDC identity. The npm workflow runs from a branch ref, so
its identity cannot publish to pub.dev directly.

The tag must be pushed with the App token; GitHub deliberately prevents a
tag created with the built-in `GITHUB_TOKEN` from triggering another workflow.
The Dart workflow verifies that the tag matches `clients/dart/pubspec.yaml`,
runs a publish dry run, and publishes exactly the committed generated client.

## Client-first wire changes

Unknown response-enum members decode as `unknownDefaultOpenApi`, so adding one
is wire-additive. It can still carry semantics an older application cannot
safely present.

For such a change:

1. Publish the compatible Flutter package and application.
2. Deploy the compatible web client while the server still emits the old value.
3. Wait until the Play build is available to the intended audience.
4. Only then deploy or enable server behavior that emits the new value.

Without capability negotiation, do not enable the new behavior globally during
a staged Play rollout. Users outside the rollout could reach an
update-required state before Play offers them the compatible application.

The sentinel is read-side only. Serializing it produces
`unknown_default_open_api`, which no route accepts.

### After a compatible `eigen_flutter` ships

Bump `flutterClientVersion` in `packages/create-eigen-game/src/index.ts`, and
update the matrix in eigen-web's `docs/reference/compatibility.md`.

This is the one version number in the project that nothing can derive or
enforce. The scaffolder emits two halves — an npm server and a pub app —
resolved by two package managers that never see each other, so no solver checks
that the engine and client versions agree. Everything else is derived: the
engine range comes from the scaffolder's own version, and `eigen_api`'s version
comes from the server's.

A scaffolder test asserts the literal, so a bump is a reviewed edit rather than
a silent one. Its failure mode is not a wrong value but a forgotten one, which
is why it is a checklist item here and not only a comment in the source.

## Downstream documentation

`eigen-web` commits generated copies of:

```text
packages/server/openapi.json → HTTP reference
package barrels              → TypeScript reference
```

After npm publication, `.github/workflows/release.yml` sends the
`engine-api-changed` repository dispatch. The receiving workflow regenerates
the references and opens a reviewable pull request.

A failing dispatch fails the release job. The npm
publication has already happened at that point, so recover by running eigen-web's
**Sync API reference** workflow manually rather than rerunning this one. Its
scheduled run is only a backstop; do not knowingly leave published APIs
undocumented until then.

Authored prose is never generated. A behavior change still needs a matching
eigen-web pull request.

### A release that crosses a version line

The documentation site is versioned on this engine's release line — pre-1.0 the
minor, so `0.2.x` is one line and `0.3.0` starts the next — and eigen-web
asserts its version label against `info.version` in the spec it receives.

So a release that crosses a line makes the sync pull request go **red** instead
of auto-merging. That is deliberate: someone has to decide whether the old line
gets frozen at `/docs/<line>/*` before the site starts describing the new one.
Nothing here breaks and nothing needs rerunning — the reference simply waits in
an open pull request until that decision is made in eigen-web, whose
`CONTRIBUTING.md` carries the procedure.

Two artifacts still need a hand: the compatibility matrix on
`docs/reference/compatibility.md`, and `flutterClientVersion` here once a
compatible `eigen_flutter` ships.

## Deployment

Package publication and deployment are separate operations. CI never deploys a
game Worker.

`wrangler d1 migrations apply --remote` changes a real database, so deployment
remains an explicit action from an authenticated maintainer machine:

```bash
cd examples/rps
pnpm exec wrangler login
pnpm deploy
```

Apply migrations before deploying code, then verify the public `/health`
endpoint and at least one authenticated request. A green health endpoint proves
the Worker is reachable, not that Firebase or optional integrations are
configured.

## Failure recovery

- **npm did not publish:** fix the failed gate or credentials and rerun the
  workflow. Do not create versions manually.
- **npm published but the Dart tag was not pushed:** push
  `eigen_api-v<version>` manually from the exact release commit.
- **The Dart workflow failed before publication:** fix the cause and rerun it
  against the same tag.
- **The docs dispatch failed:** run eigen-web's sync workflow manually.
- **A bad registry version shipped:** stop dependent releases and follow the
  registry's retraction/deprecation mechanism. Do not reuse or overwrite the
  version.

Record any recovery that changes the normal release sequence in the release
notes or repository issue so the next maintainer can reconstruct what shipped.
