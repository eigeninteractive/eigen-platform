# EigenInteractive documentation

The reference documentation for the engine lives at **https://eigeninteractive.com**
and is the source of truth. Retrieve it rather than relying on memory:

| What | Where |
|---|---|
| Index of every page | `https://eigeninteractive.com/llms.txt` |
| Everything in one file | `https://eigeninteractive.com/llms-full.txt` |
| Any page as Markdown | append `.md` to its URL |
| HTTP contract (OpenAPI 3.1) | `https://eigeninteractive.com/openapi.json` |

Start points: `/docs/getting-started/quickstart.md` (scaffold and run both
halves), `/docs/build-a-game/the-contract.md` (the rules contract),
`/docs/build-a-game/rendering.md` (the Flutter game surface),
`/docs/ship-it/deploy-the-worker.md` (deploying and running it).

There is also a Claude Code skill for writing game rules:

```
/plugin marketplace add eigeninteractive/eigen-platform
/plugin install eigen@eigeninteractive
```
