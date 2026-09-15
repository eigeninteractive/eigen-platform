---
"@eigeninteractive/server": patch
---

`GET /bots` publishes each bot's commercial `tier`, so a picker can mark a paid
opponent before a player chooses it rather than after the server refuses the
seat. The tier is resolved by the same function the seating routes enforce
with, so what is published and what is enforced cannot drift apart.

`tier` is `null` for an untiered bot, and always `null` for a `local` bot,
whatever `botTiers` says. A local bot's brain ships only in the app and the
server never seats it, so its tier was never checked anywhere; publishing it
would have advertised a price nothing charges.
