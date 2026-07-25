---
sidebar_position: 9
title: Bots
description: Three bot types, the seating gates, and the derived-key HMAC that authenticates external bots in both directions.
---

# Bots

A bot is a registry row whose `type` selects how its moves are produced:

- **`engine`** — the brain ships *in the game module*, as
  `GameRules.botActions[username]`. When a seated engine bot's turn starts, the
  DO resolves its row → username → move function, runs it **in-process
  post-commit**, and self-applies the returned move as that seat's action (a
  normal serialized command with a deterministic `commandId`, so it dedupes and
  chains through consecutive bot turns). A bot game needs no external service.
- **`external`** — the bot is hosted elsewhere. On its turn the DO sends a single
  signed **wake** carrying the bot's freshly-committed observation; the bot later
  POSTs its move to `/api/bot/action`. Fire-and-forget, single attempt — a lost
  wake rides the turn deadline.
- **`local`** — client-driven, reserved for the future offline-solo transcript
  import. A registry row for identity only; never dispatched server-side.

A bot only ever sees its own seat's projection — the same fog-of-war a human at
that seat gets — so a bot can never read hidden state.

**Seating gates** (shared by add-bot and create-solo, checked at the Worker
before minting): the game must be timed (bots ⇒ timed, so a broken brain is
backstopped by the deadline), the bot must support the schema version, a rated
game needs a rated-eligible bot, an engine bot needs a `botActions` entry for its
username, an external bot needs a webhook, and the game's `botSeatable` hook must
accept the pairing.

To write a bot brain for your own game, see
[Bots in a game module](../build-a-game/bots.md).

## External-bot HMAC

Both directions (engine→bot wake, bot→engine action) are authenticated by an
HMAC over the exact message body, using a **per-bot key derived from one engine
secret**:

```text
derivedKey = HMAC-SHA256(BOT_SIGNING_SECRET, bot_id)
signature  = "v1," + base64(HMAC-SHA256(derivedKey, "<domain>:<message>"))
```

The `domain` tag (`wake` vs `action`) is *inside* the signed bytes, so a
signature captured in one direction can never verify in the other — no
reflection. The signature travels in the `Eigen-Signature` header both ways.
Registering a bot needs no new secret and no redeploy. **Onboarding an external
bot** is therefore: insert the row, derive that bot's key, and hand it to whoever
runs the bot — which may well be you. The bot's owner gets only the derived key
and never sees `BOT_SIGNING_SECRET`.

`@eigeninteractive/server` exports the derivation as an operator utility:

```ts
import { deriveBotKey } from "@eigeninteractive/server";
const key = await deriveBotKey(BOT_SIGNING_SECRET, botId); // base64
```

or, with no code at all:

```bash
echo -n "<bot_id>" | openssl dgst -sha256 -hmac "<BOT_SIGNING_SECRET>" -binary | base64
```

:::warning Rotation is all-or-nothing

That key is a **credential** — it authenticates that bot to the engine for as
long as it is registered. Because every key is derived from the one master
secret, rotating a single bot's key means rotating the master, which rotates
*every* bot's key. Issue a key only to an owner you would be willing to re-issue
all of them for.

:::

Verification is constant-time (`crypto.subtle.verify`).
