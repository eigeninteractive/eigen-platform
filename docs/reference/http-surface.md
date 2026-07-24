---
sidebar_position: 1
title: The HTTP surface at a glance
description: Every route grouped by the three request spaces, plus the error model and its stable codes.
---

# The HTTP surface at a glance

The full request surface, grouped by the [three request spaces](../how-it-works/system-shape.md).
Every `/api/engine/*` route requires a Firebase bearer; `/api/bot/action` is
HMAC-authenticated; the web routes are public.

This page is the map. For per-operation request/response schemas, see the
generated [HTTP API reference](./http-api/eigen-engine-api.info.mdx), or read
the [`openapi.json`](pathname:///openapi.json) spec directly.

## Client API — `/api/engine`

**Reads** (D1-only, never wake a DO):

| Method + path | Purpose |
|---|---|
| `GET /lobby` | Public joinable games, newest first |
| `GET /games/mine?bucket=active\|finished` | The caller's games |
| `GET /games/{id}` | One game's summary (capability read; never state) |
| `GET /games/{id}/frames?from=&to=` | Version-range frames — live gap recovery **and** finished-game replay |
| `GET /players?ids=` | Batch public identity (≤ 50), never email |
| `GET /bots` | The bot catalog |
| `GET /me` · `GET /me/ratings` · `GET /me/rating-history` | The caller's own profile / ratings |
| `GET /friends` · `GET /friends/requests` · `GET /friends/games` | Social lists |
| `GET /users/search?q=` | Friend-picker search (registered only) |

**Game lifecycle** (Commands to the DO; policy at the edge, integrity in the DO):

| Method + path | Purpose |
|---|---|
| `POST /games` · `POST /games/solo` | Create (Worker-direct D1) · create-and-start vs bots |
| `POST /games/{id}/join` · `POST /games/join-by-code` | Join |
| `POST /games/{id}/leave` · `/cancel` · `/add-bot` · `/start` | Waiting-room commands |
| `POST /games/{id}/action` · `/forfeit` | Active play (carry the caller's `seat`) |
| `GET /games/{id}/socket` | WebSocket upgrade (`?token=` auth); frames + roster snapshots |

**Profile / account / devices / social writes:**

| Method + path | Purpose |
|---|---|
| `PUT /me/username` · `PUT /me/avatar` · `DELETE /me` | Rename · upload avatar · delete account |
| `PUT /me/devices` · `DELETE /me/devices/{fid}` | FCM device register / deregister |
| `POST /friends/requests` · `/requests/{id}/accept` · `DELETE /friends/{id}` | Friend request / accept / remove |
| `POST` + `DELETE /friends/{id}/block` | Block / unblock |

## Bot webhook — `/api/bot`

`POST /api/bot/action` — an external bot submits a move, authenticated by the
`Eigen-Signature` HMAC over the exact body. See
[External-bot HMAC](../how-it-works/bots.md#external-bot-hmac).

## Public web

`GET /.well-known/assetlinks.json` · `apple-app-site-association` ·
`GET /join/:shortCode` · `GET /game/:gameId` (share/landing) ·
`GET /avatars/:uid` (when avatars enabled).

When `site` is configured: `GET /` (landing) · `GET /terms` · `GET /privacy` ·
`GET /delete-account` · `GET /sitemap.xml` · `GET /robots.txt` ·
`GET /site.webmanifest`. Each is overridden by a matching `public/` file.

`GET /health` is always mounted and is deliberately absent from `openapi.json`;
see [Deploying](../ship-it/deploy-the-worker.md#what-health-proves).

## The error model

Every failure is one JSON shape — `{ error, code? }` — with the HTTP status
carrying the coarse class and the optional stable `code` carrying the machine
reason a client keys retry/resync UX off. Handlers only ever return their
declared 200 shape; a failure is an `HttpError` throw (or a kernel/lobby
rejection converted to one) rendered by the app-level error handler.

| Status | Meaning | Representative `code`s |
|---|---|---|
| 400 | Client mistake | `invalid_payload`, `illegal_move` |
| 401 | Missing/invalid token | — |
| 403 | Ownership/permission refusal | `not_creator`, `not_participant` |
| 404 | No such game/user | `unknown_game` |
| 409 | State conflict — resync and retry | `state_updated`, `not_active`, `not_ready`, `expired`, `not_pending`, `game_full`, `already_joined`, `not_joinable`, `creator_cannot_leave`, `schema_unsupported` |
| 413 / 415 | Avatar too big / wrong type | — |
| 422 | Assertion mismatch (e.g. `rated`) | — |
| 429 | Rate limited | `rate_limited` |
| 500 | Server fault (game-hook bug, storage) | — |
| 502 | Account deletion upstream failure (intact; retry) | — |

Two reject codes are **not** errors and never reach the client as failures:
`abstain` (a system `timeout` that lost its race — a clean no-op) and the
accepted-lobby-staleness codes, which a client resolves by resyncing. Kernel
rejections are *values*, not exceptions — recomputing one is always sound, so
they are never cached the way accepted commands are.
