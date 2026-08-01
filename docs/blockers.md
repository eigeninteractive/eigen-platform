# Upstream blockers

This file tracks upstream limitations that require temporary compatibility
choices in `eigen-server`, including its release pipeline. It is for engine
maintainers, not game implementors. Keep each entry until the workaround has
been removed, and re-check upstream status before acting on it.

## `changesets/action` sub-actions pinned to a prerelease

**Status:** Adopted deliberately. `release.yml` pins the `select-mode`,
`version`, `pack` and `publish` sub-actions to commit
`c47fa68bd43bb8ae0bae7e558622593deebf5955` (`v2.0.0-next.3`). Move to a stable
`v2` tag when one is published. Last checked: 2026-08-01.

These sub-actions are the only way to publish to npm with **trusted publishing**
(OIDC), which is why they were adopted before the stable release. The
alternative was an `NPM_TOKEN`: npm revoked classic tokens on 2025-12-09 and
caps granular write tokens at a 90-day lifetime, so a token would have meant a
quarterly rotation plus enabling **Bypass 2FA** on the publishing account. There
is now no npm credential anywhere in the pipeline.

The prerelease risk is bounded rather than absent:

- **Pinned by commit, so it cannot shift underneath us.** The usual hazard of a
  `next` line does not apply.
- **Changesets runs this exact layout in production** to publish its own
  packages — 52 of its last 60 runs succeeded when checked.
- **The failures observed upstream were in pre-mode handling**
  (`ENOENT: .changeset/pre/changes.md` in `select-mode`), which only executes
  after `changeset pre enter`. This repo does not use prerelease mode.
- **Failure is fail-safe.** `gate` precedes everything and `pack` holds no
  credentials, so a broken run publishes nothing rather than publishing
  something wrong.

The known cost is that inputs are still moving: v1's `version:` input is already
renamed to `script:` on this line. Expect input adjustments when migrating to
stable, not a re-architecture — the four-job topology is the part being bought,
and that is settled.

### Unblock and remove

1. Confirm a **stable** `changesets/action@v2` release exists, with a floating
   `v2` ref and published documentation (the prerelease shipped with neither).
2. Diff the sub-action `action.yml` inputs against what `release.yml` passes;
   rename as needed.
3. Replace the four pinned commits with the stable ref.
4. Verify with a real release, not a dry run — the publish path is the one that
   cannot be exercised any other way.

### Related constraints that are NOT blockers

Recorded so they are not re-investigated:

- A trusted publisher is configured per package on npmjs.com and requires the
  package to already exist. Handled by publishing `0.1.0` manually with
  `npm login`; pub.dev imposes the same constraint on `eigen_api`.
- `actions/setup-node` must never set `registry-url` in the publish job. It
  writes an `.npmrc` whose token npm prefers over an OIDC exchange, and the
  failure surfaces as a misleading `E404 ... is not in this registry`
  ([npm/cli#8976][npm-cli-8976]).
- `pnpm` publishing under OIDC once 404'd ([pnpm#11513][pnpm-11513]); the cause
  was a stale `pnpm/action-setup`, fixed well before the v6.0.9 pinned here.
- Provenance requires this repository to stay **public**. npm refuses to sign
  provenance from a private source repo.

Upstream references:

- [npm: trusted publishers][npm-trusted]
- [npm: classic tokens revoked][npm-classic-revoked]
- [Changesets' own publish workflow][cs-publish-yml]
- [changesets/action#515 — separate publish workflow for OIDC][ca-515]

[npm-trusted]: https://docs.npmjs.com/trusted-publishers/
[npm-classic-revoked]: https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/
[npm-cli-8976]: https://github.com/npm/cli/issues/8976
[ca-515]: https://github.com/changesets/action/issues/515
[pnpm-11513]: https://github.com/pnpm/pnpm/issues/11513
[cs-publish-yml]: https://github.com/changesets/changesets/blob/main/.github/workflows/publish.yml
