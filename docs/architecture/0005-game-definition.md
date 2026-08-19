# 0005: authoritative game definition and creation policy

- Status: accepted
- Date: 2026-08-13
- Amended: 2026-08-19. The player-count policy shipped, and the digested
  per-version manifest is deliberately not built — see "Contract identity" and
  "Implementation notes".

## Decision

A game ships one TypeScript registry. Each create-enabled version unit owns:

- portable config, state, action, and observation schemas;
- initial state, authoritative transition, and per-seat observation projection;
- server-side player-count policy derived from validated config;
- allowed access modes, timing modes/bounds, bot policy, and rating-pool policy;
- required protocol features and renderer descriptor key; and
- immutable fixtures/conformance metadata.

TypeScript is the only business-rule authority. Dart receives generated types,
codecs, validators, presentation descriptors, and optional prediction helpers.
It does not implement mandatory validity, player-count, bot, or rating policy.

## Contract identity — not built; kept as a rule to build against

A version integer is a promise a person makes. A digest is a fact a machine
computes. If a game's v3 rules change without the author bumping to v4, both sides
still say `3` and silently disagree about what `3` means; a digest over the
generated manifest changes and the mismatch is detectable.

Should that become worth building, the identity is:

```text
<gameKey>/v<gameVersion>/sha256:<canonical-manifest-digest>
```

The digest covers a per-version manifest without its `$schema` and `contractId`,
using RFC 8785 canonical JSON (object keys ordered by UTF-16 code unit — *not*
`localeCompare`, which collates capitalized `$defs` names differently and would
make two conforming implementations disagree). Any schema, creation policy,
required capability, payload descriptor, or visibility change creates a different
contract ID. A rules-only bug fix that is wire/behavior compatible still produces
a new platform release; whether it creates a new game version is an explicit
game-author decision.

**Why it is not built.** The generated `game-contract.json` that actually feeds the
Dart generator holds all versions in one file and carries no digest. The
per-version digested manifest this record originally specified lived under
`contracts/game/v1/` as a JSON Schema with one hand-written example, no producer,
and no consumer — the same condition that let the protocol schemas in RFC 0003 rot
into being wrong. It is deleted; the rule survives here, where design intent
belongs.

What the digest would add is narrower than it first appears: the drift check
already forces a deployment's committed contract to match its own rules, and a
missing version bump is a code review away. The uncovered case is a *shipped app*
built against stale rules for a version integer that still exists. Build this when
that case actually bites, against a real incident rather than a hypothetical.

## Creation flow

1. Client advertises exact supported contracts.
2. Server selects a create-enabled contract from the intersection.
3. Client submits contract ID, access, config, timing-mode choice, and command ID.
4. Server resolves the installed registry by exact contract ID.
5. Server validates portable schemas and invokes authoritative creation policy.
6. The policy derives minimum/maximum seats, timing, bot eligibility, and rating
   pool; caller-supplied derived values do not exist.
7. D1 records discoverability only after the authoritative game is initialized.

Joining and bot seating repeat exact contract/capability checks. A manifest that
supports v4 but not v2 is never accepted for v2.

## Version lifecycle

Each installed contract is independently marked:

| State | New create | Join/reconnect | Replay read |
| --- | --- | --- | --- |
| `create` | yes | yes | yes |
| `readable` | no | yes for existing game | yes |
| `replayOnly` | no | no live seating | yes |
| `retired` | no | no | only after retained artifacts no longer require code |

Retirement is sparse and explicit. The server never derives it from the highest
version. A game row stores exact contract ID, not just an integer.

## Generated client boundary

The generator emits a registration object per contract containing typed codecs,
constraint-preserving validators, renderer key, and feature requirements. Game
widgets receive typed config/observation/action values and submit through the
generated action serializer. Raw `Map<String, Object?>` casts are not part of
the renderer API.

Optional prediction accepts a typed observation and action and returns either a
typed predicted observation or `null`. Returning `null` means no prediction; it
does not waive server conformance or create a second source of validity.

## Migration sketch

- D1 games: add exact `contract_id` and creation-policy output; backfill from the
  currently installed registry before making it required.
- DO meta: add exact contract ID and policy snapshot/digest.
- API/OpenAPI: replace client-supplied min/max seats with derived response data.
- Flutter: replace maximum-schema handshake with an exact contract set.
- Bots: store and advertise exact supported contract IDs.

## Implementation notes (2026-08-19)

**Seat policy shipped as `GameRules.playerLimits`.** "Server-side player-count
policy derived from validated config" is implemented: the hook returns the seats a
config may be played with, creation derives them, and the caller's
`minPlayers`/`maxPlayers` became optional assertions validated against the derived
bounds (422 on a range outside them). This closes the seat case of "caller-supplied
derived values do not exist" below; timing and rating pool were already derived.

One deliberate softening of that rule: a caller may still **narrow** the range for
one lobby, because a preference inside what the rules can play is a genuine choice
and cannot make a game unrepresentable. Only widening is refused.
