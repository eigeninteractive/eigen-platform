# Handoff — Eigen Server

> **This was the migration handoff.** It carried the plan and running progress
> for moving the Eigen Engine from Supabase to Cloudflare-native. That migration
> is complete (the whole server — Phase 2 — shipped), so this file is now a
> short pointer to the docs that replaced it. It is kept (and loaded as project
> context) as the map, not the territory.

## Where the current documentation lives

| Doc | What it is |
|---|---|
| [`architecture.md`](./architecture.md) | **How the server works, end to end** — the as-built reference for maintainers and implementors. Start here. |
| [`building_a_game.md`](./building_a_game.md) | **How to build a game on the engine** — the implementor's guide (the `GameRules`/`GameModule` contract, the hooks, wiring, testing, deploying). |
| [`engine_stack.md`](./engine_stack.md) | **The decision record** — every architectural decision with its rationale and date. Source-file comments cite its section numbers (`§4.5`, `§7`, …), so it is retained as the canonical anchor for those references. Read `architecture.md` for the clean narrative; read this when you need *why*. |
| [`client_changes.md`](./client_changes.md) | The running list of Flutter/`eigen_client` changes each server change implies — the tracker for the (still pending) client migration + big-bang cutover. |

## State of the world

- **The server is complete.** All engine functionality is built, tested, and
  documented in the two reference docs above.
- **Remaining work is not in this repo:** the Flutter client migration
  (tracked in `client_changes.md`) and the eventual big-bang cutover, plus a few
  deferred, seam-held items (a real R2 avatars bucket at a card-enabled deploy;
  the R2 cold-tier history sweep; the social/friends routes milestone).

## Standing constraints (still in force)

These shaped the build and remain the rules of the road:

- jose for Firebase verification (not a bundled Firebase SDK).
- No retry machinery in v1 — single attempt + error log everywhere.
- No identity denormalization onto games rows (the batch `players?ids=`
  endpoint + the client's persisted cache cover it).
- Versions strictly serial, no gaps, ever.
- No real R2 bucket / no payment method until explicitly enabled for a deploy.
- Keep `engine_stack.md` (the decision record) and the two reference docs
  current when the architecture changes.
