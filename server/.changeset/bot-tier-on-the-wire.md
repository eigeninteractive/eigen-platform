---
"@eigeninteractive/server": patch
---

`GET /bots` publishes each bot's commercial `tier`, so a picker can mark a paid
opponent before a player chooses it rather than after the server refuses the
seat. The tier is resolved by the same function the seating routes enforce
with, so what is published and what is enforced cannot drift apart.

A `local` bot never carries one, whatever `botTiers` says. Its brain ships only
in the app and the server never seats it, so its tier was never checked
anywhere; publishing it would have advertised a price nothing charges.

The field is optional rather than nullable. A nullable field is generated into
`eigen_api` as a required key, and a newer app would then fail to decode the
bot list from a server deployed before the field existed.
