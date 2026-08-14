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
| 4: safe mutation identity | Server done | Receipts, canonical requests, derived alarm, and a required `Idempotency-Key` on every mutation; D1 create receipts and the client journal open, below |
| 5+: setup authority onward | Not started | Must follow accepted RFCs and add failing invariant tests first |

## Phase 4 remaining work

The Durable Object half of RFC 0004 is implemented and tested. What remains, in
dependency order, is what makes it load-bearing rather than latent:

1. **Require `commandId` on the wire.** It is still optional, and a route mints
   one when it is absent, so a caller that omits it gets a fresh id per attempt
   and no idempotency at all. This is also where the transport is chosen: a body
   field as today, or the `Idempotency-Key` header the IETF draft and every
   payments API use. Deciding it moves OpenAPI and the generated Dart client, so
   it is one atomic change with them.
2. **D1 create receipts.** Creation has no Durable Object yet, so a duplicate
   create currently makes a second game. A uniqueness record keyed by
   `(user_id, command_id)` in the same batch as the game row fixes it.
3. **Client command journal.** Ids minted and persisted before first dispatch,
   surviving process restart, with definitive and ambiguous outcomes
   distinguished.
4. **Only then**, bounded same-id retry of retryable Worker-to-DO faults. Retries
   before the three items above are what RFC 0004 exists to prevent.

## Decisions taken while implementing

- **Canonical requests are stored, not hashed.** A digest would have saved a few
  bytes beside a receipt already holding a session snapshot, in exchange for a
  Web Crypto await inside the object's read-then-write critical section. RFC 0004
  is amended accordingly.
- **Canonicalization is the `canonicalize` package**, RFC 8785's own reference
  JavaScript implementation, replacing a hand-written canonicalizer.
- **The alarm is derived from committed state, not tracked beside it.** The
  review handoff proposed a desired-deadline column plus a generation counter;
  neither is needed, because an active game's committed deadline already *is* the
  desired alarm. One reconciler is the normal path and the whole recovery path.
- **System commands write no receipts.** A deadline timeout is idempotent through
  the kernel's abstain, which survives a lost schedule and a redeployment, where
  a stored row only survives storage.
- **Cancel's D1 mirror is a background read-model write.** It was awaited, and
  allowed to fail the command, only because the old teardown dropped all DO
  storage and left the D1 row as the sole survivor. Retaining `meta` removed that
  premise.
- **The command id travels as the standard `Idempotency-Key` header**, not a body
  field, and is required on every mutation including the ones that do not yet
  honour it. A client should not have to know which mutations deduplicate. The
  header also separates identity from payload, which is what lets the canonical
  request be built purely from the caller's intent.
- **`commandConflict` is a 422, not a 409.** Every other 409 in this API means
  "resync and retry", which is precisely what must not happen to a reused key.
  The `Idempotency-Key` specification draws the same line.
- **Dropped the empty `LobbyCommand` body.** With the id in a header, leave,
  cancel and start carry nothing, so requiring an empty JSON object was pure
  ceremony.

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
