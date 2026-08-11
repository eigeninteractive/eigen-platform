---
"create-eigen-game": patch
---

A scaffolded game now ships the local inspector wired up: `pnpm inspect games`, `pnpm inspect game <id|code>`, `pnpm inspect do`.

One line makes it work. The `inspect` script points at `eigen-inspect`, which the testkit already installs as a `devDependency`, and which reads the local `.wrangler` databases through Node's built-in `node:sqlite`, so there is nothing to install and no native build to approve.
