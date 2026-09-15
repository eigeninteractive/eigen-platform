---
"@eigeninteractive/server": minor
---

**Breaking:** `bot.use` always names a tier, and a grant covers only the tier
it names. A catalog granting a plain `{ kind: "bot.use" }` now fails at
`createEngine`.

The plain grant meant "every bot", and it was the grant a free profile reached
for to keep ordinary bots free, so it quietly covered every paid tier as well.
Every bot now belongs to exactly one tier: its `botTiers` entry, or `standard`,
exported as `DEFAULT_BOT_TIER`. To migrate, grant
`{ kind: "bot.use", tier: "standard" }` wherever you granted
`{ kind: "bot.use" }`, and name each paid tier in the entitlements that should
include it. `analysis.use` matches its type exactly in the same way, so an
untyped grant now covers untyped analysis only.

`GET /bots` publishes each bot's `tier`, so a picker can mark a paid opponent
before a player chooses it rather than after the server refuses the seat. It is
resolved by the same function the seating routes enforce with, so what is
published and what is enforced cannot drift apart. A `local` bot is always
`standard`, whatever `botTiers` says: its brain ships only in the app and the
server never seats it, so a paid tier on it would advertise a price nothing
collects.
