# Migration

- **No identity denormalization** onto game rows — the batch `players?ids=`
  endpoint plus the client's persisted cache cover it.
- **Social depth.** The friend graph, search, blocking and friends' games are
  built; a notifications/inbox surface and richer presence are not scoped.
- **Is `engineCall` + the hand-assembled per-resource providers the idiomatic
  shape?** Could the error mapping be a Dio interceptor on a single `eigenApi`
  instance instead, so call sites don't wrap every request? The current split
  exists because a failure *with* a response and a failure *with none* must stay
  distinguishable to a state-changing command — but that distinction could live
  in an interceptor too > If that is more idiomatic lets do that
- **Twin-fixture types.** The fixture runner's typing is looser than the rest of
  the contract; tighten it so a malformed fixture fails at load, not at compare.
- The revision-guarded rating write is hand-rolled
  compare-and-swap in D1. Worth checking whether the same guarantee falls out of
  a simpler formulation before it grows.
- **Do we need `GameStub`?** Question the indirection.
- Make single attemps retry based (where all does it make sense)
- Can anything be optimizied - unnecessary network call, N + 1 patterns, batch simplifications, etc.?

# P0

- **Web as a first-class target** — `web_socket_channel` over `wss` with the
  `?token=` upgrade, web Firebase auth, `cached_network_image` against the
  worker-served avatar URL, and the FCM service worker + VAPID key. Add web to
  the CI matrix.
- Docs
- Rate limiting (especially /avatars/:uid:)
- **The `eigeninteractive` web repo.** The Cloudflare Worker that used to own the
  per-game subdomain map and serve the deep-link verification files is now
  redundant: the game Worker generates `.well-known` itself and serves `/j/`.
  Decide what to remove there, and how the apex domain and legal pages are hosted
  going forward
- Client Monorepo suggestion doc

# P1

- [ ] Monetization Flows
- [ ] Persisting game history, games, ratings, etc. using Drift
- [ ] Offline App Support with Bot Play
- [ ] Flag a game or player
- [ ] Spectating Support
- [ ] Quick Match
- [ ] Target web platform, Web App notifications
