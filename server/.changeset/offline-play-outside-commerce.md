---
"@eigeninteractive/server": patch
---

Offline play is now outside commerce on purpose rather than by omission. A
local game is played entirely on the device — no server turn, no dispatch, no
alarm, no seat held open — so nothing about it was sold and nothing about it is
charged. That was already true of `game.create.success` and `bot.game.success`,
and two places disagreed.

`games.openCreated` counted every live game the account created, local ones
included, while the authoritative capacity slot is reserved only by an online
create. An imported game the player was still part-way through therefore spent
a concurrent allowance that nothing was holding, and that finishing it would
then have had to release. The count now excludes the exempt origin, so what is
displayed and what is enforced describe the same set.

Replaying a finished local game was gated on `replay.read` and on viewer-owned
content, so a deployment selling either could refuse a player the frames of a
game they played on their own phone — while `GET /games/{gameId}/local` handed
the same caller the whole transcript ungated. The replay gate now exempts the
local origin. `contentForCreate` still runs for a local game and its result is
still recorded: the row says which variant the transcript was produced under,
as a record and never as a gate.

`app.access` is unchanged and still applies to every route, local import
included: it gates reaching the server at all rather than playing.

A consequence worth stating for a paid catalog, because the engine cannot
enforce it: a `bot.use` tier only binds where the server seats the bot. Server
seating requires a turn deadline, so untimed play always happens on the device,
where a brain in the client bundle runs with no network and there is no request
to refuse. Keep a paid bot's brain off the device and it is timed-only by
construction.
