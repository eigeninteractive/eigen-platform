---
"create-eigen-game": patch
---

Generate the Worker's types against the wrangler a scaffold actually installed.

Every scaffolded project opened its first `wrangler dev` with `❓ Your types might be out of date`. Nothing was: the `Env` interface was complete and correct, bindings and all. `worker-configuration.d.ts` is committed, and its second line stamps the workerd version that produced the runtime types — `wrangler` floats on a caret, Cloudflare ships workerd about weekly, and the copy in `templates/worker` was generated whenever this package was last built. Across three weeks of workerd releases the whole diff is that one comment line, byte-identical either side of it, and `wrangler dev` compares the line.

So the scaffold now runs `cf-typegen` in `server/` immediately after installing its packages, against the wrangler that install just resolved rather than the one this package was built with, and the file lands correct in the scaffold commit.

Left alone deliberately: `dev.generate_types`, which would have Wrangler rewrite the file mid-`dev` instead of mentioning it. It trades one warning per workerd release for one silent write to a tracked file per workerd release, on the command an implementor runs all day — and on a team, for that line flipping back and forth as each machine's wrangler resolves differently. A warning costs nothing to ignore; a dirty tree does not. `cf-typegen` is there for the implementor who wants it gone, and `typecheck` has always regenerated before `tsc`.
