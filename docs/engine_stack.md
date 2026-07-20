# Eigen — Roadmap

The Cloudflare-native server is **built and complete**. This document is the
**forward-looking roadmap**: what remains, and the standing constraints that
govern how it gets done. For how the system works today, read the reference docs:

| Doc | What it is |
|---|---|
| [`architecture.md`](./architecture.md) | How the server works, end to end — the primary reference. |
| [`building_a_game.md`](./building_a_game.md) | How to build a game on the engine (the `GameRules` contract, hooks, testing, deploying). |
| [`client_reference.md`](./client_reference.md) | The client (Flutter) reference — transport, frame/animation model, shell, platform integration. |
| [`client_changes.md`](./client_changes.md) | The running tracker of client changes the server migration implies (retires once the client migration lands). |

> The detailed decision history that used to live here (every architectural
> choice with its dated rationale) is preserved in this repo's git history and,
> where it still matters, folded into `architecture.md` as inline rationale. This
> file now carries only what is *not yet done*.

---

## 1. The critical path — client migration & cutover

The whole server is done; the only path to production is the **client**. The
Flutter app (`eigen_client` transport + `eigen_flutter` shell, with the per-game
Dart `GameRules` twin) must catch up to the new server:

- Firebase Auth replacing Supabase; the generated API client from `openapi.json`;
  the hand-written WebSocket frame stream with gap recovery.
- The moved surface: client routes under `/api/engine/*`, `seat` on every
  action/forfeit, the `{ error, code? }` shape, `PUT /me/devices` for push
  registration, the `/api/engine/friends/*` social surface, `PUT /me/username`.
- The removals the client must drop: local bots (server-side now), any
  client-direct DB reads.

`client_changes.md` enumerates every delta; `client_reference.md` is the target
state. **Cutover is big-bang** — no dual-running. There are no production users,
so there is no data migration: freeze Supabase, apply the D1 migrations, deploy
the Worker, ship the client. The cutover is what first requires a real R2 bucket
and a payment method (see §3).

---

## 2. Deferred features (no paid tier required)

Held open by shipped seams — each needs engine work but no infrastructure change:

- **D1 FTS5 user search.** `GET /users/search` is a `LIKE` substring match today.
  Swap in an FTS5 virtual table + triggers for ranked, scalable search when
  volume warrants; the route and its response shape don't change.
- **Offline-solo transcript import.** The replacement for the deleted client-side
  local bots: the client simulates a whole solo game on-device (Dart rules twin +
  a Dart bot brain, seeded RNG), then uploads the seed + ordered action
  transcript; the server replays it through the real TS rules and records it as a
  normal finished game (identical history/replay). The `local` bot `type` and the
  transcript-import seam exist; the endpoint and the client loop do not.
- **Social depth.** The friend graph, search, blocking, and friends' games are
  built; natural follow-ons (a notifications/inbox surface, richer presence) are
  not scoped yet.

---

## 3. Paid-tier items

These add a payment method and are deliberately deferred until a real deploy asks
for them. All are held open by shipped seams — no engine rework to land them.

- **A real avatars R2 bucket.** Avatar upload/serve is built and tested under
  local R2 simulation. A card enters only at `r2 bucket create` for a deploy with
  uploads enabled. Optionally set `avatars.publicBaseUrl` to serve reads straight
  from a bucket custom domain / r2.dev, bypassing the Worker.
- **R2 cold-tier history sweep.** Finished-game history lives in each game's DO
  forever (free runway ≈ 125k–250k games in the 5 GB account-wide DO SQLite
  quota). When that fills, an age-based sweep writes the frozen blob (the shape the
  finish compaction already leaves) to a private `GAME_HISTORY` bucket, drops the
  DO's storage, and stamps `archived_at`. Replay then reads DO-if-present-else-R2
  behind the existing `HistoryStore` interface — the replay route never changes.
- **The free → paid plan upgrade.** Day 0 runs entirely on the Workers free plan
  (SQLite-backed DOs, alarms, hibernation, D1, cron) with no payment method. The
  first ceiling is DO storage writes (~100k rows/day ≈ ~1,400 games/day); crossing
  it is a **one-click plan upgrade, zero code change**.

---

## 4. Standing constraints

The rules of the road, still in force:

- **jose** for Firebase verification — not a bundled Firebase SDK.
- **No retry machinery in v1** — single attempt + error log everywhere (bot wakes,
  outbox, FCM). The architecture makes everything idempotent or self-healing
  instead.
- **No identity denormalization** onto game rows — the batch `players?ids=`
  endpoint plus the client's persisted cache cover it.
- **Versions strictly serial, no gaps, ever** — the same-view rule governs
  acceptance only.
- **No real R2 bucket / no payment method** until explicitly enabled for a deploy.
- **Docstrings are self-sufficient** — no cross-references to section numbers in
  code comments (they drift). Keep the reference docs current when the
  architecture changes; keep `client_changes.md` current with each server change
  the client must follow.
