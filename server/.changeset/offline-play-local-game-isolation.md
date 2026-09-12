---
"@eigeninteractive/server": minor
---

Close the two ways something other than the device could touch a local game.
`join` and `join-by-code` refuse origin `local` outright rather than relying on
its status: a local game carries a short code like every game and sits at
`ready` between the create and start writes, so a stranger holding the code
could otherwise be seated as a second human into a game played on somebody's
phone. A local game's recorded `minPlayers`/`maxPlayers` are now its roster,
which is what the device's own session reports for the same game, rather than
the rules' range the seating had to satisfy.

The Durable Object also arms no alarm for a local-origin game. Such a game is
created untimed, but a version's `applyAction` may still return an envelope
`turnSeconds`, and `computeNextDeadline` honours that override ahead of the
untimed branch; the Dart `Envelope` has no such field, so the device could
never produce one and would know nothing about the timeout the alarm would
commit — and the next batch it appended would collide with it.
