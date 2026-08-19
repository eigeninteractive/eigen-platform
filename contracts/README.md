# EigenInteractive contracts

Machine-readable normative input that is **not** derivable from code.

- `game/v1/`: the portable per-version game-contract manifest schema, including
  the `contractId` digest rule;
- `examples/`: valid examples the contract checker verifies.

Run `node tool/check-contracts.mjs` from the repository root. Contract IDs use
the canonicalization/digest rules in RFC 0005 and RFC 0006.

## What is not here

The wire protocol. HTTP requests, responses, and error bodies are defined by the
Zod schemas in `server/packages/server/src/routes/wire.ts` and published as
generated OpenAPI 3.1 (`server/packages/server/openapi.json`), which *is* JSON
Schema — so a second hand-written description would be a copy that nothing
verifies. WebSocket frames are the same `Session` shape, published in the same
document.

This directory once held `protocol/v1/` envelopes for commands, problems,
capabilities, and session events. Nothing generated from them or validated
against them, and all four drifted out of agreement with the shipped protocol
before they were deleted; see RFC 0003's implementation notes.

## What belongs here

A normative artifact with no generator, where the schema *is* the source. The
game-contract manifest qualifies for now: it describes a format two languages
must agree on, and no producer emits it yet. Anything the server already defines
in code belongs in the generated output instead.
