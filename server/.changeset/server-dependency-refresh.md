---
"@eigeninteractive/server": patch
---

Refresh the server workspace's dependencies.

Runtime dependencies of this package move with it: `hono` 4.12 → 4.13, `jose`
6.2.3 → 6.2.9, `@hono/zod-openapi` 1.5 → 1.6, and `openapi3-ts` 4.6.0 → 4.6.1.
Consumers receive those ranges, which is why a dependency refresh is a release
rather than an internal change.

The rest is tooling and does not reach a published artifact: `wrangler`,
`@cloudflare/workers-types`, `@cloudflare/vitest-pool-workers`, `@biomejs/biome`,
`@types/node`, `tsx`, and `@changesets/changelog-github`. TypeScript is
deliberately absent — `.github/dependabot.yml` holds its majors back, and the
header there records why for each half of the repository.

`server/examples/rps/worker-configuration.d.ts` is regenerated for the newer
`wrangler`, which is the mechanical half of triaging one of these: the generated
files are committed, and the bot cannot run the generators.
