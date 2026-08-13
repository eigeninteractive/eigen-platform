# vNext execution status

Last updated: 2026-08-13.

## Approved defaults

Implementation authorization adopts the review handoff's recommended defaults:

- one SQLite Durable Object is authoritative per game;
- D1 is a registry/read model, not the live game writer;
- TypeScript is the only authoritative rules implementation;
- HTTP mutations require client-created identities;
- the server stream carries complete per-seat sessions;
- one serialized coordinator consumes command, stream, recovery, and cache data;
- Firebase is the first auth adapter, never a core dependency;
- the core is pure Dart, with Flutter, Firebase, and app-shell adapters above it;
- vNext is a clean break described by an exact platform manifest;
- game projects remain separate from this platform repository;
- no R2 cold tier is introduced without measured need.

## Phase status

| Phase | Status | Evidence |
| --- | --- | --- |
| 0: baseline and authorization | Partial | Source commits, package versions, remotes, and existing checks captured; production retention duration remains an owner gate |
| 1: normative contract | In progress | RFCs 0001–0008 and `contracts/`; RFC 0007 remains proposed pending the retention choice |
| 2: repository consolidation | Complete | Unsquashed imports, 52 archive branch refs, 77 tags, same-SHA docs/client wiring, root check and CI |
| 3: existing correctness defects | Complete | Timing ownership/alarm boundary, terminal absorption, gap integrity, and pending-control cleanup imported with tests |
| 4+: semantic vNext implementation | Not started | Must follow accepted RFCs and add failing invariant tests first |

## Current validation contract

`./tool/check.sh all` is the single baseline gate. It covers server packages,
Workers tests, schemas/migrations/Worker types, generated OpenAPI and Dart API,
package tarballs and publish dry-runs, Flutter analysis/docs/VM/browser tests,
the release web build, generated API docs, Docusaurus/LLM output, and a newly
scaffolded Worker plus Flutter app.

## External gates

The following require owner action and are deliberately not performed locally:

1. choose the exact default retention duration in RFC 0007;
2. create/configure the `eigeninteractive/eigen-platform` remote;
3. migrate publishing identities, Cloudflare builds, pub.dev trusted publishers,
   secrets, branch protections, and release automation;
4. archive or redirect the three original GitHub repositories;
5. deploy a vNext Worker or publish any package.
