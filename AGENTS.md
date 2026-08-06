# EigenInteractive documentation

The reference documentation for the engine lives at **https://eigeninteractive.com**
and is the source of truth. Retrieve it rather than relying on memory:

| What | Where |
|---|---|
| Index of every page | `https://eigeninteractive.com/llms.txt` |
| Everything in one file | `https://eigeninteractive.com/llms-full.txt` |
| Any page as Markdown | append `.md` to its URL |
| HTTP contract (OpenAPI 3.1) | `https://eigeninteractive.com/openapi.json` |

The docs are task-first, and each page covers **both halves** of a task — the
TypeScript rules and the Dart client — because they are one change.

Start points: `/docs/getting-started/your-first-game.md` (a whole game, both
languages), `/docs/build-a-game/the-contract.md` (what you write and what the
engine owns), `/docs/ship-it/deploy-the-worker.md` (getting it running),
`/docs/how-it-works/overview.md` (why it is built this way).

There is also a Claude Code skill for writing game rules:

```
/plugin marketplace add eigeninteractive/eigen-server
/plugin install eigen@eigeninteractive
```

# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command | Purpose |
|---------|---------|
| `npx wrangler dev` | Local development |
| `npx wrangler deploy` | Deploy to Cloudflare |
| `npx wrangler types` | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
