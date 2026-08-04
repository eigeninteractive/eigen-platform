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
| `create-eigen-game` | npm | `packages/create-eigen-game` | independent |

The four engine packages are fixed together in `.changeset/config.json`: they
carry one version and always bump together. `eigen_api` carries the same version
as `@eigeninteractive/server`, whose wire contract it implements.

### Why the scaffolder versions on its own

`create-eigen-game` was a fifth member of that group, because it emits an engine
range and derived it from **its own version** — correct only while the two were
the same number.

That bought a real guarantee at a price that eventually came due. The
requirement is one-directional: the scaffolder must follow the engine, but the
engine must not follow the scaffolder. A `fixed` group is symmetric by
definition, so a template typo proposed moving four published packages onto a
new version line — and pre-1.0, a new line is a breaking one that no published
`eigen_flutter` speaks yet.

The range now comes from the scaffolder's own `@eigeninteractive/server`
devDependency instead. That is not a second number to maintain: it is the
version CI compiled the templates against, since `pnpm -r typecheck` runs
`tsc -p templates/worker/tsconfig.json` inside this workspace. pnpm rewrites
`workspace:*` to the exact version when it packs the tarball, so the published
scaffolder simply reads it.

The forward half needs no machinery, and briefly had some that was actively
harmful. A script added a `create-eigen-game` changeset whenever the engine
crossed a line — which released a scaffolder pairing the **new** engine with the
**old** shell, since no compatible shell can exist yet at that moment. It
published the exact mismatch the pin prevents. Doing nothing is strictly better:
the scaffolder on npm keeps pairing 0.2 with 0.2, a line behind but working.

The moment worth releasing on is not "the engine moved" but "a compatible shell
now exists" — and that moment already carries a code change here, raising
`flutterClientVersion`, which needs a changeset like any other. So the
scaffolder follows the engine by construction, one step later than the naive
trigger and one step more correct. The **Scaffolded project builds** job turns
red exactly when that step is due.

Only a line change matters either way: the emitted range is a caret, so
scaffolders already on npm pick up 0.2.7 from `^0.2.0` by themselves.

The **Flutter** client range is a stated pin in `src/index.ts`, and deliberately
neither derived nor resolved. `eigen_flutter` lives in another repository, so
nothing here can compute it — see [the scaffolder's Flutter
pin](#the-scaffolders-flutter-pin) and the [compatibility
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
6. **If the engine was among them**, it pushes `eigen_api-v<version>` and
   dispatches the documentation refresh. A scaffolder-only release skips both:
   `eigen_api` did not move and there is no new API to document.

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

### The scaffolder's Flutter pin

`create-eigen-game` emits an npm server and a pub app, resolved by two package
managers that never see each other, so no solver checks that the halves agree.
The `eigen_flutter` range in `packages/create-eigen-game/src/index.ts` is where
that agreement is asserted.

**After a compatible `eigen_flutter` ships**, raise that pin and update the
matrix in eigen-web's `docs/reference/compatibility.md`.

It is a caret range, so it only needs raising when `eigen_flutter` crosses a
line: `flutter pub add eigen_flutter@^0.2.0` already takes the newest 0.2.x at
scaffold time.

This briefly resolved from pub.dev instead — "the newest `eigen_flutter` whose
own `eigen_api` constraint targets the engine line being scaffolded" — to avoid
a literal nobody would remember to update. **That predicate is wrong**, and it
is worth knowing why before anyone reaches for it again. The `eigen_api`
constraint describes the *wire* a shell speaks; the templates call its *Dart
API*; the two move independently. A future `eigen_flutter` may legitimately hold
`eigen_api: ^0.2.0` while renaming everything `lib/game/v1/rules.dart` touches,
and it would have been selected — emitting a project that does not compile, on
someone's first contact with the engine.

A pin cannot fail that way. It can only be stale, and staleness is now a red
check rather than a broken scaffold: the **Scaffolded project builds** job in
`checks.yml` generates a real project on every change and checks it twice.

`flutter analyze` and `flutter test` cover the **Dart API** — that the templates
call symbols the shell actually has. That job is also the only thing that
compiles `templates/app-overlay` at all; before it, the Dart templates were
never built anywhere, in this repository or eigen-flutter.

The **wire** is a separate claim and gets its own assertion: the job reads the
`eigen_api` version out of the generated `pubspec.lock` and compares its
compatibility line to the engine range the scaffolder emitted. Analysis cannot
stand in for this. A shell one line behind can compile perfectly against
templates that barely touch what changed, and the mismatch would then surface as
a decode failure against a running server, long after anyone connected it to a
scaffold.

A mismatch is not automatically a defect, though, and the job asks pub.dev which
one it is. **The shell cannot match a brand-new engine line**: `eigen_api` ships
with the engine, so no `eigen_flutter` of any version number can constrain
`^0.3.0` until `eigen_api 0.3.0` is published — which is the engine release
itself. An unconditional assertion fails on the version pull request that crosses
the line, and as a required check would block the merge that publishes the
`eigen_api` the shell is waiting on. That is a permanent deadlock, not a delay.

So the job distinguishes:

| pub.dev says | Meaning | Result |
|---|---|---|
| no shell constrains this engine line | mid-crossing, expected | notice, pass |
| one does, and the pin misses it | the pin is stale | fail |

The second doubles as the release trigger: the job turns red the moment a
compatible shell ships, which is exactly when `flutterClientVersion` should be
raised and the scaffolder released.

This queries the registry the deleted resolver queried, for the opposite
purpose. *Choosing* a shell by its `eigen_api` constraint is wrong, because the
constraint cannot see the Dart API the templates call. Asking whether a shell
for this line exists at all makes no claim about the Dart API — `flutter
analyze` above already settled that.

It resolves the four engine packages from this workspace rather than npm. That
is not only closer to what is about to ship; it is required. The scaffolder
emits the new engine line before that line exists on npm, so resolving from the
registry would fail on the exact commit that publishes it, deadlocking every
line-crossing release.

`eigen_flutter` is deliberately not overridden that way. Substituting it would
defeat the purpose — a real resolution against pub.dev is the only thing that
makes the pin mean anything.

## Downstream documentation

`eigen-web` commits generated copies of:

```text
packages/server/openapi.json → HTTP reference
package barrels              → TypeScript reference
```

After an **engine** publication, `.github/workflows/release.yml` sends the
`engine-api-changed` repository dispatch. The receiving workflow regenerates
the references and opens a reviewable pull request.

Specifically after an engine publication, not after any publication. Since
`create-eigen-game` versions independently, a release can now reach that point
with `openapi.json` untouched, and dispatching then rewrites every reference's
permalink SHA for no change in content. The job reads `published-packages` to
tell the two apart. It got this wrong once, on the first scaffolder-only
release, and eigen-web merged 389 lines of SHA churn as a result.

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

Two artifacts still need a hand once a compatible `eigen_flutter` ships: the
compatibility matrix on eigen-web's `docs/reference/compatibility.md`, and
`flutterClientVersion` in `packages/create-eigen-game/src/index.ts` — see [the
scaffolder's Flutter pin](#the-scaffolders-flutter-pin).

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
