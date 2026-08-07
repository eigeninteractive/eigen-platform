---
"create-eigen-game": minor
---

Apply the engine's D1 migrations to the local database before `wrangler dev`,
and describe what pnpm's release quarantine actually does.

A generated project's `dev` script started a Worker against an empty local D1,
so the scheduled handler failed on its first run with
`D1_ERROR: no such table: users` and again with `no such table: games` — two
screens of stack trace before the first request, on a project that had done
nothing wrong. `dev` now runs the new `db:migrate:local` script first, which is
idempotent: it applies `0000_init.sql` once and does nothing thereafter.

`pnpm-workspace.yaml` is now comments-free, and what it used to say has moved
into `server/README.md`. The comment offered a commented-out
`minimumReleaseAgeExclude` block to uncomment, which was wrong twice over: pnpm
writes that key itself, directly above the comment explaining why it was
commented out, and pins one exact version per entry so the exemption expires
with the version instead of opening the whole scope. Prose in that file could
not survive anyway — pnpm rewrites it in place, and a YAML formatter is free to
move whatever is left. The README says what both keys are for, including the
one place the release quarantine is silent: `pnpm create eigen-game`, where
there is no manifest to record an exemption in.
