---
sidebar_position: 2
title: Shape of the system
description: Four packages split by trust and purity, one Worker with three request spaces, and the path a single move takes through them.
---

# Shape of the system

## Four packages

The server is a small pnpm monorepo. The split is by **trust and purity**, not
by feature:

```text
@eigen/rules    The implementor contract: GameRules, GameModule, the six hooks,
                the JSON/Envelope/Observation types. Pure types + 2 helpers.
                Zero engine dependencies — a game author reads only this.

@eigen/kernel   The pure decision core. Given (game, state, roster, intent, now)
                it returns a commit plan or a rejection. No I/O, no platform
                APIs, fully unit-testable. Owns timing/grace, the same-view rule,
                observation fan-out, RNG derivation, and the rating math.

@eigen/server   Everything that deploys: the BaseGameDO class, the hono routes,
                the D1 schema + appliers, auth, bots, push, the createEngine
                factory. This is the only package an implementor's Worker imports
                at runtime (plus their own @eigen/rules game module).

@eigen/testkit  Shared conformance fixtures + kernel scenarios, run by both the
                TS tests and the Dart client's tests to catch twin drift.
```

An implementor authors a game against `@eigen/rules`, and ships a Worker that
imports `@eigen/server`. They never see the DO internals, the D1 schema, or the
migration machinery.

## One Worker, two authenticated API groups, one public web surface

`createEngine(config)` returns a single Worker (`{ fetch, scheduled }`). Its
request surface is three cleanly separated spaces on one host:

```text
/api/engine/*   Client API. Every route requires a verified Firebase ID token.
                Games, waiting room, actions, reads, profile, avatar upload,
                device registration, account deletion, the game socket.

/api/bot/*      External-bot webhook. Authenticated per-request by an HMAC
                signature (no user token). Just POST /api/bot/action today.

/ (public)      Unauthed web surface. /health (always on; zero I/O liveness)
                plus, mounted only when configured:
                /.well-known/assetlinks.json + apple-app-site-association
                (deep-link verification), /join/:shortCode (share/landing),
                /avatars/:uid (opt-in avatar serving), and the `site` group —
                / (landing), /terms, /privacy, /delete-account, /sitemap.xml,
                /robots.txt, /site.webmanifest. Plus static assets.
```

The two API groups are **separate hono sub-apps** so their auth never mixes: the
engine group's Firebase middleware is scoped to `/api/engine/*` and never runs
for a bot or a public request. Both groups emit into one OpenAPI document (each
with its own security scheme) — the [HTTP API reference](../reference/http-api/eigen-engine-api.info.mdx)
is generated from it, and the typed Dart client is generated from it in this
same repository and published to pub.dev.

Static assets are served **unmetered** by Cloudflare's asset server. A request
that matches no static file falls through to the Worker on its own, so the
dynamic paths need no `run_worker_first` configuration — the only rule is not to
place a `public/` file that shadows one of them.

## The path of a move

A single action shows how the pieces interact:

```text
client ──POST /api/engine/games/{id}/action { seat, expected_version, data }──►
  Worker: verify Firebase token → provision/load user row → build a Command
          (a pre-authenticated value) → call the game's DO stub
    DO (input gate held):
      dedupe on commandId (replay stored response if seen)
      load meta + roster + latest transition from its SQLite
      verify the seat belongs to the caller  (else a clean 403)
      run the KERNEL: validate move, apply the game hook, compute timing,
                      project per-seat observations, decide finish
      if rejected → return the rejection as a value
      else → ONE SQLite transaction: append the transition (next version),
             write per-seat frames, store the command response, arm/clear alarm
      post-commit (gate released): fan out frames over sockets, mirror the
             summary to D1, run bot turns / pushes / finish apply
  ◄── the caller's own committed frame rides the HTTP response
  ◄── every other seat's frame arrives over its WebSocket
```

The critical discipline: between reading storage and writing it, the DO does
**no non-storage `await`**. The read → pure-kernel-decision → single
synchronous SQLite transaction runs entirely under the input gate, so no other
command can interleave. Every network effect (socket fan-out, D1 writes, bot
wakes) happens *after* the commit, where interleaving is harmless.
