# TypeScript API

This reference is generated from the published package barrels. Start with the
package that owns the task you are doing:

| Package | Open it when you need to… |
|---|---|
| [`@eigeninteractive/rules`](rules.md) | Implement a `GameModule`, payload schemas, hooks, observations, ratings, or bots. This is where most game code lives. |
| [`@eigeninteractive/server`](server.md) | Compose the Cloudflare Worker with `createEngine`, `BaseGameDO`, bindings, deep links, avatars, or the public site. |
| [`@eigeninteractive/testkit`](testkit.md) | Run twin fixtures, emit/check `game-contract.json`, or drive rules through the kernel in tests. |
| [`@eigeninteractive/server/testing`](server-testing.md) | Mint local Firebase-compatible tokens and supply explicit no-op Firebase Admin effects for Worker integration tests. Never use it in production code. |

Game Workers depend directly on `rules` and `server`; `testkit` and
`server/testing` are test-only. The [task guides](../../build-a-game/the-contract.md)
show how the TypeScript and Dart halves fit together.

The kernel and storage-schema pages are engine internals. They remain available
for debugging and contributors, but a game should not import them to implement
rules or deploy a Worker.
