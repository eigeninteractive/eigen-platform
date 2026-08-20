# 0009: vNext compatibility and correctness simplifications

- Status: accepted
- Date: 2026-08-20
- Supersedes: the exact-set capability rules in 0002, 0003, and 0005; generic
  durable command receipts in 0002, 0004, and 0008; exact-frame replay in 0002
  and 0007; and the speculative contract-digest rules in 0002, 0005, and 0006

## Context

Eigen has no production games or compatibility commitments yet. The platform
should optimize for a small, correct model rather than preserve mechanisms that
were added for possible future rollout, offline, or storage requirements.

## Game version compatibility

Game schema versions are positive, contiguous integers beginning at 1. Once a
version is published it remains installed in both the server registry and the
client bundle while any retained game may reference it. Registries fail fast at
startup or generation time if a prefix has a gap.

The only client capability value is `latestSchemaVersion` for the game:

- creating a game requires `clientLatestSchemaVersion === serverLatestSchemaVersion`;
- joining, reconnecting to, or reading an existing game requires
  `gameSchemaVersion <= clientLatestSchemaVersion`; and
- a client below the required version receives `clientUpdateRequired`, while a
  client ahead of the deployment receives `serverUpdateRequired`.

The server does not publish a capabilities endpoint or a create-version
override. New games always use the latest installed version. Sparse retirement
is deliberately unsupported. If deletion or retention policy later makes old
versions removable, this decision must be revisited before removing code.

## Mutation correctness without generic receipts

The public protocol has no universal `Idempotency-Key`, command fingerprint,
command receipt, or command-status resource. Correctness belongs to each
operation:

- actions carry the authoritative game version they were based on and stale
  actions are rejected;
- join and leave express a desired membership state;
- start and cancel are idempotent lifecycle transitions;
- bot seating is guarded by the lobby version it was chosen from; and
- creation may have an ambiguous network outcome. At this stage the user may
  resynchronize and create again rather than the platform retaining a permanent
  receipt for every attempted game.

The client does not durably queue commands. It serializes incoming authoritative
sessions, prevents concurrent local intents where needed, and reloads the game
after an ambiguous transport result. Internal delivery work such as an
authoritative Durable Object transition being reflected into D1 may still use
an outbox or operation-specific idempotence; that is not a public command
receipt system.

## Replay and contract identity

The game author must never change the meaning of a published game version.
Behavioral changes require a new integer version. CI regenerates the committed
contract and rejects drift, but the runtime does not compute or negotiate a
contract digest.

Replay retains authoritative states, actions, causes, versions, and timestamps.
It projects observations through the installed rules for the stored schema
version. Exact historical response bytes and exact per-seat frame storage are
not engine requirements. Because finished games are retained indefinitely for
now, every referenced rules version remains installed.

## Package boundaries

`@eigeninteractive/kernel` remains a supported public package. Public does not
mean platform-coupled: it remains a pure decision core without Cloudflare or
application dependencies.

The Dart side is split by dependency direction:

- `eigen_client`: pure Dart protocol, domain, session coordination, and
  transport ports;
- `eigen_codegen`: development-only game contract generation;
- `eigen_flutter`: Flutter presentation and transport adapters;
- `eigen_firebase`: optional Firebase auth and messaging adapters; and
- `eigen_shell`: the complete first-party application.

The generated `eigen_api` package is an implementation dependency rather than
the application architecture boundary.

## Server authority

Each version's TypeScript rules own the complete creation policy after config
validation: player limits, allowed timing modes and bounds, access modes, bot
eligibility, and rating-pool policy. Flutter may duplicate ranges, presets, and
labels for immediate UX feedback, but a disagreement is resolved by the server
and returned as a typed validation error.

Long-lived Firebase credentials never appear in a WebSocket URL. An
authenticated HTTP request obtains a short-lived, game-scoped socket ticket;
the upgrade verifies that ticket before reaching the game's Durable Object.

## Deferred work

The initial platform does not add generic resource budgets, automatic finished
game deletion, cold storage, exact replay artifacts, contract digests, sparse
version retirement, or durable offline commands. Basic request/frame size
bounds and rejection of unknown game IDs before Durable Object allocation are
still correctness and abuse-prevention requirements.
