---
sidebar_position: 1
title: Overview
description: One Flutter package, a generated REST client, and the single barrel a game app is allowed to import.
---

# The client, in outline

This section documents the **client side** of the Eigen engine: the Flutter app
shell, the transport that talks to the server, the Dart half of a game's rules,
and everything involved in shipping a real app.

It describes the client **as built**. Exact widget and provider signatures live
in the code and are not repeated here; what this captures is the design, the
contracts, and the setup that isn't discoverable by reading the source.

The client is one Flutter package, **`eigen_flutter`** — transport, state, and
presentation — layered by directory rather than by pubspec. The REST client
generated from the server's `openapi.json` lives inside it at
`lib/src/api/generated/`; those generated types are the data model directly,
with no hand-written mirrors. Each game supplies a Dart **`GameRules` twin** for
optimistic preview and rendering.

## What a game app depends on

A game app depends on **`eigen_flutter` alone** and imports **only its barrel**,
`package:eigen_flutter/eigen_flutter.dart`. It never reaches into
`eigen_flutter`'s file layout.

The framework needs one public surface it can evolve behind; deep imports make
every internal file layout an accidental contract. The generated client is a
*build artifact* — `tool/generate_api.sh` deletes and rewrites it wholesale — so
it lives under `lib/src/`, where Dart convention already marks it private, and
`lib/src/api/generated_from.dart` records which engine build produced it.

:::note It used to be a separate package

The generated client was once a sibling package (`packages/eigen_api`) consumed
by a path dependency. That made publishing to pub.dev impossible — pub.dev
rejects path dependencies — and it contradicted its own contract by making the
client separately resolvable when no app was ever allowed to depend on it.

:::

So the barrel re-exports the wire vocabulary a game renders from — `GameStatus`,
`Outcome`, `OutcomeResultEnum`, `Player`, `Seat`, `Frame`, and the rest — exactly
as `supabase_flutter` re-exports `supabase`. It lists them explicitly rather than
exporting the generated client wholesale, so the `*Api` classes and their Dio
plumbing stay out of an app's namespace:

> **Naming a type is part of the contract; calling the server is not.**

`test/core/architecture/api_isolation_test.dart` enforces both halves.

## The client/server boundary

What the **client** owns: rendering, animation, optimistic preview
(`previewAction`), the frame-stream/reconnect state machine, all shell concerns
(navigation, splash, offline UX, persistence cache, push registration, analytics,
platform integration), and the create/lobby UX.

What the **server** owns (client never reimplements): the rules, timing and
expiry, seat authority, ratings, history, identity resolution, and every write's
policy. The client proposes; the server decides.

The two rules twins (Dart preview, TS authority) are kept honest by shared JSON
fixtures run on both sides — a drift fails a test in both languages. When in
doubt about behaviour, the server's TS rules are the truth; the Dart twin exists
only to hide latency and render.
