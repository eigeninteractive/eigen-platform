# Contributing to eigen-server

This is the engine: four TypeScript packages plus the RPS example Worker.

User-facing documentation lives at **<https://eigeninteractive.com>** and is
authored in the [`eigen-web`](https://github.com/eigeninteractive/eigen-web)
repository — not here. This file is for people working *on* the engine.

## Getting set up

```bash
pnpm install
pnpm -r build        # packages resolve through exports → dist, so build first
pnpm -r test
pnpm -r typecheck
pnpm exec biome check .
```

No Cloudflare account and no payment method are needed: `wrangler dev` simulates
Durable Objects, D1, R2 and cron locally, and `@eigeninteractive/server/testing` mints test
tokens so integration tests exercise the real auth middleware without Firebase.

## Branching

Work on a branch and open a pull request. `main` is protected and is the only
branch that releases.

## The CI gate

Every PR runs lint → build → typecheck → test, plus four **drift guards** that
regenerate a committed artifact and fail if the result differs:

| Guard | Catches |
|---|---|
| `openapi.json` re-emitted | a route or zod schema change that skipped `pnpm --filter @eigeninteractive/server openapi` |
| Dart client regenerated | a wire change that skipped `pnpm dart-client` — and it runs `dart analyze` + a publish dry run, so the artifact is known to compile |
| D1 + DO migrations regenerated | a drizzle schema edit with no migration — nothing else catches this, and it ships code expecting columns that do not exist |
| `wrangler types` re-run | a renamed or removed binding, which typechecking alone misses |

If one fails, run the command it names and commit the result. Do not hand-edit
a generated artifact.

## The Dart client

`clients/dart` is the `eigen_api` package — the typed Dart REST client,
generated from `openapi.json` and **committed**. Regenerate with:

```bash
pnpm dart-client   # runs the generator via `pnpm dlx`; needs a JDK on PATH
```

The generator is openapi-generator, run through its official npm wrapper with
`pnpm dlx @openapitools/openapi-generator-cli`. The wrapper downloads and
version-pins the JAR (the pin lives in `openapitools.json`), so none of that is
hand-maintained here; openapi-generator is a Java program, so a JDK must be on
PATH, but nothing installs it — CI's `setup-java` and your local install provide
it. It runs via `pnpm dlx` (an ephemeral install), not a workspace
devDependency, on purpose: added to the workspace the wrapper breaks under
pnpm's isolated linker — its build-script approval gate blocks the wrapper's
self-install and its phantom `tslib` fails to resolve — and dlx's throwaway
install sidesteps both while leaving no devDependency behind.

Everything under `clients/dart` is generated except `pubspec.yaml`,
`analysis_options.yaml` and `.openapi-generator-ignore` — which is the list of
those protected files. Never hand-edit anything else; the next run erases it.
`analysis_options.yaml` relaxes exactly two lints, because analysis of a
generated package is a compile check, not a style gate.

It lives here rather than in `eigen-flutter` on purpose. The wire contract is
this repo's, so a breaking change to it should arrive as a **reviewable Dart
diff in the same pull request that changed the zod schema** — not days later, in
another repository, as a failing sync PR. Committing the output is what makes
that diff exist; the CI guard above is what keeps it honest.

Its version is stamped from `@eigeninteractive/server`'s, so a consumer's
`eigen_api: ^0.1.0` states exactly the compatibility it means. `pnpm
version-packages` (which the release workflow runs) regenerates it, so the
version PR already carries the bumped pubspec.

The same field also becomes the spec's `info.version` — `emit-openapi.mjs` reads
it from `package.json` rather than letting the document builder hold a literal,
so the packages, the spec and the client cannot drift apart.

### How it publishes to pub.dev

Not inline with the npm release, and the reason is a pub.dev constraint worth
knowing. pub.dev's automated publishing trusts a GitHub OIDC token **only when
its ref is a tag** matching a pattern you configure on the package — but the npm
release runs on a branch push (a changesets merge), whose token pub.dev rejects.

So the flow is two hops:

1. `release.yml` publishes to npm, then — when a publish actually happened —
   pushes an `eigen_api-v<version>` tag.
2. `release-dart-client.yml` fires on that tag and runs `dart pub publish`, whose
   OIDC token now carries a tag ref pub.dev accepts.

The tag must be pushed with a **PAT**, because a tag pushed by the built-in
`GITHUB_TOKEN` deliberately does not trigger another workflow.

**Required secret:** `RELEASE_TAG_PAT` — a token with `contents: write` on this
repo, used only to push the release tag.

**pub.dev setup, once:** on the `eigen_api` package page → Admin → Automated
publishing, set repository `eigeninteractive/eigen-server` and tag pattern
`eigen_api-v{{version}}`. No pub credential is stored anywhere.

## Releasing to npm

Managed by [changesets](https://github.com/changesets/changesets). You never
hand-edit a version number.

**1. Describe the change as you make it:**

```bash
pnpm changeset
```

Pick a bump type and write the line users will read. Commit the generated
`.changeset/*.md` alongside your code. A change with no user-visible effect
needs `pnpm changeset --empty`.

**2. Merging to `main`** opens or updates a **"Release: version packages"** PR
that applies the bumps and rewrites each package's `CHANGELOG.md`.

**3. Merging that PR publishes.** So releasing is "merge the version PR" — the
decision stays explicit (an npm version cannot be unpublished after 72 hours)
without anyone remembering a version number or a publish order.

The four packages are **`fixed`** in `.changeset/config.json`: they share one
version and always bump together. A single patch on `@eigeninteractive/rules` bumps all
four. They are tightly interdependent, and an independent-version matrix would
be maintained by hand for no benefit.

> The very first publish needs no changeset — `0.1.0` is already set, and
> changesets publishes any version npm does not have yet.

### While we are pre-1.0, never pick `major`

The packages are at **`0.1.0`**, and semver treats `0.x` specially: `^0.1.0`
resolves to `>=0.1.0 <0.2.0`, so the **minor** position is where breakage is
announced and the major position is unused. Translated to the prompt `pnpm
changeset` gives you:

| Your change | Pick | Result |
| --- | --- | --- |
| Breaking | **minor** | `0.1.4` → `0.2.0` |
| Anything else | **patch** | `0.1.4` → `0.1.5` |
| — | ~~major~~ | `0.1.4` → `1.0.0` — declares stability. Not yet. |

changesets applies the bump literally; it will not translate `major` into "the
0.x equivalent". So choosing `major` for an ordinary breaking change ships
`1.0.0` and the stability promise that comes with it.

This inverts once `1.0.0` is deliberate: from then on breaking is `major` and
additive is `minor`, and the table above stops applying.

### The bump type that surprises people

Generated Dart enums include an `unknownDefaultOpenApi` sentinel. An installed
client can therefore decode an enum member introduced by a newer server, so
**adding a member to a response enum is additive**. The sentinel is read-side
compatibility only: serialising it produces `unknown_default_open_api`, which no
route accepts. Removing or renaming a member remains breaking, as does widening
an enum that a client must send unless the old client can never select the new
member.

The sentinel was enabled before the first release, so its extra enum member did
not require a version bump or migration. Future enum widening reuses that member
and does not change the Dart surface.

### Two things that are easy to get wrong

- **`pnpm publish -r`, never `npm publish`.** The packages depend on each other
  with `workspace:*`. pnpm rewrites those to real versions on the way out and
  publishes in topological order (`@eigeninteractive/rules` before its dependents); npm
  would publish the literal `workspace:*` and produce four broken tarballs.
- **`publishConfig.access: "public"`** is set on each package. Scoped packages
  default to restricted, which fails on a free account.

Publishing uses [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
so each tarball is traceable to the commit and workflow run that built it. That
needs `id-token: write`, which the workflow already declares.

**Required secret:** `NPM_TOKEN` — an npm automation token with publish rights
on the `@eigeninteractive` scope.

## Notifying downstream repos

`eigen-web` holds vendored copies of two things this repo produces, and cannot
detect a change to either on its own:

```text
openapi.json    →  eigen-web      (regenerates the HTTP API reference)
package barrels →  eigen-web      (regenerates the TypeDoc reference)
```

`eigen-flutter` used to be on that list. It no longer is: it consumes the
published `eigen_api` as an ordinary dependency, so a wire change reaches it as
a version bump rather than a file copy.

There is a third coupling that **nothing dispatches**, because it is a hand
edit on both sides: the RPS twin fixtures.
`examples/rps/src/rules/fixtures/v1/rps.json` here and
`example/fixtures/v1/rps.json` in `eigen-flutter` are the same file, run against
the TypeScript unit here and the Dart twin there. Editing one leaves that repo
green while the other holds a stale copy, and nothing fails until the other
repo's CI next runs. **A rules change is a two-repo change**, and the fixture
edit is the part that must land in both.

A case's `obs` field is read only by the Dart runner — it is the acting seat's
observation, which for a hidden-information game is not the state. Omitting it
means "the two coincide", which is true only for perfect-information games.

`.github/workflows/notify-consumers.yml` dispatches an `engine-api-changed`
event when one of those inputs lands on `main`. `eigen-web` regenerates and
**opens a pull request** — the PR is the notification, a reviewable diff rather
than an alert to triage.

**Required secret:** `CONSUMER_DISPATCH_TOKEN` — a PAT or GitHub App token with
`contents: write` on `eigen-web`. The default `GITHUB_TOKEN` cannot reach
another repository. If it is absent the job warns instead of failing; the sync
can still be run manually from that repo's Actions tab, and it has a weekly
scheduled backstop.

## Deploying

CI never deploys. `wrangler d1 migrations apply --remote` mutates a real
database, and a deploy is the one action here that re-running a job cannot
reverse — so it stays a deliberate, credentialed `pnpm deploy` from a machine
with `wrangler login`.

## Documentation changes

Changing behaviour usually means changing docs, and the docs are in another
repository. Open a matching PR against
[`eigen-web`](https://github.com/eigeninteractive/eigen-web); the generated API
reference there refreshes itself via the dispatch above, but prose does not.
