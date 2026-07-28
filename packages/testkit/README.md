# @eigeninteractive/testkit

Test helpers for games built on the [Eigen engine](https://eigeninteractive.com).

Drive a game's rules through the real kernel with no Worker, no database and no
network — and run the shared JSON fixtures that keep the TypeScript and Dart
halves of a game from drifting apart.

```ts
import { twinFixtureTests } from "@eigeninteractive/testkit";
import gameModule from "../../src/module/index.js";

twinFixtureTests(gameModule, new URL("../../src/module/fixtures/", import.meta.url));
```

`eigen-contract` imports the default `src/module/index.ts`, validates every
`fixtures/v<N>/*.json` against the registered version, and emits
`game-contract.json`. Use `eigen-contract --check` in CI.

## Documentation

Full documentation: **<https://eigeninteractive.com/docs/build-a-game/testing>**

- [Quickstart](https://eigeninteractive.com/docs/getting-started/quickstart)
- [Testkit API reference](https://eigeninteractive.com/docs/reference/typescript/testkit)
- [For agents: llms.txt](https://eigeninteractive.com/llms.txt)

## License

MIT © Eigen Interactive
