# P0

- **Web as a first-class target** — `web_socket_channel` over `wss` with the
  `?token=` upgrade, web Firebase auth, `cached_network_image` against the
  worker-served avatar URL, and the FCM service worker + VAPID key. Add web to
  the CI matrix.
- **The `eigeninteractive` web repo.** The Cloudflare Worker that used to own the
  per-game subdomain map and serve the deep-link verification files is now
  redundant: the game Worker generates `.well-known` itself and serves `/j/`.
  Decide what to remove there, and how the apex domain and legal pages are hosted
  going forward
- changelog maintenance for both, release instructions, etc.
- Docs
- Scaffolding and implementor Monorepo suggestions

# P1

- [ ] Monetization Flows
- [ ] Persisting game history, games, ratings, etc. using Drift
- [ ] Offline App Support with Bot Play
- [ ] Flag a game or player
- [ ] Spectating Support
- [ ] Quick Match
- [ ] Target web platform, Web App notifications
