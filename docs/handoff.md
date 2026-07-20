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
| [`client_reference.md`](./client_reference.md) | **The client (Flutter) reference** — transport, the frame/animation model, identity, offline UX, persistence, timing, push, navigation, platform integration. |
| [`client_migration.md`](./client_migration.md) | **The client migration plan** — topology, tooling, keep/rewrite inventory, and the ordered stages to move the Flutter client onto the new server. |
| [`engine_stack.md`](./engine_stack.md) | **The roadmap** — what remains (client migration + cutover, deferred features, paid-tier items) and the standing constraints. |
| [`client_changes.md`](./client_changes.md) | The running list of Flutter/`eigen_sdk` changes each server change implies — retires once the client migration lands. |

## State of the world

- **The server is complete.** All engine functionality is built, tested, and
  documented in the reference docs above.
- **Remaining work** is the roadmap in `engine_stack.md`: the Flutter client
  migration (tracked in `client_changes.md`, targeted by `client_reference.md`)
  and the big-bang cutover, plus deferred, seam-held items (a real R2 avatars
  bucket and the R2 cold-tier history sweep at a card-enabled deploy; D1 FTS5
  search; offline-solo transcript import).

## Standing constraints (still in force)

These shaped the build and remain the rules of the road:

- jose for Firebase verification (not a bundled Firebase SDK).
- No retry machinery in v1 — single attempt + error log everywhere.
- No identity denormalization onto games rows (the batch `players?ids=`
  endpoint + the client's persisted cache cover it).
- Versions strictly serial, no gaps, ever.
- No real R2 bucket / no payment method until explicitly enabled for a deploy.
- Docstrings are self-sufficient — no section-number cross-references in code.
- Keep the reference docs (`architecture.md`, `building_a_game.md`,
  `client_reference.md`) current when the architecture changes.
