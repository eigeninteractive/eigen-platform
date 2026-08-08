---
"create-eigen-game": minor
---

Ask, rather than assume: every decision a scaffold makes is now a question, and every question has exactly one flag that answers it.

The run opens by saying what it is about to build and **why Firebase is part of it** — that the Worker verifies Firebase ID tokens to decide who holds a seat, that turn notifications go through the same project, that it is free and one project serves every game. A second service arriving unannounced in a scaffold looks like an imposition; the reason costs four lines and it is not.

It then checks the two CLIs and the Google sign-in and reports **every** problem at once, in the order they have to be fixed in, rather than the first one — a machine with neither CLI used to learn about `flutterfire` only after installing `firebase-tools` and running the whole thing again. If anything is missing, the question is whether to scaffold anyway and connect Firebase later, and the default is **no**: the tools are two commands away, and the alternative is an app that throws `Firebase is not configured` the moment it launches. Answering no writes nothing and prints the commands, including the `PATH` line that `dart pub global activate` needs and does not set.

Git and the GitHub Actions workflows are questions too, defaulted yes and no respectively, each with its reason next to it. The package manager is asked only when nothing else can say, which replaces a silent fallback to pnpm that was written into every script in the generated project.

**Breaking, and deliberately so: a run with no terminal now fails on an unanswered question instead of choosing for you.** The default that made this necessary is `--org`: a non-interactive run without it used to ship `com.example.my_game`, and Google Play makes that permanent at the first upload. A default is fine as the pre-filled answer to a question someone is looking at; it is not fine as a decision made in a pipe. The error prints the complete command to re-run with every default already filled in, so the fix is one paste and the value worth changing is visible in it.

`--ci` is gone. It read as "I am running in CI" — which is what it means in `npm ci`, in Jest, and in this CLI's own `isCI` check — while actually meaning "emit GitHub Actions workflows". It is now `--workflows` / `--no-workflows`, and the subcommand is `add workflows`. `add ci` still works, undocumented, because it is written into the README of every project already scaffolded.

Also adds `--version`, and stops asking about git at all when the destination is already inside a repository, since the scaffold declines to nest one there whatever it is told.
