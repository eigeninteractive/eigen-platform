# @eigeninteractive/kernel

The pure decision core of the [Eigen engine](https://eigeninteractive.com).

Given a game, its state, the roster and an intent, `commit()` returns a commit
plan or a rejection. It touches no platform API and reads no clock, so it is
exhaustively unit-testable and behaves identically in every environment.

```ts
import { commit } from "@eigeninteractive/kernel";

const plan = commit({ game, state, roster, intent, now, rules, staleViews });
```

It owns timing and grace, the same-view rule, observation fan-out, RNG
derivation and the rating math.

## Documentation

Full documentation: **<https://eigeninteractive.com/docs/concepts/kernel>**

- [Quickstart](https://eigeninteractive.com/docs/getting-started/quickstart)
- [API reference](https://eigeninteractive.com/docs/reference/typescript)
- [For agents: llms.txt](https://eigeninteractive.com/llms.txt)

## License

MIT © Eigen Interactive
