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
| Server | `2cac83c27d3ecf85f553b998106c3626997f9310` | `1b77ba7341f387c95ccaaf7d7c1051e8b0bf1e07` |
| Flutter | `95fe8c196a192b635ad2cbc8ec58f97a17c47dca` | `461917323107f23a74f55ebb4f64fe1555990176` |
| Web | `6fdadef77dceed34825254dc45f694bf5e53b671` | `0a45cf20e5c6b26e82e504d053d67c07f4e63282` |

## Consequences

- Existing package names, lockfiles, build systems, and directory shapes remain
  unchanged for the import baseline.
- Root orchestration initially calls each existing build independently.
- Root CI is the only active workflow surface; imported component workflows are
  retained as history and reference under their subtrees but are not discovered
  by GitHub from those locations.
- The original remotes are archival inputs, not the monorepo's deployment
  remote.
- The documentation source links reserve
  `https://github.com/eigeninteractive/eigen-platform`; no remote repository is
  created or configured by this local import.
- No source repository is archived, redirected, or made read-only by this local
  operation.
