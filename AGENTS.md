# EigenInteractive platform working rules

Treat `server/`, `flutter/`, and `web/` as one product and one change surface.
Read the nested `AGENTS.md` before changing files in that subtree; nested
instructions remain authoritative for their code.

The reference documentation at <https://eigeninteractive.com> is the current
published source of truth. Re-read it before changing public behavior. Re-read
current official Cloudflare documentation before any Workers, Durable Objects,
D1, alarms, or other Cloudflare platform work.

## Repository safety

- Preserve the imported histories and the namespaced archive refs.
- Do not push, archive, rewrite, or redirect the original remotes without owner
  approval.
- Keep generated API, Dart client, examples, and docs synchronized with their
  normative source.
- Never discard unrelated worktree changes.

## Architecture direction

- One SQLite Durable Object is authoritative for each game.
- TypeScript rules are the sole authoritative game implementation.
- D1 is a registry and read model, not the live game writer.
- Every mutation has a stable client-created identity and an
  authorization-scoped canonical fingerprint.
- HTTP responses, WebSocket sessions, gap recovery, and local cache enter one
  serialized client coordinator.
- The pure Dart client must not depend on Flutter, Riverpod, Firebase,
  navigation, analytics, or widgets.
- Firebase and the full app shell are optional adapters above the core.

## Validation

Use `./tool/check.sh` for the complete imported-platform baseline. Narrow checks
are acceptable while iterating, but run the affected subtree's full suite before
handoff.
