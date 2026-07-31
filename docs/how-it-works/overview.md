---
sidebar_position: 1
title: What the engine is
description: The single principle the whole system is built around, and the three properties that fall out of it.
---

# What the engine is

Eigen is a **whitelabel, server-authoritative, turn-based multiplayer game
engine**. One codebase runs many games; each deployment is a single Cloudflare
Worker that owns its own domain, database, and players.

An Eigen game is a sequence of **versioned, server-authoritative transitions**.
The server — never the client — decides what each move does, whose turn it is,
what each player is allowed to see, when a clock expires, and how a finished
game is rated. Clients render state and submit intents; they hold no authority.

The design centre is a single principle:

> **Each game is one serialized state machine with one owner.**

That owner is a Cloudflare Durable Object (DO). One DO per game, addressed by
the game's id, is the authoritative session *and* the game's permanent history.
Everything else — the API, the global database, push, avatars — orbits that.

## Three properties fall out of it

- **Server authority.** The rules run on the server. A client's move is a
  *proposal*; the DO validates it against the true state and either commits it
  as the next version or rejects it. Hidden information never leaves the DO
  except as a per-seat projection.
- **Strong per-game consistency.** A DO processes its commands one at a time
  under an input gate. There are no lost updates, no torn writes, no
  distributed-lock dance — the platform serializes access to each game for us.
- **Determinism & replayability.** State is a pure function of `(base seed,
  ordered action log)`. The action log is append-only and immutable; replaying
  it reproduces the game exactly. This is what makes [history](./storage.md),
  reconnection, and the client's optimistic preview all sound.

## Non-goals

The engine is not a real-time (sub-second, physics) engine, not a lobby
matchmaker with skill-based queues (games are created and shared, or played vs
bots), and not a general document store. It is tuned for **turn-based games
where correctness and fair timing matter more than raw throughput.**

## The platform, and why each piece

Everything runs on Cloudflare's developer platform. The inventory is
deliberately small, and the required day-0 path uses **only free-tier services
with no payment method**.

| Concern | Service | Role |
|---|---|---|
| API + web host | **Workers** (hono + `@hono/zod-openapi`) | Stateless request handling, auth, policy, routing; also serves the app-link files and share pages |
| Authoritative game session | **Durable Objects** (SQLite-backed) | One per game — live and finished. The serialized state machine and the permanent per-game history |
| Global cross-game store | **D1** (SQLite) | Identity, social, bots, ratings, and game *summaries* — a read-model + registry, never an arbiter |
| Avatars (opt-in) | **R2** | User-uploaded avatar objects; developed under local simulation, a real bucket only at deploy |
| Auth | **Firebase Auth**, verified in-worker with **jose** | Google / Apple / Anonymous sign-in; the worker verifies ID tokens itself |
| Push | **FCM HTTP v1** | Turn / finish notifications; permission remains player-controlled |

Why these and not the obvious alternatives:

- **Durable Objects, not a shared SQL row + locks.** The classic
  turn-based-game bug is two writers racing on one game row (two finishes, two
  moves at the same version). A DO makes that structurally impossible: the
  platform routes every request for a given game id to the same single-threaded
  object, and its input gate serializes them. The old lost-update bugs simply
  cannot be expressed.
- **DO SQLite is also the history store.** A finished game's DO keeps its
  transition log forever. There is no separate "archive write at finish" — the
  DO *is* the archive. Replaying a game years later just wakes its DO. (A
  future cold tier can sweep very old games to R2; see [Data & storage](./storage.md).)
- **D1 is a read-model, never the source of truth for live play.** Lobbies,
  "my games", leaderboards, and profiles read D1. It is updated *from* DO
  effects after a command commits, and it is allowed to be briefly stale
  (a lobby may show a game that just filled). It never arbitrates a move.
- **KV is intentionally absent.** Its design centre is edge-cached hot reads —
  the opposite of authoritative serialized writes (that's the DO) and
  write-once cold history (that's DO SQLite / R2).
- **jose, not a Firebase SDK.** Verifying a Firebase ID token is ~40 lines of
  standard JWT verification against Google's JWKS. jose is a maintained,
  platform-native library; the engine keeps the whole auth surface in view.

## Cost & scaling posture

The free-tier binder is DO SQLite + D1. The first ceiling is DO storage writes
(~100k rows/day ≈ ~1,400 games/day). Crossing it is a one-click plan upgrade
with **zero code change** — no architecture in these documents assumes the paid
tier. R2 remains an optional paid-service integration for avatars. FCM shares
the Firebase project already required by Auth and is a no-cost Firebase product;
the infrastructure is always configured even though players may decline
notification permission.
