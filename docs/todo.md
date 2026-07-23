# P0

- **Web as a first-class target** — `web_socket_channel` over `wss` with the
  `?token=` upgrade, web Firebase auth, `cached_network_image` against the
  worker-served avatar URL, and the FCM service worker + VAPID key. Add web to
  the CI matrix.
- **Retire `eigeninteractive-web`.** The engine now serves the game-side web
  surface (`site:` shipped: landing, legal, sitemap/robots/manifest) and
  `eigen-web` is bootstrapped for the apex. Remaining, in order: drop the
  `*.eigeninteractive.com/*` wildcard route from the old Worker (frees game
  subdomains); point the apex at `eigen-web`; delete the old Worker; archive the
  `eigeninteractive-web` repo. (Apex going dark in between is acceptable.)
- **Build out `eigen-web` (the docs product).** Wire the doc generators —
  `docusaurus-plugin-openapi-docs` (HTTP API from `openapi.json`),
  `docusaurus-plugin-typedoc` (TS API), a `sync-docs` script pulling guides from
  the sibling repos, and a pub.dev link-out for the Dart API (needs `eigen_sdk` /
  `eigen_flutter` published). Add `@cmfcmf/docusaurus-search-local`, the Diátaxis
  sidebar (mind the duplicate-"Reference"-label key gotcha), and a showcase page
  from a games manifest. Move `client_reference.md` from `eigen-server` to
  `eigen-flutter`. Enable Cloudflare Web Analytics in the dashboard.
- changelog maintenance for both, release instructions, etc. (the changelog is
  now `eigen-web`'s `/blog`).
- Scaffolding and implementor Monorepo suggestions
- changelog maintenance for both, release instructions, etc.

# P1

- [ ] Monetization Flows
- [ ] Persisting game history, games, ratings, etc. using Drift
- [ ] Offline App Support with Bot Play
- [ ] Flag a game or player
- [ ] Spectating Support
- [ ] Quick Match
- [ ] Target web platform, Web App notifications
