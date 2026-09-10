# 0010: complete the platform cutover

- Status: accepted
- Date: 2026-09-10

## Decision

`eigen-platform` is the sole active source repository for the EigenInteractive
engine, Dart clients, Flutter integration, first-party shell, Firebase adapter,
scaffolder, and implementor documentation.

Archive the predecessor repositories `eigen-server`, `eigen-flutter`, and
`eigen-web` after adding a repository-description pointer here and closing
obsolete open work. Their issues, pull requests, releases, tags, branches, and
commits remain readable in GitHub's archive. Do not delete or rewrite them.

## Evidence

- Complete server, Flutter, and web histories were imported without squashing;
  the import anchors are recorded in [0000](0000-monorepo-import.md) and
  `platform.json`.
- No predecessor branch contains unmerged product work. The one post-import
  `eigen-web` commit is a scheduled regeneration of obsolete API reference from
  the old server and is superseded by the monorepo's same-revision generation.
- The old repositories have no open issues. The only open pull request is an
  obsolete Dependabot update in `eigen-server`; equivalent or newer actions are
  already used here.
- All npm and pub.dev package versions in `platform.json` are published from
  this repository.
- The live OpenAPI document matches this repository byte for byte, and
  Cloudflare Workers Builds reports a successful documentation deployment from
  this repository.
- A clean platform run passes server, Flutter, docs, manifest, and both scaffold
  targets before publication is allowed.

## Consequences

- New code, issues, pull requests, dependency updates, releases, and docs changes
  belong only in `eigen-platform`.
- Old repository links remain valid historical references, and their repository
  descriptions point readers here.
- The old scheduled API-reference sync and release workflows stop running once
  their repositories are archived.
- Cloudflare's GitHub App may have the old `eigen-web` repository removed from
  its allowed repository list; the active `eigen-platform` connection remains.
