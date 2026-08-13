# EigenInteractive vNext architecture

These records are the normative design input for vNext. Runtime code is not a
substitute for them: if implementation and an accepted record disagree, either
the implementation is wrong or the record must be superseded explicitly.

| Record | Status | Subject |
| --- | --- | --- |
| [0000](0000-monorepo-import.md) | Accepted | History-preserving monorepo import |
| [0001](0001-product-and-modules.md) | Accepted | Product scope and module boundaries |
| [0002](0002-platform-invariants.md) | Accepted | Non-negotiable platform invariants |
| [0003](0003-protocol-and-capabilities.md) | Accepted | Protocol envelopes, errors, and capabilities |
| [0004](0004-command-identity.md) | Accepted | Mutation identity and canonical fingerprints |
| [0005](0005-game-definition.md) | Accepted | Authoritative game definition and creation policy |
| [0006](0006-portable-schema-profile.md) | Accepted | Portable JSON Schema profile |
| [0007](0007-replay-retention-privacy.md) | Accepted | Replay fidelity, retention, and privacy |
| [0008](0008-client-coordinator.md) | Accepted | Serialized client coordinator |

The machine-readable contract starts under [`contracts/`](../../contracts/).
[`vnext-execution.md`](vnext-execution.md) records delivery status and gates.

## Status meanings

- **Proposed**: concrete enough to review, but not authority for a destructive
  or externally visible implementation.
- **Accepted**: the implementation must conform or replace the record with a
  new accepted decision.
- **Superseded**: retained for history; its replacement is named at the top.

Records use normative words (`MUST`, `SHOULD`, `MAY`) as requirements, not as
general emphasis.
