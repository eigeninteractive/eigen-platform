# 0001: product scope and module boundaries

- Status: accepted
- Date: 2026-08-13

## Decision

EigenInteractive vNext is a toolkit for independently owned, turn-based game
applications. A game project owns its rules, branding, deployment, users, and
data. The platform supplies deterministic arbitration, transport, generated
contracts, client convergence, reference UI adapters, testing, and operations.

It is not a shared game marketplace, a general realtime database, a chat
service, a physics engine, or an authoritative simulator for continuous-time
games.

## Supported game class

A supported game has bounded JSON configuration/state/actions, a finite seat
roster, deterministic transitions given explicit randomness and time, and
complete observations that can be projected per seat. Turns may be sequential
or simultaneous; games may use per-turn deadlines, cumulative budgets, bots,
teams, hidden information, and replay.

## Module graph

Dependencies point downward only:

```text
game project
  -> optional app shell / Firebase adapter
  -> Flutter adapter
  -> pure Dart client coordinator + generated protocol
  -> protocol and game-contract schemas

game Worker
  -> server host
  -> kernel
  -> authoritative TypeScript rules
  -> protocol and game-contract schemas
```

The target logical modules are:

| Module | Owns | Must not depend on |
| --- | --- | --- |
| Protocol | envelopes, errors, capabilities, command identity, canonical JSON | Cloudflare, Flutter, Firebase, a game |
| TypeScript rules | schemas, transitions, projection, creation policy | server storage/transport |
| Kernel | pure commit model, time, randomness, effects | Cloudflare bindings |
| Server host | HTTP/socket/auth interfaces and persistence ports | a concrete game UI |
| Cloudflare adapter | Worker, Durable Object, D1, R2-if-ever-needed | Flutter |
| Generated Dart protocol | wire DTOs/codecs/validators | Flutter, Riverpod, Firebase |
| Pure Dart client | transport ports, coordinator, cache model | Flutter, Riverpod, Firebase |
| Flutter adapter | Riverpod/widgets/navigation integration points | Firebase unless using its adapter |
| Firebase adapter | Firebase auth, messaging, analytics implementations | game rules |
| Optional shell | opinionated product screens and flows | authoritative business rules |
| Generator/testkit | contracts, fixtures, scaffolding and conformance | production credentials |

Logical separation precedes package proliferation. Modules MAY publish together
until an independent consumer requires a stable package boundary, but forbidden
dependencies are enforced from the start.

## Repository layout direction

The imported `server/`, `flutter/`, and `web/` prefixes stay until the baseline
is stable. Extraction then follows dependency order: protocol, generated Dart,
pure Dart coordinator, Flutter adapter, Firebase adapter, optional shell, and
development generator. Package names and public APIs change only in semantic
work packages with migration notes.

## Local-first requirement

A generated game MUST reach a playable local move without Firebase, a
Cloudflare account, or production credentials. Production adapters fail only
their enabled capability; they do not prevent unrelated local play.
