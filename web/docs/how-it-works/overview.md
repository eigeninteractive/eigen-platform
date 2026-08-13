---
sidebar_position: 1
title: What the engine is
description: The single principle the whole system is built around, and the three properties that fall out of it.
---

# What the engine is

EigenInteractive is a **whitelabel, server-authoritative, turn-based multiplayer
game
engine**. Your game deploys as a single Cloudflare Worker that owns its own
domain, database, and players.

An EigenInteractive game is a sequence of **versioned, server-authoritative
transitions**.
The server, never the client, decides what each move does, whose turn it is,
what each player is allowed to see, when a clock expires, and how a finished
game is rated. Clients render state and submit intents; they hold no authority.

The design centre is a single principle:

> **Each game is one serialized state machine with one owner.**

That owner is a Cloudflare Durable Object (DO). One DO per game, addressed by
the game's id, is the authoritative session *and* the game's permanent history.
Everything else (the API, the global database, push, avatars) orbits that.

## The game model

Four nouns carry the whole system. Three of them are yours to define; the fourth
is the engine's.

| | What it is | Who defines its shape |
|---|---|---|
| **State** | Everything true about the game right now: board, deck, scores, fog. One JSON payload | You |
| **Action** | What a player proposes: "play the 7", "resign". A request, not a fact | You |
| **Observation** | What *one seat* is allowed to see of the state. Derived, never stored | You |
| **Transition** | One committed step: state at version *N* becomes version *N+1* | The engine |

State is **opaque** to the engine. It stores and versions your payload but never
looks inside it, and it holds *only* your game. Whose turn it is, the deadline,
the roster and the result are engine-owned and live outside it. That boundary is
why you never write persistence code.

The loop is one line long:

> A player submits an **action**. The engine checks everything that is not about
> your game (the right seat, the right version, inside the deadline) then calls
> your `applyAction`, which returns the next **state**. The engine commits it as
> a new **transition**, projects one **observation** per seat, and sends each
> player only their own.

Two consequences worth internalising early:

- **Hidden information is a property of `computeObservation`, not of storage.**
  A face-down card is in the state; it is simply absent from the observation of
  every seat that may not see it. Nothing hidden is ever sent and then hidden in
  the UI.
- **A version is a fact, not a suggestion.** A client submits against the version
  it last saw. If the game has moved on, the action is normally rejected, unless
  the acting seat's observation is unchanged between the two versions, which is
  precisely what makes simultaneous moves work. See [The game
  lifecycle](./lifecycle.md).

Randomness comes from an engine-supplied `rng`, not from `Math.random()`, so a
game is a pure function of its seed and its ordered actions. That is what makes
replay, reconnection and optimistic preview all sound at once.

## Server and client

They are one game written twice, with an unequal split of authority.

| | Server (TypeScript, in the Worker) | Client (Dart, in the app) |
|---|---|---|
| Decides a move's legality | **Yes**, the only answer that counts | Guesses, to grey out a button |
| Holds full state | Yes | Never; only this seat's observation |
| Owns turn order, clocks, results | Yes | Displays them |
| Draws the board | No | Yes |

The client keeps a **rules twin**: a Dart transcription of just enough of the
rules to answer "is this tappable?" and "what would this look like?" before the
server replies. It exists for latency, not for truth: the board can move
immediately, and reconciles when the real transition arrives. When the two
disagree the server wins, silently and always.

Keeping the twin honest is a test, not a discipline: shared JSON fixtures run
against both halves and fail if they diverge. See [Testing](../build-a-game/testing.md).

The transport is one WebSocket per game, held open for its whole lifetime,
carrying one frame per transition: a single seat's observation at a single
version. Frames are strictly serial, so a client always knows whether it is
current: opening cold mid-game snaps straight to the present, while a client
that missed a span fetches exactly that span and animates through it. It
reconciles against a version the server states, never one it guesses. See
[Transport](./transport.md).

## Three properties fall out of it

- **Server authority.** The rules run on the server. A client's move is a
  *proposal*; the DO validates it against the true state and either commits it
  as the next version or rejects it. Hidden information never leaves the DO
  except as a per-seat projection.
- **Strong per-game consistency.** A DO processes its commands one at a time
  under an input gate. There are no lost updates, no torn writes, no
  distributed-lock dance. The platform serializes access to each game.
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
| Authoritative game session | **Durable Objects** (SQLite-backed) | One per game, live and finished. The serialized state machine and the permanent per-game history |
| Global cross-game store | **D1** (SQLite) | Identity, social, bots, ratings, and game *summaries*: a read-model + registry, never an arbiter |
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
  transition log forever. There is no separate "archive write at finish"; the
  DO *is* the archive. Replaying a game years later just wakes its DO. (A
  future cold tier can sweep very old games to R2; see [Data & storage](./storage.md).)
- **D1 is a read-model, never the source of truth for live play.** Lobbies,
  "my games", leaderboards, and profiles read D1. It is updated *from* DO
  effects after a command commits, and it is allowed to be briefly stale
  (a lobby may show a game that just filled). It never arbitrates a move.
- **KV is intentionally absent.** Its design centre is edge-cached hot reads,
  the opposite of authoritative serialized writes (that's the DO) and
  write-once cold history (that's DO SQLite / R2).
- **jose, not a Firebase SDK.** Verifying a Firebase ID token is ~40 lines of
  standard JWT verification against Google's JWKS. jose is a maintained,
  platform-native library; the engine keeps the whole auth surface in view.

## Cost & scaling posture

The free-tier binder is DO SQLite + D1. The first ceiling is DO storage writes
(~100k rows/day ≈ ~1,400 games/day). Crossing it is a one-click plan upgrade
with **zero code change**, and no architecture in these documents assumes the paid
tier. R2 remains an optional paid-service integration for avatars. FCM shares
the Firebase project already required by Auth and is a no-cost Firebase product;
the infrastructure is always configured even though players may decline
notification permission.
