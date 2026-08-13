# Maintaining the server packages

Registry configuration, release operations, approval points, verification, and
failure recovery are owned once for the monorepo in
[`../docs/operations/releases.md`](../docs/operations/releases.md).

Server-specific package changes still use Changesets from this directory:

```bash
pnpm changeset
```

The four engine packages are a fixed group; `create-eigen-game` versions
independently; the generated `clients/dart` package follows the engine version.
Do not publish any of them directly except as an explicitly documented recovery
operation.
