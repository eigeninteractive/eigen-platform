# P0

- **Web as a first-class target** — `web_socket_channel` over `wss` with the
  `?token=` upgrade, web Firebase auth, `cached_network_image` against the
  worker-served avatar URL, and the FCM service worker + VAPID key. Add web to
  the CI matrix.
- **Finish the docs product.** Shipped: the task-first IA (each page carries both
  the TypeScript and Dart halves of one task), the generated HTTP + TypeScript
  references (`pnpm sync-api`), local search, `llms.txt` / `llms-full.txt` /
  per-page `.md`, the showcase page, the `eigen` Claude Code plugin,
  `create-eigen-game`, generated game payloads/contracts, and the RPS client
  half in `eigen-flutter/example/`. Remaining: publish to pub.dev and turn
  `reference/dart.md` into a real link-out; add real games to `src/data/games.ts`
  as they ship; add screenshots/logos to the showcase.

# P1

- [ ] Monetization Flows
- [ ] Persisting game history, games, ratings, etc. using Drift
- [ ] Offline App Support with Bot Play
- [ ] Flag a game or player
- [ ] Spectating Support
- [ ] Quick Match
- [ ] Target web platform, Web App notifications
