# <img src="https://eigeninteractive.com/brand/favicon-32.png" width="16" align="top"> @eigeninteractive/testkit

Test helpers for games built on the
[EigenInteractive engine](https://eigeninteractive.com).

Drive a game's rules through the real kernel with no Worker, no database and no
network, and run the shared JSON fixtures that keep the TypeScript and Dart
halves of a game from drifting apart.

```ts
import { twinFixtureTests } from "@eigeninteractive/testkit";
import gameModule from "../../src/module/index.js";

twinFixtureTests(gameModule, new URL("../../src/module/fixtures/", import.meta.url));
```

A fixture case declares its `kind`:

| kind | what it pins |
|---|---|
| `action` | `applyAction`, and the actor's post-action observation |
| `initialState` | the opening envelope, drawn from the version-0 stream |
| `lifecycle` | `applyLifecycle` for a timeout, a resign, or an account purge |
| `transcript` | a whole match, replayed through the real kernel |
| `rng` | recorded `deriveRng` draws, compared exactly |
| `playerLimits`, `ratingPool`, `botSeatable` | the predicates |

The format itself is documented at the top of `src/twin-fixtures.ts`, which is
the normative description both runners follow.

`rng` cases are generated rather than written, because their values are the
kernel's own and the Dart port has to reproduce them bit for bit:

```ts
import { rngFixtureCase, writeRngFixture } from "@eigeninteractive/testkit";

writeRngFixture("src/module/fixtures/v1/rng.json", [
  rngFixtureCase({ name: "version 0", seed: "twin-fixtures", version: 0, count: 16 }),
  rngFixtureCase({ name: "seat 1's bot stream", seed: "twin-fixtures", version: 3, seat: 1, count: 16 }),
]);
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

MIT © EigenInteractive
