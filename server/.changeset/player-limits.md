---
"@eigeninteractive/rules": minor
"@eigeninteractive/server": minor
"@eigeninteractive/testkit": minor
---

Make seat counts rules-authoritative with a new `playerLimits` hook.

**Breaking.** `GameRules` gains a required `playerLimits({ config }) →
{ minPlayers, maxPlayers }`: the seats a version can actually be played with, read
from the parsed config.

Seat counts were entirely caller-supplied. `POST /games` and `POST /games/solo`
took `minPlayers`/`maxPlayers` and validated them only against *each other*, and
no hook existed to check them against the rules — so a client could create a
three-seat game of a two-seat game. That is not a bigger game: `initialState`
receives `playerCount` seats and hooks index by it, so the example RPS rules
(`moves: z.tuple([move, move])`, `playerIndex as 0 | 1`) would mis-slot the third
seat's move or fail state validation. RFC 0005 requires that caller-supplied
derived values not exist; this closes the seat case.

Creation now derives the bounds and validates the caller's range against them.
The two body fields are **optional**: omitted means exactly what the rules
declared, which is every fixed-size game. A caller may still *narrow* the range
for one lobby (opening a 2-6 game as 3-6). A range reaching outside the derived
bounds is refused with **422**, matching how a drifted `rated` assertion is
refused rather than coerced. `playerLimits` returning a malformed range is a 500
naming the hook, not a corrupt game.

Twin fixtures gain a `playerLimits` case kind so TS/Dart drift on the seat
declaration fails a test. It is the one twin the server enforces, so drift there
breaks creation instead of a rendering detail — worth a case even in a fixed-size
game.
