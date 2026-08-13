# 0000: preserve all platform histories in one repository

- Status: accepted
- Date: 2026-08-13

## Decision

Create `eigen-platform` as the vNext implementation repository. Import the
complete `eigen-server`, `eigen-flutter`, and `eigen-web` histories with
unsquashed subtree merges under `server/`, `flutter/`, and `web/`.

Keep namespaced archive refs for every fetched source branch. Preserve source
tags. Leave all three original repositories and their GitHub remotes unchanged
until a separately authorized cutover.

## Why

The protocol, generated Dart client, Flutter runtime, examples, and published
documentation form one compatibility unit. A single revision lets changes to
those surfaces be reviewed, tested, and released atomically. Prefixes preserve
the current builds during consolidation; package movement is a later semantic
step.

## Import anchors

| Component | Release baseline | vNext correctness head |
| --- | --- | --- |
| Server | `2cac83c27d3ecf85f553b998106c3626997f9310` | `1b77ba7` |
| Flutter | `95fe8c196a192b635ad2cbc8ec58f97a17c47dca` | `4619173` |
| Web | `6fdadef77dceed34825254dc45f694bf5e53b671` | `0a45cf2` |

## Consequences

- Existing package names, lockfiles, build systems, and directory shapes remain
  unchanged for the import baseline.
- Root orchestration initially calls each existing build independently.
- The original remotes are archival inputs, not the monorepo's deployment
  remote.
- No source repository is archived, redirected, or made read-only by this local
  operation.
