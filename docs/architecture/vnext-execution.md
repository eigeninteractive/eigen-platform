# vNext execution status

Last updated: 2026-08-21.

This is a progress ledger, not a normative contract. The accepted RFCs are the
authority; [RFC 0009](0009-vnext-simplifications.md) supersedes the speculative
compatibility and command machinery from earlier phases.

## Current product assumptions

- There are no production games or compatibility commitments.
- Finished games are retained indefinitely and every referenced rules version
  remains installed.
- One SQLite Durable Object is authoritative for each initialized game; D1 is
  the registry and query/read model.
- TypeScript rules are authoritative. Dart twins exist for immediate UX and are
  checked with shared fixtures, but never authorize a server transition.
- Game schema versions are the contiguous prefix `1..latest` on server and
  client.
- New games always use the server's latest version. An older client must update;
  a client ahead of the deployment reports a server-update mismatch.
- There is no generic public command identity, permanent command receipt,
  capability endpoint, runtime contract digest, or durable client command
  journal.
- WebSockets authenticate with short-lived, game-scoped tickets obtained over
  authenticated HTTPS. Firebase ID tokens never appear in socket URLs.

## Completed work

| Area | Result |
| --- | --- |
| Repository | Server, Flutter client, docs, release automation, and checks live in `eigen-platform` with a generated platform inventory. |
| State authority | Durable Object transitions and SQLite state are authoritative; D1 mirrors are repaired by reconciliation. |
| Timing correctness | The prior turn's timing source determines budget charging; deadline alarms reconcile from durable state. |
| Version compatibility | Registries reject gaps, create requires exact latest, and join/read use `gameVersion <= clientLatestSchemaVersion`. `/capabilities` is removed. |
| Mutation model | Generic receipts and public `Idempotency-Key` requirements are removed. Lifecycle and membership operations rely on their operation-specific idempotence. |
| Creation policy | Versioned server rules validate player limits and timing options after parsing config. Flutter may mirror these rules for responsive UX. |
| Socket authentication | Authenticated HTTP mints a signed 60-second game ticket; upgrade verification happens before Durable Object routing. |
| Unknown game routing | Public commands and session reads prove the retained D1 row exists before deriving or waking a Durable Object. |
| Basic input bounds | Hono rejects game and bot JSON bodies above 64 KiB before auth/parsing; the server-only socket closes clients that send application messages. |
| TypeScript packaging | Public packages use one idiomatic `tsdown` build for JavaScript, declarations, JavaScript source maps, and declaration maps. Sources ship for editor navigation. |
| Dart generation | `eigen_codegen` is a separate pure-Dart development package. Its portable schema compiler enforces supported constraints and rejects unknown semantics instead of silently dropping them. |
| Dart client core | `eigen_client` is an independent publishable pure-Dart package. One configured `EigenClient` owns generated HTTP resources, repositories, socket tickets, player batching, and live-session gap recovery. Flutter supplies authentication and transport policy without importing generated API classes. |
| Firebase adapter | `eigen_flutter` exposes provider-neutral auth, token, analytics, navigation-observer, and notification ports. `eigen_firebase` owns the Firebase SDKs, Android integration, Firebase configuration CLI, and explicit telemetry policy. |
| Local checks | Server work runs once; independent Flutter, docs, and scaffold shards run concurrently afterwards. Local dependency overrides are generated ignored files. |

## Work still to do

1. Complete the remaining Flutter dependency split described by RFC 0009:
   make `eigen_flutter` the embeddable presentation package and move the
   complete product into `eigen_shell`.
2. Finish generated API/docs synchronization, release notes, and publish-order
   automation for the new package graph.
3. Run every workspace shard and both scaffold targets from a clean checkout,
   then release the breaking pre-1.0 package lines in dependency order.

## Deliberately deferred

- automatic deletion or cold storage of finished games;
- sparse schema-version retirement;
- exact historical response-byte replay;
- contract digests;
- generic resource-budget abstractions;
- durable offline command queues; and
- automatic retries for ambiguous game creation.

Each deferred item needs a measured product requirement or incident before it
adds runtime state or protocol surface.
