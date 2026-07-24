---
sidebar_position: 2
title: A complete example — Rock-Paper-Scissors
description: The whole game in one file — simultaneous commitment with hidden information, the engine's hardest-case-first example.
---

# A complete example — Rock-Paper-Scissors

RPS is the engine's *hardest-case-first* example: simultaneous commitment with
hidden information. Both seats are pending each round; a commit is stored in the
state but hidden from the opponent by `computeObservation`. Here is the whole
game (see `examples/rps/src/rules/v1.ts` for the file with comments):

```ts
class RpsRulesV1 implements GameRules<State, Action, Config> {
  readonly schemas = { state: stateSchema, action: actionSchema, config: configSchema };

  initialState(): Envelope<State> {
    return { state: { round: 1, wins: [0, 0], commits: [null, null], lastRound: null },
             pending_players: [0, 1] };
  }

  applyAction({ state, data, playerIndex }: ApplyActionArgs<State, Action, Config>): Envelope<State> {
    const seat = playerIndex as 0 | 1;
    const other = (1 - seat) as 0 | 1;
    const otherMove = state.commits[other];

    if (otherMove === null) {
      // First commit: record it, wait for the opponent.
      const commits: State["commits"] = [null, null];
      commits[seat] = data.move;
      return { state: { ...state, commits }, pending_players: [other] };
    }
    // Second commit: resolve the round (and maybe the match).
    const moves = seat === 0 ? [data.move, otherMove] : [otherMove, data.move];
    const winner = beats(moves[0], moves[1]) ? 0 : beats(moves[1], moves[0]) ? 1 : null;
    const wins = [...state.wins]; if (winner !== null) wins[winner] += 1;

    if (winner !== null && wins[winner] >= config.targetWins) {
      return { state: { ...state, wins, commits: [null, null], lastRound: { moves, winner } },
               pending_players: [], outcome: matchOutcome(winner) };
    }
    return { state: { round: state.round + 1, wins, commits: [null, null], lastRound: { moves, winner } },
             pending_players: [0, 1] };
  }

  computeObservation({ state, pending, playerIndex, isReplay }: ComputeObservationArgs<…>): ObservationSlice {
    if (isReplay || playerIndex === null) {
      return { data: { round: state.round, wins: state.wins, lastRound: state.lastRound, commits: state.commits },
               pending_players: pending };
    }
    const seat = playerIndex as 0 | 1;
    // Two deliberate omissions that ARE the game:
    //  - the opponent's commit is hidden (only your own move comes back);
    //  - the opponent's pending status is masked (you see only your own).
    return { data: { round: state.round, wins: state.wins, lastRound: state.lastRound, yourMove: state.commits[seat] },
             pending_players: pending.filter((s) => s === seat) };
  }

  ratingPool({ access }: RatingPoolArgs<Config>): string | null {
    return access === "public" ? "standard" : null;
  }
  botSeatable(): boolean { return true; }
}
```

Notice what the engine did for you: RPS never mentions turns, deadlines,
sockets, versions, persistence, or ratings. It stores commits in its own state
and hides them in `computeObservation` — and that single choice makes both the
hidden information *and* the simultaneous-move correctness fall out for free.

That last point is the one worth internalising before you write your own game:
read [Hidden information & the same-view rule](../build-a-game/hidden-information.md)
next.
