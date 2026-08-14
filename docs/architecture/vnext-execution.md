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
| 4: safe mutation identity | Nearly complete | Receipts, canonical requests, derived alarm, a required `Idempotency-Key` on every game mutation, and D1 create reservations; only bounded Worker-to-DO retry is open, below |
| 5+: setup authority onward | Not started | Must follow accepted RFCs and add failing invariant tests first |

## Phase 4 remaining work

Every authority that commits a mutation now holds a receipt for it, and the key
is required on the wire, so the mechanism is load-bearing rather than latent.
What remains:

1. **Bounded same-id retry of retryable Worker-to-DO faults.** The transport-level
   retry in the Flutter client is done — a keyed mutation whose failure carried no
   response is replayed with the same key, which the server answers from its
   receipt. Retrying a fault *inside* the worker, between it and the Durable
   Object, is separate and still open.

The client command journal specified in RFC 0004 is **not being built**; the
reasoning is recorded under "Decisions taken while implementing" and in RFC 0004's
delivery section. RFC 0004 itself is amended, not silently diverged from.

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
  field, and is required on every game mutation. A client should not have to know
  which mutations deduplicate. The header also separates identity from payload,
  which is what lets the canonical request be built purely from the caller's
  intent. Account, social and device mutations do not require it: they are
  set-like operations whose repetition is already harmless, so a receipt would add
  a row and a failure mode to buy nothing.
- **`commandConflict` is a 422, not a 409.** Every other 409 in this API means
  "resync and retry", which is precisely what must not happen to a reused key.
  The `Idempotency-Key` specification draws the same line.
- **Dropped the empty `LobbyCommand` body.** With the id in a header, leave,
  cancel and start carry nothing, so requiring an empty JSON object was pure
  ceremony.
- **A create reservation records what was created, not what was returned.** It has
  to be written in the same D1 batch as the `games` row — that transaction is the
  whole guarantee — and the response is not known yet, because create-solo starts
  the game afterwards. So a replay re-derives its answer by resuming the remaining
  steps idempotently, which as a side effect recovers a create whose process died
  before the start landed. Storing the response instead would have needed a second
  write, and a crash between the two would lose the reservation entirely: exactly
  the duplicate it exists to prevent.
- **Create-solo's internal start uses a key derived from the caller's, not a fresh
  one.** Reusing the key outright would let one id stand for two operations, which
  receipts refuse. But minting a fresh one made that half unreplayable, so a retry
  would try to start an already-running game. A derived id (`<key>:start`) is a
  distinct id that is also reproducible, which is what makes the compound
  operation idempotent as a whole.
- **No durable client command journal.** RFC 0004 specified one, and it is the
  standard pattern (Replicache mutation ids, PowerSync's CRUD queue, Brick's
  offline queue). It is not being built, because its value does not survive
  contact with this product: a game action carries a deadline the kernel refuses
  once passed, so replaying a stale one mostly defers a rejection; the board is
  authoritative and visible on reconnect, so "did my move land?" is answered by
  looking; and duplicate suppression is already server-side, now including create.
  The two parts of the specified item that *did* pay for themselves are done
  instead — outcome classification in `engineCall`, and a same-key transport retry
  — for roughly one predicate rather than a persistence layer. The trigger to
  revisit is a deadline-free intent whose loss a player would notice.

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
