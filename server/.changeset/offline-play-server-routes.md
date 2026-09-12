---
"@eigeninteractive/server": minor
---

Add offline play against on-device bots: `origin` (`online` or `local`) on
`GameSummary` and `Session`, `type` on `Bot`, and three routes for a
local-origin game — `POST /games/local` (register and start a game already
played on the device), `POST /games/{gameId}/local/transitions` (append a
batch of the device's transition log against its current version), and
`GET /games/{gameId}/local` (the whole record — the seed, the raw transitions,
and the two instants the session does not carry — so a second device can pull
the game and resume it). The Durable Object trusts an action on a bot seat
from the game's creator only for a `local`-origin game, and suppresses bot
wakes and turn/finish pushes for one, since its bots run on the device and its
one human does not need telling it is their turn.
