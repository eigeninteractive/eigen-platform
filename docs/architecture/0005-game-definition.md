# 0005: authoritative game definition and creation policy

- Status: accepted
- Date: 2026-08-13

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

## Contract identity

Generation produces a manifest conforming to
[`game-contract.schema.json`](../../contracts/game/v1/game-contract.schema.json).
Its ID is:

```text
<gameKey>/v<gameVersion>/sha256:<canonical-manifest-digest>
```

The digest covers the manifest without `$schema` and `contractId`, using RFC
8785 canonical JSON. Any schema, creation policy, required capability, payload
descriptor, or visibility change creates a different contract ID. A rules-only
bug fix that is wire/behavior compatible still produces a new platform release;
whether it creates a new game version is an explicit game-author decision.

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
