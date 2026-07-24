# P0

- **Web as a first-class target** — `web_socket_channel` over `wss` with the
  `?token=` upgrade, web Firebase auth, `cached_network_image` against the
  worker-served avatar URL, and the FCM service worker + VAPID key. Add web to
  the CI matrix.
- **Deploy the new web topology.** The old `eigeninteractive-web` Worker is
  deleted and its repo archived; `eigen-web` is built and ready. Remaining, all
  deploy actions: point the apex at `eigen-web` (`pnpm deploy` there), put each
  game Worker on its own `*.eigeninteractive.com` subdomain, and enable
  **Cloudflare Web Analytics** in the dashboard for both.
- **Retire the duplicated source docs.** `docs/architecture.md`,
  `docs/building_a_game.md` and `eigen-flutter/docs/client_reference.md` have
  been ported into `eigen-web` (which is now the source of truth) but are
  deliberately still in place. Once the site is live and verified, delete them —
  every repo's `AGENTS.md` already points agents at
  `https://eigeninteractive.com/llms.txt`, and every page is fetchable as `.md`.
- **Publishing to pub.dev is blocked.** `.gitignore` excludes `*.g.dart` and
  `*.freezed.dart`, and `dart pub publish` honours `.gitignore` — so 71
  generated files exist on disk and **zero would ship**, giving consumers a
  package that does not compile. Fixing it means committing generated output and
  accepting the diff noise. Blocks both `eigen_flutter` and `eigen_api`, which
  release in lockstep.
- **Finish the docs product.** Shipped: the task-first IA (each page carries both
  the TypeScript and Dart halves of one task), the generated HTTP + TypeScript
  references (`pnpm sync-api`), local search, `llms.txt` / `llms-full.txt` /
  per-page `.md`, the showcase page, the `eigen` Claude Code plugin, and the RPS
  client half in `eigen-flutter/example/`. Remaining: publish to pub.dev and turn
  `reference/dart.md` into a real link-out; add real games to `src/data/games.ts`
  as they ship; add screenshots/logos to the showcase.
- changelog maintenance for both, release instructions, etc. (the changelog is
  now `eigen-web`'s `/blog`).
- Scaffolding and implementor Monorepo suggestions

# P1

- [ ] Monetization Flows
- [ ] Persisting game history, games, ratings, etc. using Drift
- [ ] Offline App Support with Bot Play
- [ ] Flag a game or player
- [ ] Spectating Support
- [ ] Quick Match
- [ ] Target web platform, Web App notifications
