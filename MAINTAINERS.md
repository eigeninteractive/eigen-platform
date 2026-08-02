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

### The release runs as four jobs

`select-mode` decides version-vs-publish, then either `version` opens the
release pull request or `pack` builds tarballs for `publish` to upload. The
split exists because `id-token: write` and `environment:` attach to jobs rather
than steps, so a single job would carry publishing privileges on runs that only
open a pull request.

The sub-actions are pinned to a prerelease commit, which is a deliberate,
bounded choice — see [docs/blockers.md](docs/blockers.md) for the reasoning and
the move to a stable `v2`.

After the first `eigen_api` publication, configure its pub.dev package under
**Admin → Automated publishing**:

```text
Repository:  eigeninteractive/eigen-server
Tag pattern: eigen_api-v{{version}}
```

## First publication

The first registry publication is a bootstrap exception because pub.dev cannot
configure automated publishing until the package exists.

npm imposes the same constraint for a different reason: a trusted publisher is
configured on an existing package, so the packages must exist before CI can ever
publish them.

Before any of this, the repository must live at `eigeninteractive/eigen-server`
and be public. Every `repository.url` already names that location, and npm
matches it case-sensitively when signing provenance. The manual publications
below carry no provenance — they run from a laptop with no OIDC — so the
requirement first bites on the following, automated release.

Authenticate with `npm login`, not a token. npm supports session-based auth, so
2FA prompts normally and no credential is ever created, pasted or rotated.

**eigen-flutter's CI is red until step 3 completes.** That repo resolves
`eigen_api` from pub.dev; only a gitignored `pubspec_overrides.yaml` repoints it
at a local checkout, and CI has no such file. Do not try to make its CI pass
before `eigen_api` is published — publish first, then re-run it.

From clean checkouts:

1. Run the complete CI gate.
2. `npm login` — run it from **outside the repository**. npm evaluates
   `devEngines` before any command and refuses to run here because that field
   names pnpm. Then publish the five npm packages at `0.1.0`:

   ```bash
   pnpm publish -r --access public --no-git-checks --otp=<code>
   ```

   The `--otp` is required: npm rejects publishes authenticated only by a login
   session. Do **not** create a bypass-2FA token instead — npm restricted those
   in July 2026 and removes their publish access in January 2027. If the code
   expires partway through, re-run with a fresh one; already-published versions
   are skipped.
3. In `clients/dart`, run `dart pub publish --dry-run` and then the first
   interactive `dart pub publish`.
4. Transfer `eigen_api` to the `eigeninteractive.com` verified publisher:
   package page → **Admin** → enter the publisher name → **Transfer to
   Publisher**. There is no pubspec field or flag for this; pub deliberately
   cannot publish a *new* package straight to a publisher, so every first
   publication lands under the uploader's Google Account and is moved
   afterwards. You must be both an uploader of the package and an administrator
   of the publisher, and **the transfer is irreversible**. Do this before
   step 5 so automated publishing is configured against the final owner.

   Afterwards, any publisher member can publish new versions, and
   `dart pub publish` works directly — the workaround applies only to a
   package's first-ever publication.
5. Configure pub.dev automated publishing with the repository and tag pattern
   above.
6. Configure a trusted publisher on each of the four npm packages, naming this
   repository, `release.yml`, and the `npm` environment.
7. Configure `RELEASE_APP_CLIENT_ID` and `RELEASE_APP_PRIVATE_KEY`.
8. Publish `eigen_flutter` only after `eigen_api` resolves publicly, then give
   it the same treatment as step 4 — transfer to `eigeninteractive.com` before
   configuring its automated publishing.

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
