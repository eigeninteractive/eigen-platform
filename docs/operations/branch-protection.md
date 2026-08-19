# `main` branch protection

`main` is deliberately in **iteration mode**: it accepts direct pushes and
merges without a required check. This is a temporary development posture, not
the intended steady state. Restore the protected posture below before the first
real deployment or publish to users.

Changed on 2026-08-14 by owner decision, to remove review and check latency
while vNext phases 4–10 land.

## Current posture

| Setting | Iteration mode | Protected mode |
| --- | --- | --- |
| Required status check `check` | off | on, strict (branch must be up to date) |
| Pull request required before merge | off | on, `dismiss_stale_reviews`, 0 approvals |
| Required conversation resolution | off | on |
| Administrator enforcement | off | on |
| Linear history | **on** | on |
| Force pushes | **blocked** | blocked |
| Branch deletion | **blocked** | blocked |

Force pushes and branch deletion stay blocked in both modes. They cost nothing
during iteration and they are the two operations that could damage the imported
histories and archive refs this repository exists to preserve.

## What still validates a commit

Removing the required check does not remove the check. `.github/workflows/checks.yml`
still runs, and its `check` job still aggregates every shard:

- **pull requests** into `main` run it and report the result without gating the
  merge button;
- **direct pushes** to `main` run it as an advisory run, added because a
  direct push opens no pull request;
- **releases and publishes** call the same workflow as a hard gate. That gate is
  unchanged: an irreversible registry upload still cannot proceed on a red
  platform check.

A direct push to `main` therefore reports failures but does not prevent them.
Read the advisory run before building on top of a commit.

One shard rule was pull-request-only and is not any more. The step asserting that
a published npm package's diff carries a Changeset ran on pull requests alone,
which in iteration mode meant it ran on almost nothing: `create-eigen-game`
accumulated four user-visible template changes across direct pushes with no
Changeset and came within one commit of missing the 0.5.0 release. The `server`
shard now applies the same rule to a push, over that push's own range, with the
version commit excepted because it consumes the whole queue by design.

## Restore the protected posture

```bash
gh api -X PUT repos/eigeninteractive/eigen-platform/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["check"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
```

The `check` context must be green on `main` at least once before it is required,
or the required check has no history to match against.

## Return to iteration mode

```bash
gh api -X PUT repos/eigeninteractive/eigen-platform/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
```
