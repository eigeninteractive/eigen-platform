# 0002: non-negotiable platform invariants

- Status: accepted
- Date: 2026-08-13

## Authority

1. Exactly one SQLite Durable Object serializes and commits a game's live state.
2. D1 is a discoverable registry/read model updated after authoritative commit.
3. TypeScript rules are authoritative. Client prediction never decides validity.
4. Creation constraints and game/version availability are server-enforced.
5. Time and randomness are explicit commit inputs, sampled once by the host.

## Mutation correctness

1. Every mutation carries a stable client-created command ID.
2. One command ID maps to one authorization-scoped canonical fingerprint.
3. Same ID and fingerprint return the canonical prior result; same ID and a
   different fingerprint fail without executing.
4. A client never invents a new ID while the outcome of the prior attempt is
   unknown.
5. A success is not reported until the authoritative transaction commits.

## Game consistency and recovery

1. A transition, its timing charge, next deadline, effects, and exact delivered
   observations derive from one committed version.
2. Current-turn chargeability is stored with that turn; a future transition
   cannot reinterpret it.
3. Alarm, retry, and finish recovery are closed loops: persisted work remains
   discoverable and is re-poked until done or operator-visible.
4. Post-commit effects are idempotent and classified by delivery guarantees.

## Client convergence

1. HTTP responses, socket sessions, recovery reads, and cache hydration enter
   one serialized per-game coordinator.
2. Complete sessions are applied monotonically; gaps are validated before any
   partial advancement.
3. Terminal lifecycle is absorbing except for a newer terminal enrichment.
4. Unsupported protocol features or game contracts become an explicit
   update-required state, never a decode crash or best-effort guess.
5. Pending controls always resolve to committed, rejected, unknown, or safely
   retrying; early returns cannot leave them latched.

## Contracts and history

1. Capability support is an exact set, not a maximum version integer.
2. Generated artifacts name their profile/generator version and contract digest.
3. Unsupported schema constructs fail generation; constraints are never dropped.
4. Replay bytes do not depend on running mutable historic projection code.
5. Protocol, client, examples, docs, and tested release manifest come from one
   repository revision.

## Security and operations

1. Long-lived bearer credentials do not appear in URLs or routine logs.
2. Unknown external IDs are rejected before avoidable Durable Object allocation.
3. Product limits are smaller, explicit, testable bounds—not Cloudflare maxima.
4. Structured logs identify request, command, game, transition, contract, and
   outcome without logging private game payloads or tokens.
5. Every persistent format has a forward migration, compatibility window, and
   rollback statement before deployment.

Each semantic pull request MUST name the invariants it changes or proves and add
tests at the failure boundary, not merely at a helper boundary.
