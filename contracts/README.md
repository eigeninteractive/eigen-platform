# EigenInteractive contracts

This directory is the machine-readable normative input for vNext. Versioned
subdirectories are immutable once released. Generated OpenAPI, TypeScript/Dart
models, clients, examples, and reference documentation will derive from these
schemas rather than restating them independently.

- `protocol/v1/`: transport-neutral capability, command, error, and session
  envelopes;
- `game/v1/`: portable generated game-contract manifest;
- `examples/`: valid examples used by the contract checker and future
  generators.

Run `node tool/check-contracts.mjs` from the repository root. Contract IDs use
the canonicalization/digest rules in RFC 0005 and RFC 0006.
