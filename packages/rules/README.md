# @eigeninteractive/rules

The game-rules contract for the [Eigen engine](https://eigeninteractive.com) — a
server-authoritative engine for turn-based multiplayer games.

This package is **pure types plus two helpers**, with zero engine dependencies.
A game author reads only this: `GameRules`, `GameModule`, the six hooks, and the
`Envelope` / `Observation` types.

```ts
import type { GameModule, GameRules, Envelope } from "@eigeninteractive/rules";

export const gameModule: GameModule = { versions: { 1: rulesV1 } };
```

## Documentation

Full documentation: **<https://eigeninteractive.com/docs/build-a-game/game-module>**

- [Quickstart](https://eigeninteractive.com/docs/getting-started/quickstart)
- [API reference](https://eigeninteractive.com/docs/reference/typescript)
- [For agents: llms.txt](https://eigeninteractive.com/llms.txt)

## License

MIT © Eigen Interactive
