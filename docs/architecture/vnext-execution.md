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
- finished games and their replay/command artifacts have no automatic expiry;
- no R2 cold tier is introduced without measured need.

## Phase status

| Phase | Status | Evidence |
| --- | --- | --- |
| 0: baseline and authorization | Complete | Source commits, package versions, remotes, existing checks, and owner defaults captured |
| 1: normative contract | Complete | RFCs 0001–0008 accepted and machine-readable contract boundaries established under `contracts/` |
| 2: repository consolidation | Complete | Unsquashed imports, 52 archive branch refs, 77 tags, same-SHA docs/client wiring, root check and CI |
| 3: existing correctness defects | Complete | Timing ownership/alarm boundary, terminal absorption, gap integrity, and pending-control cleanup imported with tests |
| 4: safe mutation identity | In progress, uncommitted | First DO slice (principal-scoped command receipts) written in the `codex/phase4-command-receipts` worktree; held back by two correctness gaps, below |
| 5+: setup authority onward | Not started | Must follow accepted RFCs and add failing invariant tests first |

## Phase 4 open work

The uncommitted slice implements RFC 0004's Durable Object half: canonical
RFC 8785 fingerprints, a `(principal_id, command_id)` receipt table, a
non-destructive `legacy_commands` forward migration, and `commandConflict`. It
deliberately excludes HTTP retry policy, D1 create reservation, and the Dart
command journal.

Two gaps must close before it lands, because both are caused by the change
rather than merely uncovered by it:

1. **Alarm recovery after an atomic commit.** `#apply` commits the deadline
   inside the storage transaction and arms the alarm after it. A retry now
   returns the stored receipt before reaching that code, and receipts are
   permanent, so a deadline whose `setAlarm` was lost can never be repaired by a
   duplicate command. Invariant 12 requires repair without another player
   action. Replace the post-commit `setAlarm`/`deleteAlarm` pair with one
   idempotent `reconcileAlarm()` that compares the stored desired deadline
   against `ctx.storage.getAlarm()`, and call it on the receipt-replay path as
   well as post-commit. The cancel path already sets this precedent by
   re-running `#tearDownAborted` on replay.
2. **Authoritative game-resource binding.** `fingerprintCommand` uses the
   caller-supplied `cmd.gameId` as the receipt's `resourceId`, and
   `#ensureInit` returns early once `meta` exists without checking that the id
   it was handed is the game this object owns. Bind receipts to `meta.gameId`
   and make a mismatched id fail closed, so a receipt can never name a resource
   its Durable Object is not authoritative for.

## Current validation contract

`./tool/check.sh all` is the single baseline gate. It covers server packages,
Workers tests, schemas/migrations/Worker types, generated OpenAPI and Dart API,
package tarballs and publish dry-runs, Flutter analysis/docs/VM/browser tests,
the imported release web build, generated API docs, Docusaurus/LLM output, and
a newly scaffolded Worker plus release Android and web Flutter apps built from
the same platform checkout.

## External gates

The following require repository-owner or deployment action and are deliberately
not inferred by local implementation:

1. re-protect `main` with the required `check` context once vNext is stable. The
   owner deliberately deferred this on 2026-08-14 to remove per-change review and
   check latency; `main` accepts direct pushes and the platform check is advisory
   there. Force pushes and branch deletion remain blocked, and every release and
   publish still gates on the same check. See
   [`../operations/branch-protection.md`](../operations/branch-protection.md);
2. migrate publishing identities, Cloudflare builds, pub.dev trusted publishers,
   secrets, branch protections, and release automation;
3. archive or redirect the three original GitHub repositories;
4. deploy a vNext Worker or publish any package.
