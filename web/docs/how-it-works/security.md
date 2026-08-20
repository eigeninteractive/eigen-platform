---
sidebar_position: 11
title: Security model
description: Authorization enforced explicitly in application code. Token gating, uid-scoped reads, the game-visibility capability model, and seat ownership.
---

# Security model

Authorization is enforced explicitly in application code rather than delegated
to the database, so every check is visible at the route that depends on it.

- **Every `/api/engine/*` route is token-gated.** The socket upgrade instead
  verifies the narrow `?ticket=` minted by the authenticated socket-ticket
  endpoint, so long-lived Firebase credentials never enter a URL.
- **Reads are uid-scoped**: "my games", ratings, rating history, and profile all
  filter to the caller. `getPlayers` returns only *public* identity (username,
  display name, avatar, anonymity), never email. A user's own email is returned
  only by their own `/me`.
- **Game visibility is a capability model.** A game id is an unguessable UUID; a
  private game is unlisted (never in the lobby) and joinable only by someone who
  holds its id or shortCode. Reading a game summary requires the id, and the
  sensitive part, the game *state* (frames), is separately gated: only a
  participant, or anyone for a *finished public* game, may fetch frames.
- **Seat ownership is enforced at the DO** against its authoritative roster, so a
  client (or a misbehaving external bot) can never act on a seat it doesn't hold:
  a clean 403, not a crash.
- **Bot webhooks are HMAC-authenticated** with domain-bound, constant-time
  verification (see [Bots](./bots.md)); the client cannot forge a bot move and a
  bot cannot reflect a wake into an action.
- **Firebase tokens are RS256-pinned** and issuer/audience-checked. Socket
  tickets are HS256-signed with the required `SOCKET_TICKET_SECRET` and bind
  both user and game. Other secrets (`BOT_SIGNING_SECRET`, the `FIREBASE_*`
  service account) are read from env by convention.
- **The Worker strips inbound `x-eigen-*` headers** before forwarding a socket
  upgrade to the DO and sets the principal itself, so a client cannot spoof its
  identity to the DO.
