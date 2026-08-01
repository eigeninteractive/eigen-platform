# Maintaining eigen-server

This guide is for people authorized to publish the engine packages, configure
registries and repository secrets, coordinate downstream releases, or operate
the reference deployment.

For local setup, generated artifacts, pull requests, and Changeset selection,
start with [CONTRIBUTING.md](CONTRIBUTING.md).

## Release artifacts

One engine release produces five artifacts:

| Artifact | Registry | Source |
|---|---|---|
| `@eigeninteractive/rules` | npm | `packages/rules` |
| `@eigeninteractive/kernel` | npm | `packages/kernel` |
| `@eigeninteractive/server` | npm | `packages/server` |
| `@eigeninteractive/testkit` | npm | `packages/testkit` |
| `eigen_api` | pub.dev | `clients/dart` |

The npm packages are fixed together in `.changeset/config.json`. They carry one
version because they are tightly interdependent. `eigen_api` carries the same
version as `@eigeninteractive/server`, whose wire contract it implements.

## Required configuration

The release workflows use:

- `NPM_TOKEN` (secret): npm automation token with publish rights on the
  `@eigeninteractive` scope.
- `RELEASE_APP_ID` (**variable**, not a secret) and `RELEASE_APP_PRIVATE_KEY`
  (secret): credentials for the **Eigen Release** GitHub App, installed on the
  organization with access to `eigen-server` and `eigen-web`.

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

`--provenance` only works from a public source repository. npm rejects a
provenance-signed tarball built from a private repo, and the wrapper chain hides
the real error behind `E404 ... is not in this registry`. If the repository ever
has to go private, remove `--provenance` from `release.yml` rather than trying
to debug the 404.

### Branch protection

Require these two checks on `main`, under the names they report from a pull
request run:

```text
Lint, typecheck & test
Dart client is in sync with the spec
```

Do not require the `Checks / …` prefixed variants. Those are the same jobs
reached through `workflow_call` from `release.yml`, which never runs on a pull
request, so requiring them blocks every merge.

### Why not npm trusted publishing (OIDC)

Trusted publishing would remove `NPM_TOKEN`, and it is the better end state, but
not yet:

- A trusted publisher is configured per package on npmjs.com, so the package
  must already exist. There is no pending-publisher bootstrap as PyPI has.
- `changesets/action`'s `publish:` input spawns the registry client through a
  wrapper chain that does not forward `ACTIONS_ID_TOKEN_REQUEST_*`, so OIDC
  never reaches it (npm/cli#8976, open). Adopting it means publishing from a
  separate top-level step instead.
- The `git+` prefix on every `repository.url` would need normalizing; npm's OIDC
  matching is sensitive to it.

One historic blocker is already gone: `setup-node` used to export a dummy
`NODE_AUTH_TOKEN` that npm preferred over OIDC, producing the same misleading
404. `actions/setup-node@v7` removed it. The `registry-url` input still writes
an `.npmrc`, so verify that interaction when migrating.

Revisit after the packages exist on npm.

After the first `eigen_api` publication, configure its pub.dev package under
**Admin → Automated publishing**:

```text
Repository:  eigeninteractive/eigen-server
Tag pattern: eigen_api-v{{version}}
```

## First publication

The first registry publication is a bootstrap exception because pub.dev cannot
configure automated publishing until the package exists.

Before any of this, the repository must live at `eigeninteractive/eigen-server`
and be public. Every `repository.url` already names that location, and npm
matches it case-sensitively when signing provenance. The manual publications
below carry no provenance — they run from a laptop with no OIDC — so the
requirement first bites on the following, automated release.

From clean checkouts:

1. Run the complete CI gate.
2. Publish the four npm packages at `0.1.0` in topological order with pnpm.
3. In `clients/dart`, run `dart pub publish --dry-run` and then the first
   interactive `dart pub publish`.
4. Transfer both registry packages to the verified Eigen Interactive
   publishers/organizations.
5. Configure pub.dev automated publishing with the repository and tag pattern
   above.
6. Configure the three repository secrets.
7. Publish `eigen_flutter` only after `eigen_api` resolves publicly.

Do not create the `eigen_api-v0.1.0` automation tag for the manually published
version. Tag-driven Dart publication begins with the next engine version.

## Routine npm releases

Changesets owns versioning and changelog generation. Contributors commit a
`.changeset/*.md` file with their change; versions are never edited by hand.

The routine flow is:

1. Changes land on `main`.
2. `.github/workflows/release.yml` opens or updates
   **Release: version packages**.
3. Review the combined changelogs and generated `eigen_api` diff.
4. Merge the version pull request.
5. The workflow reruns the full gate and publishes the npm packages with
   provenance.
6. It pushes `eigen_api-v<version>` and dispatches the documentation refresh.

Use `pnpm publish -r`, never `npm publish`. pnpm rewrites `workspace:*`
constraints to registry versions and publishes in topological order.
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
