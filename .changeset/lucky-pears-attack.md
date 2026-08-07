---
"create-eigen-game": minor
---

End a scaffold with a summary rather than a single line, ignore what a root
script leaves behind, and record in the generated `pnpm-workspace.yaml` what
pnpm 11's `minimumReleaseAge` does to an engine release.

A run prints several screens belonging to other tools — pnpm's `dlx` install,
`flutter create`, pub, two icon generators, the server install — so `Created
my-game in …` was indistinguishable from the noise above it. The summary names
where the project went, whether the scaffold was committed, and the two files a
game is written in: `server/src/module/v1.ts` and `app/lib/game/v1/rules.dart`.
`ScaffoldResult` carries a `git` outcome so it reports rather than guesses.

The root `package.json` declares no dependencies — it only forwards scripts into
`server/` and `app/` — so the first `pnpm contract` left an untracked
`node_modules/` and an empty lockfile beside the scaffold's own commit. Both are
ignored now, anchored so `server/pnpm-lock.yaml` and `app/pubspec.lock` stay
committed. npm strips `.gitignore` from tarballs, so each of these files has a
packaged twin under `templates/scaffold/`; a test now holds the two identical,
because they had already drifted.

The generated README now gives the two Firebase CLI installs, the `PATH` line
`dart pub global activate` does not write, and when they start to matter: rules,
fixtures and `wrangler dev` need neither, but the app throws `Firebase is not
configured` on launch until `firebase:configure` has run once.

The `minimumReleaseAgeExclude` block is commented out, because nothing needs it:
`minimumReleaseAgeStrict` is false unless `minimumReleaseAge` is set explicitly,
so a range only a fresh release satisfies still installs it. It matters for
anyone whose organization sets that setting — strict resolution then fails an
install on the day an engine release ships instead of falling back — and the
comment says so, next to the cost of excluding packages that execute during a
build.
