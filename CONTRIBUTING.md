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
Durable Objects, D1, R2 and cron locally, and `@eigen/server/testing` mints test
tokens so integration tests exercise the real auth middleware without Firebase.

## Branching

Work on a branch and open a pull request. `main` is protected and is the only
branch that releases.

## The CI gate

Every PR runs lint → build → typecheck → test, plus three **drift guards** that
regenerate a committed artifact and fail if the result differs:

| Guard | Catches |
|---|---|
| `openapi.json` re-emitted | a route or zod schema change that skipped `pnpm --filter @eigen/server openapi` |
| D1 + DO migrations regenerated | a drizzle schema edit with no migration — nothing else catches this, and it ships code expecting columns that do not exist |
| `wrangler types` re-run | a renamed or removed binding, which typechecking alone misses |

If one fails, run the command it names and commit the result. Do not hand-edit
a generated artifact.

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
version and always bump together. A single patch on `@eigen/rules` bumps all
four. They are tightly interdependent, and an independent-version matrix would
be maintained by hand for no benefit.

> The very first publish needs no changeset — `1.0.0` is already set, and
> changesets publishes any version npm does not have yet.

### The bump type that surprises people

Wire enums are closed sets: the generated Dart client parses them strictly, with
no `unknown` sentinel. So **adding a member to any enum on the wire**
(`GameStatus`, `ErrorCode`, `GameAccess`, seat type) breaks the client build and
is a **major** bump — even though it looks purely additive. It also needs a
schema-version bump and a coordinated client release.

### Two things that are easy to get wrong

- **`pnpm publish -r`, never `npm publish`.** The packages depend on each other
  with `workspace:*`. pnpm rewrites those to real versions on the way out and
  publishes in topological order (`@eigen/rules` before its dependents); npm
  would publish the literal `workspace:*` and produce four broken tarballs.
- **`publishConfig.access: "public"`** is set on each package. Scoped packages
  default to restricted, which fails on a free account.

Publishing uses [npm provenance](https://docs.npmjs.com/generating-provenance-statements),
so each tarball is traceable to the commit and workflow run that built it. That
needs `id-token: write`, which the workflow already declares.

**Required secret:** `NPM_TOKEN` — an npm automation token with publish rights
on the `@eigen` scope.

## Notifying downstream repos

The engine is the producer in two cross-repo contracts, and neither consumer can
detect a change on its own — both hold vendored copies:

```text
openapi.json    →  eigen-flutter  (regenerates its typed Dart client)
                →  eigen-web      (regenerates the HTTP API reference)
package barrels →  eigen-web      (regenerates the TypeDoc reference)
```

`.github/workflows/notify-consumers.yml` dispatches an `engine-api-changed`
event to both when one of those inputs lands on `main`. Each consumer
regenerates and **opens a pull request** — the PR is the notification, a
reviewable diff rather than an alert to triage.

This matters most for the client: generated Dart enums carry no `unknown`
sentinel, so a new wire-enum member is a *compile error by design*. A failing
sync PR means the change is breaking and needs a coordinated schema-version
bump, not a patch.

**Required secret:** `CONSUMER_DISPATCH_TOKEN` — a PAT or GitHub App token with
`contents: write` on `eigen-flutter` and `eigen-web`. The default `GITHUB_TOKEN`
cannot reach another repository. If it is absent the job warns instead of
failing; each consumer can still be synced manually from its Actions tab, and
both have a weekly scheduled backstop.

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
