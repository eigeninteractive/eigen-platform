---
sidebar_position: 11
title: Security model
description: Authorization enforced explicitly in application code — token gating, uid-scoped reads, the game-visibility capability model, and seat ownership.
---

# Security model

The old stack leaned on Postgres row-level security; this one enforces
authorization explicitly in application code, which keeps every check in view.

- **Every `/api/engine/*` route is token-gated**; the socket upgrade included
  (its `?token=` is verified by the same middleware).
- **Reads are uid-scoped**: "my games", ratings, rating history, and profile all
  filter to the caller. `getPlayers` returns only *public* identity (username,
  display name, avatar, anonymity) — never email. A user's own email is returned
  only by their own `/me`.
- **Game visibility is a capability model.** A game id is an unguessable UUID; a
  private game is unlisted (never in the lobby) and joinable only by someone who
  holds its id or short_code. Reading a game summary requires the id, and the
  sensitive part — the game *state* (frames) — is separately gated: only a
  participant, or anyone for a *finished public* game, may fetch frames.
- **Seat ownership is enforced at the DO** against its authoritative roster, so a
  client (or a misbehaving external bot) can never act on a seat it doesn't hold
  — a clean 403, not a crash.
- **Bot webhooks are HMAC-authenticated** with domain-bound, constant-time
  verification (see [Bots](./bots.md)); the client cannot forge a bot move and a
  bot cannot reflect a wake into an action.
- **Tokens are RS256-pinned** and issuer/audience-checked; secrets
  (`BOT_SIGNING_SECRET`, the `FIREBASE_*` service account) are read from env by
  convention and absent by default (each feature is simply off when unconfigured).
- **The Worker strips inbound `x-eigen-*` headers** before forwarding a socket
  upgrade to the DO and sets the principal itself — a client cannot spoof its
  identity to the DO.
