# create-eigen-game

## 0.9.0

### Minor Changes

- [#41](https://github.com/eigeninteractive/eigen-server/pull/41) [`3f65f4c`](https://github.com/eigeninteractive/eigen-server/commit/3f65f4cfbf5f3092381f6864e79cbb09e8eba268) Thanks [@seenu-k](https://github.com/seenu-k)! - Ask, rather than assume: every decision a scaffold makes is now a question, and every question has exactly one flag that answers it.
  
  The run opens by saying what it is about to build and **why Firebase is part of it**: that the Worker verifies Firebase ID tokens to decide who holds a seat, that turn notifications go through the same project, that it is free and one project serves every game. A second service arriving unannounced in a scaffold looks like an imposition; the reason costs four lines and it is not.
  
  It then checks the two CLIs and the Google sign-in and reports **every** problem at once, in the order they have to be fixed in, rather than the first one. A machine with neither CLI used to learn about `flutterfire` only after installing `firebase-tools` and running the whole thing again. If anything is missing, the question is whether to scaffold anyway and connect Firebase later, and the default is **no**: the tools are two commands away, and the alternative is an app that throws `Firebase is not configured` the moment it launches. Answering no writes nothing and prints the commands, including the `PATH` line that `dart pub global activate` needs and does not set.
  
  Git and the GitHub Actions workflows are questions too, defaulted yes and no respectively, each with its reason next to it. The package manager is asked only when nothing else can say, which replaces a silent fallback to pnpm that was written into every script in the generated project.
  
  **Breaking, and deliberately so: a run with no terminal now fails on an unanswered question instead of choosing for you.** The default that made this necessary is `--org`: a non-interactive run without it used to ship `com.example.my_game`, and Google Play makes that permanent at the first upload. A default is fine as the pre-filled answer to a question someone is looking at; it is not fine as a decision made in a pipe. The error prints the complete command to re-run with every default already filled in, so the fix is one paste and the value worth changing is visible in it.
  
  `--ci` is gone. It read as "I am running in CI", which is what it means in `npm ci`, in Jest, and in this CLI's own `isCI` check, while actually meaning "emit GitHub Actions workflows". It is now `--workflows` / `--no-workflows`, and the subcommand is `add workflows`. `add ci` still works, undocumented, because it is written into the README of every project already scaffolded.
  
  An occupied destination is refused **before** the first question rather than by `scaffoldGame` after the last one. Being told the directory was taken after carefully giving an organization is the same insult as being told about `flutterfire` after two minutes of Flutter and pub. The message names the first three things standing in the way, which usually settles whether the path was mistyped or already scaffolded once, where "not empty" only invites an `ls`. There is deliberately no offer to delete it: every other question here is reversible and that one is not. A directory that exists and is *empty* is no longer refused at all, since people make one out of habit. A cloned repository is not that case: `.git` stands in the way like any other entry, and the message names it, so `git clone` then scaffold still means scaffolding beside it and moving the result in.
  
  Also adds `--version`, and stops asking about git at all when the destination is already inside a repository, since the scaffold declines to nest one there whatever it is told.

## 0.8.1

### Patch Changes

- [#38](https://github.com/eigeninteractive/eigen-server/pull/38) [`2ebb404`](https://github.com/eigeninteractive/eigen-server/commit/2ebb40408e785b3f904e34e50f0500cd3f9008d5) Thanks [@seenu-k](https://github.com/seenu-k)! - Generate the Worker's types against the wrangler a scaffold actually installed.
  
  Every scaffolded project opened its first `wrangler dev` with `❓ Your types might be out of date`. Nothing was: the `Env` interface was complete and correct, bindings and all. `worker-configuration.d.ts` is committed, and its second line stamps the workerd version that produced the runtime types. `wrangler` floats on a caret, Cloudflare ships workerd about weekly, and the copy in `templates/worker` was generated whenever this package was last built. Across three weeks of workerd releases the whole diff is that one comment line, byte-identical either side of it, and `wrangler dev` compares the line.
  
  So the scaffold now runs `cf-typegen` in `server/` immediately after installing its packages, against the wrangler that install just resolved rather than the one this package was built with, and the file lands correct in the scaffold commit.
  
  Left alone deliberately: `dev.generate_types`, which would have Wrangler rewrite the file mid-`dev` instead of mentioning it. It trades one warning per workerd release for one silent write to a tracked file per workerd release, on the command an implementor runs all day, and on a team, for that line flipping back and forth as each machine's wrangler resolves differently. A warning costs nothing to ignore; a dirty tree does not. `cf-typegen` is there for the implementor who wants it gone, and `typecheck` has always regenerated before `tsc`.

## 0.8.0

### Minor Changes

- [#36](https://github.com/eigeninteractive/eigen-server/pull/36) [`8cc9d6b`](https://github.com/eigeninteractive/eigen-server/commit/8cc9d6b3fdc996890c02af9baab8280de9ea10bc) Thanks [@seenu-k](https://github.com/seenu-k)! - Configure Firebase as part of scaffolding, and show the applicationId while asking for it.
  
  A scaffold now finishes with a runnable app. `firebase_options.dart` was a throwing placeholder until `firebase:configure` had been run, so the first `flutter run` ended at `Firebase is not configured`, a step that lived only in the README, which is read after the failure rather than before it. It runs before the scaffold commit, so `firebase.json`, `google-services.json`, the generated `firebase_options.dart` and `web/firebase-config.js`, and FlutterFire's two Gradle edits are committed with everything else instead of arriving as the project's first diff.
  
  Never at the cost of the scaffold. The two CLIs and the Google sign-in are checked *before* the two minutes of Flutter and pub, and anything missing, including no terminal to answer the project prompt on, turns the step off, names what is missing and the command that installs it, and leaves exactly the scaffold that `--no-firebase` produces. Failures during the step itself are treated the same way: the project is complete, the commit still happens, and the summary ends by naming `firebase:configure`.
  
  `--no-firebase` skips it. `--firebase-project <id>` names the project instead of being asked, which is also the form that works with no terminal attached.
  
  The organization prompt shows the `applicationId` each answer produces, rather than describing how one is derived, and says when that string is also what gets registered in Firebase. `--org com.acme.chess` for a game called `chess` reads like the whole identifier and is not: it yields `com.acme.chess.chess`, Google Play makes that permanent at the first upload, and FlutterFire matches an existing Android app on exactly that string.
  
  The CLI now speaks in one voice, through [`@clack/prompts`](https://github.com/bombshell-dev/clack). Each phase of a scaffold is a named step whose subprocess output is shown while it runs, cleared when it succeeds, and kept when it fails, so progress is visible, a failure is still debuggable from what is on screen, and a successful run no longer ends in several hundred lines of pub, Flutter and package-manager chatter nobody read. The organization question renders the game name dimmed after the cursor while it is typed, which is the part that made `com.acme.chess` become `com.acme.chess.chess`, and a pasted answer that repeats the game name is offered the shorter one. Ctrl-C at the prompt exits without writing anything.
  
  Two registers, chosen by clack's own `isTTY`/`isCI`: a pipe or a CI log gets every tool's output in full, since that is what a log is read for. A pty that reports itself as a terminal with no width (`script`, some container terminals) is given the 80 columns clack assumes for a stream with no width at all, because `0` satisfies its check and the box rules it draws from that width were killing a scaffold partway through with `RangeError: Invalid string length`.

## 0.7.3

### Patch Changes

- [#34](https://github.com/eigeninteractive/eigen-server/pull/34) [`905b841`](https://github.com/eigeninteractive/eigen-server/commit/905b841158238c21bd7086d9a73e23a7a0fb4ba3) Thanks [@seenu-k](https://github.com/seenu-k)! - Say in the generated README that `firebase:configure` asks which Firebase
  project to use, and how to name it up front with
  `run firebase:configure -- --project my-project-id`.

## 0.7.2

### Patch Changes

- [#32](https://github.com/eigeninteractive/eigen-server/pull/32) [`258c2d7`](https://github.com/eigeninteractive/eigen-server/commit/258c2d7c53f31dfcfa8fa22832f378c0eaf3c4be) Thanks [@seenu-k](https://github.com/seenu-k)! - Refresh the seed launcher icons and splash art to the current brand accent.
  
  The four files under `templates/app-overlay/assets/icon/` were byte-identical to
  the brand assets as they stood before the accent moved to the Material 3 primary
  generated from `Colors.teal`, so scaffolded games were getting a mark drawn in
  `#2F6B5E` while the app theme, the worker's pages and the docs had all moved to
  `#006A60` / `#82D5C8`. Ink and paper are unchanged; only the green moved.
  
  The generated `main.dart` also stopped overriding `Branding.seedColor` with
  `Colors.indigo`, which left a scaffolded app indigo while its own icon, splash
  and website were teal. It now takes the default, with a comment saying how to
  make it yours.
  
  Also adds a commented-out `site` block to the generated `src/index.ts`. Nothing
  in the generated code previously pointed at the configuration that turns on the
  legal documents, which the app stores require.

## 0.7.1

### Patch Changes

- [#29](https://github.com/eigeninteractive/eigen-server/pull/29) [`1ad506f`](https://github.com/eigeninteractive/eigen-server/commit/1ad506f197759a742ffa8552a4b9e5dbc941adb3) Thanks [@seenu-k](https://github.com/seenu-k)! - Emit `^0.2.2`, so a new project gets the engine release that carries the brand
  palette, the served faces and the local-D1 migration step.
  
  No behaviour changes here. The range a scaffolded project receives comes from
  this package's own `@eigeninteractive/server` devDependency, which pnpm rewrites
  to an exact version when it packs, deliberately, because that is the version CI
  compiled the templates against. The consequence is that the range only moves
  when this package is republished: 0.7.0 was packed against 0.2.1 and goes on
  emitting `^0.2.1` however many engine releases follow it, and pnpm will keep
  resolving that to 0.2.1 because it satisfies the range.
  
  So an engine release needs a scaffolder release behind it, or new projects
  quietly start on the previous engine.

## 0.7.0

### Minor Changes

- [#25](https://github.com/eigeninteractive/eigen-server/pull/25) [`1e8923e`](https://github.com/eigeninteractive/eigen-server/commit/1e8923e89b19cd2f0c9c4688b9a97f634508a12b) Thanks [@seenu-k](https://github.com/seenu-k)! - Give a generated project the lint, format and editor configuration the engine
  uses on itself.
  
  A scaffold shipped ninety files and no opinion about how they should be
  formatted, so every editor did something different to them and an implementor's
  first `format` would have rewritten code they never wrote. Projects now get
  `biome.json` with this repository's rules, `.editorconfig`, and a `.vscode/`
  that recommends the Biome extension and sets it as the formatter for the
  languages it owns. `lint` and `format` scripts run from the repository root,
  where Biome is installed. No language is exempted from formatting: nothing
  generated depends on a comment surviving in a file a formatter may rewrite.
  
  The Flutter half is excluded: `dart format` owns it.
  
  A test scaffolds a project and runs Biome inside it, so the generated files are
  held to the configuration they ship with. Its first run found two violations:
  in the `biome.json` this change adds.
  
  `pnpm-lock.yaml` at the root is no longer ignored. It described nothing when the
  root had no dependencies; now that it pins Biome, it is a lockfile like any
  other and is committed. Only the installed tree is ignored.

- [#24](https://github.com/eigeninteractive/eigen-server/pull/24) [`e3f94cd`](https://github.com/eigeninteractive/eigen-server/commit/e3f94cd70125b472cdee5ac5ba83fd6eaede3f5b) Thanks [@seenu-k](https://github.com/seenu-k)! - Apply the engine's D1 migrations to the local database before `wrangler dev`,
  and describe what pnpm's release quarantine actually does.
  
  A generated project's `dev` script started a Worker against an empty local D1,
  so the scheduled handler failed on its first run with
  `D1_ERROR: no such table: users` and again with `no such table: games`: two
  screens of stack trace before the first request, on a project that had done
  nothing wrong. `dev` now runs the new `db:migrate:local` script first, which is
  idempotent: it applies `0000_init.sql` once and does nothing thereafter.
  
  `pnpm-workspace.yaml` is now comments-free, and what it used to say has moved
  into `server/README.md`. The comment offered a commented-out
  `minimumReleaseAgeExclude` block to uncomment, which was wrong twice over: pnpm
  writes that key itself, directly above the comment explaining why it was
  commented out, and pins one exact version per entry so the exemption expires
  with the version instead of opening the whole scope. Prose in that file could
  not survive anyway, since pnpm rewrites it in place and a YAML formatter is free to
  move whatever is left. The README says what both keys are for, including the
  one place the release quarantine is silent: `pnpm create eigen-game`, where
  there is no manifest to record an exemption in.

## 0.6.0

### Minor Changes

- [#21](https://github.com/eigeninteractive/eigen-server/pull/21) [`a804fb0`](https://github.com/eigeninteractive/eigen-server/commit/a804fb0f4cbb2e614a5d30de2f590bc9b75362bc) Thanks [@seenu-k](https://github.com/seenu-k)! - End a scaffold with a summary rather than a single line, ignore what a root
  script leaves behind, and record in the generated `pnpm-workspace.yaml` what
  pnpm 11's `minimumReleaseAge` does to an engine release.
  
  A run prints several screens belonging to other tools (pnpm's `dlx` install,
  `flutter create`, pub, two icon generators, the server install) so `Created
  my-game in …` was indistinguishable from the noise above it. The summary names
  where the project went, whether the scaffold was committed, and the two files a
  game is written in: `server/src/module/v1.ts` and `app/lib/game/v1/rules.dart`.
  `ScaffoldResult` carries a `git` outcome so it reports rather than guesses.
  
  The root `package.json` declares no dependencies, only forwarding scripts into
  `server/` and `app/`, so the first `pnpm contract` left an untracked
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
  anyone whose organization sets that setting, since strict resolution then fails an
  install on the day an engine release ships instead of falling back, and the
  comment says so, next to the cost of excluding packages that execute during a
  build.

## 0.5.0

### Minor Changes

- [#19](https://github.com/eigeninteractive/eigen-server/pull/19) [`993883f`](https://github.com/eigeninteractive/eigen-server/commit/993883f8bb71ebfb36708e2badd7ae98859b7094) Thanks [@seenu-k](https://github.com/seenu-k)! - Initialise a git repository and commit the scaffold, and ask for the Android
  organization when it is not given.
  
  The scaffold runs `flutter_launcher_icons` and `flutter_native_splash`, which
  write generated-but-committed files across `android/`, `web/` and `assets/`.
  Without a first commit there is no baseline, so the first branding change is
  indistinguishable from the files the scaffolder happened to produce. `--no-git`
  opts out, and a scaffold created inside an existing checkout is left alone
  rather than given a nested repository.
  
  `--org` is now asked for interactively when omitted and there is a terminal,
  because it becomes the Android `applicationId`, which Google Play makes
  permanent at first upload. Both the flag and the answer are validated as
  reverse domain notation, so `com.example-games` fails at scaffold time rather
  than at the first Gradle build. An empty value still falls back to
  `com.example`, and non-interactive use is unchanged.

### Patch Changes

- [#19](https://github.com/eigeninteractive/eigen-server/pull/19) [`993883f`](https://github.com/eigeninteractive/eigen-server/commit/993883f8bb71ebfb36708e2badd7ae98859b7094) Thanks [@seenu-k](https://github.com/seenu-k)! - Use **EigenInteractive** as the product name throughout, matching the domain,
  the npm scope and the GitHub organization. Package descriptions, READMEs and
  the OpenAPI document title change; every identifier (`@eigeninteractive/*`,
  `eigen_flutter`, `create-eigen-game`, the `Eigen-Signature` header) is
  untouched.

## 0.4.0

### Minor Changes

- [#15](https://github.com/eigeninteractive/eigen-server/pull/15) [`4ef00fe`](https://github.com/eigeninteractive/eigen-server/commit/4ef00fea6e0e145ce22df646b6ceb575780315e5) Thanks [@seenu-k](https://github.com/seenu-k)! - Scaffolded games get a native release path and real branding: signing, R8 and
  obfuscation config, Fastlane, and launcher and splash icons generated and
  applied at scaffold time.
  
  GitHub Actions workflows are **opt-in**. `release.yml` needs an upload keystore
  and a Play service account that a new project does not have, so generating it
  by default put a failing build on `main` from the first push. Pass `--ci` at
  scaffold time, or run `create-eigen-game add ci` inside an existing project
  once you are ready to ship.
  
  Fixes template rendering corrupting binary files. `renderTree` read every file
  as UTF-8 and wrote it back, so any byte that is not valid UTF-8 became U+FFFD,
  and it walked the destination rather than the template, which for the app
  overlay meant rewriting everything `flutter create` had just produced. Every
  scaffolded project has been getting a damaged Gradle wrapper JAR and damaged
  launcher icons. Nothing caught it because the end-to-end check runs `flutter
  analyze`/`test`/`build web`, none of which read those bytes.
  
  Two edits to Flutter's own output are gone. The release signing config no
  longer prepends `import java.util.Properties`; parsing `key.properties` with
  the Kotlin stdlib needs no import, so the edit is append-only and cannot
  collide with what `flutterfire configure` writes. The notification icon and its
  Firebase meta-data now come from `eigen_flutter`'s Android plugin via manifest
  and resource merging, so the scaffold no longer writes a drawable or touches
  the app manifest at all.
  
  The pinned `eigen_flutter` range moves to `^0.3.0`, which is where the
  notification icon and its Firebase meta-data now live.

## 0.3.0

### Minor Changes

- [#11](https://github.com/eigeninteractive/eigen-server/pull/11) [`dc72d95`](https://github.com/eigeninteractive/eigen-server/commit/dc72d95bde0f48f16d8412c1223f9466ebfadc0a) Thanks [@seenu-k](https://github.com/seenu-k)! - Pair scaffolded projects with the current Flutter client, and release
  independently of the engine
  
  Generated apps now install `eigen_flutter@^0.2.0` rather than `^0.1.0`, so the
  two halves of a new project speak the same engine. `pnpm install` in the
  generated server also no longer fails on pnpm's ignored-build-scripts check.
  
  `create-eigen-game` has left the `fixed` changesets group and versions on its
  own from here, so a scaffolder fix no longer moves the engine packages onto a
  new version line. The engine range it emits now comes from the engine version
  its templates were compiled against rather than from its own version number,
  which is what made that group membership load-bearing.

## 0.2.0

### Minor Changes

- [#5](https://github.com/eigeninteractive/eigen-server/pull/5) [`ddd4893`](https://github.com/eigeninteractive/eigen-server/commit/ddd4893a7e45c743345adbd56dbc6870f6dbb042) Thanks [@seenu-k](https://github.com/seenu-k)! - Clean up public API surface
