# `main` repository ruleset

`main` is governed by one repository ruleset. GitHub rulesets are the canonical
policy surface; the repository has no overlapping classic branch-protection
configuration.

## Active policy

The `main` ruleset targets `~DEFAULT_BRANCH` and has no bypass actors.

| Rule | Setting |
| --- | --- |
| Changes must use a pull request | Required |
| Required approvals | 0 |
| Allowed merge method | Squash |
| Review threads | Must be resolved |
| Required status check | `check`, strict/up to date |
| Linear history | Required |
| Force pushes | Blocked |
| Branch deletion | Blocked |

Zero approvals is deliberate for a solo-maintained, early-stage project. A pull
request still provides a reviewable diff, runs the gate before merge, and keeps
automation away from direct writes to `main`, without making the maintainer find
a second account to approve routine work.

There is no release-bot bypass. Changesets writes its version commit to
`changeset-release/main`, and the Dart coordinators write package tags. None of
these workflows needs to push directly to `main`.

## What validates a commit

`.github/workflows/checks.yml` reports one stable aggregate job named `check`:

- pull requests run the relevant parallel shards and cannot merge until `check`
  succeeds;
- the squash-merged `main` commit runs again, because that exact commit is the
  release boundary;
- npm publishing and Dart tag creation listen for the successful `main` run and
  operate on its exact commit;
- package-specific pub.dev workflows repeat the package's own validation at its
  tag, without rerunning unrelated platform shards.

Documentation-only changes and Changesets' deterministic version pull request
use documented narrow paths through the gate. Unknown paths fail closed to the
complete platform check.

Routine third-party Actions use maintained major or exact-version tags and are
updated by Dependabot. The two release-sensitive actions remain pinned to full
commit SHAs. Repository-wide SHA enforcement is deliberately off because it
also rejects version-tagged actions used internally by standard composite
actions such as `setup-java`.

## Verify the policy

```bash
gh api repos/eigeninteractive/eigen-platform/rulesets \
  --jq '.[] | {id, name, enforcement}'

gh api repos/eigeninteractive/eigen-platform/rules/branches/main \
  --jq 'map(.type)'

gh api repos/eigeninteractive/eigen-platform/branches/main/protection
# Expected: HTTP 404, because classic branch protection is intentionally absent.

gh api repos/eigeninteractive/eigen-platform/actions/permissions \
  --jq '{enabled, allowed_actions, sha_pinning_required}'
# Expected: sha_pinning_required is false.
```

## Emergency recovery

Prefer a normal fix pull request. If the ruleset itself makes that impossible,
an organization owner may temporarily disable it in **Settings → Rules →
Rulesets**, perform the minimum recovery, and immediately re-enable it. The same
operation is available through the API:

```bash
ruleset_id=$(gh api repos/eigeninteractive/eigen-platform/rulesets \
  --jq '.[] | select(.name == "main") | .id')

gh api -X PUT "repos/eigeninteractive/eigen-platform/rulesets/$ruleset_id" \
  -f enforcement=disabled

# Perform the minimum recovery here.

gh api -X PUT "repos/eigeninteractive/eigen-platform/rulesets/$ruleset_id" \
  -f enforcement=active
```

Do not add a permanent administrator or automation bypass for convenience. A
temporary ruleset change is visible in ruleset history and keeps the ordinary
path simple.
