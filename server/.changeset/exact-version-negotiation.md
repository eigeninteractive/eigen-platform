---
"@eigeninteractive/server": minor
---

Check schema-version support exactly, and move creation authority to the server.

**Breaking.** `Join` and `JoinByCode` replace `clientSchemaVersion: number` with
`clientSchemaVersions: number[]`, the full set of versions the client build ships.

The old field was a maximum, compared as `game.schemaVersion <= clientMaximum`.
That is not a compatibility test: `GameModule.versions` is deliberately sparse — a
build may ship `{1, 3}` once v2 has drained — so the comparison seated a `{1, 3}`
client into a v2 game whose frames it cannot decode. The server now tests exact
membership, before a seat is created.

**Creation is the server's decision.** New games may only be created at the
deployment's highest shipped version. A create asserting any other version is
refused with `409 schemaUnsupported`, which clients already surface as "update
your app". Previously the client's own newest version decided, so an app could
race ahead of a server that could not run that version, and an old app could keep
creating a version the operator had retired. An unshipped version now answers
`schemaUnsupported` rather than a bare 400, matching the join gate.

`EngineConfig.creatableSchemaVersions` overrides the default for the two cases it
cannot express: rolling creation back after a bad rules release without
unshipping the version that games already exist at, and a deployment whose
`versions` are parallel variants rather than an upgrade sequence. Listing several
does not make clients negotiate — a client always creates at the newest version it
ships, and this decides whether that is allowed. A configured version the
deployment does not ship fails at startup rather than at a player's first create.

**New:** `GET /api/engine/capabilities` publishes `creatableSchemaVersions` and
`supportedSchemaVersions`, so a client can tell whether it is compatible before
trying. Nothing is required to read it: the refusal path carries the same
information, and a stale client that ignores it behaves exactly as it does now.
