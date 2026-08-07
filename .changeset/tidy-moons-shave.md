---
"create-eigen-game": minor
---

Configure Firebase as part of scaffolding, and show the applicationId while asking for it.

A scaffold now finishes with a runnable app. `firebase_options.dart` was a throwing placeholder until `firebase:configure` had been run, so the first `flutter run` ended at `Firebase is not configured` — a step that lived only in the README, which is read after the failure rather than before it. It runs before the scaffold commit, so `firebase.json`, `google-services.json`, the generated `firebase_options.dart` and `web/firebase-config.js`, and FlutterFire's two Gradle edits are committed with everything else instead of arriving as the project's first diff.

Never at the cost of the scaffold. The two CLIs and the Google sign-in are checked *before* the two minutes of Flutter and pub, and anything missing — including no terminal to answer the project prompt on — turns the step off, names what is missing and the command that installs it, and leaves exactly the scaffold that `--no-firebase` produces. Failures during the step itself are treated the same way: the project is complete, the commit still happens, and the summary ends by naming `firebase:configure`.

`--no-firebase` skips it. `--firebase-project <id>` names the project instead of being asked, which is also the form that works with no terminal attached.

The organization prompt shows the `applicationId` each answer produces, rather than describing how one is derived, and says when that string is also what gets registered in Firebase. `--org com.acme.chess` for a game called `chess` reads like the whole identifier and is not — it yields `com.acme.chess.chess`, Google Play makes that permanent at the first upload, and FlutterFire matches an existing Android app on exactly that string.

The CLI now speaks in one voice, through [`@clack/prompts`](https://github.com/bombshell-dev/clack). Each phase of a scaffold is a named step whose subprocess output is shown while it runs, cleared when it succeeds, and kept when it fails — so progress is visible, a failure is still debuggable from what is on screen, and a successful run no longer ends in several hundred lines of pub, Flutter and package-manager chatter nobody read. The organization question renders the game name dimmed after the cursor while it is typed, which is the part that made `com.acme.chess` become `com.acme.chess.chess`, and a pasted answer that repeats the game name is offered the shorter one. Ctrl-C at the prompt exits without writing anything.

Two registers, chosen by clack's own `isTTY`/`isCI`: a pipe or a CI log gets every tool's output in full, since that is what a log is read for. A pty that reports itself as a terminal with no width — `script`, some container terminals — is given the 80 columns clack assumes for a stream with no width at all, because `0` satisfies its check and the box rules it draws from that width were killing a scaffold partway through with `RangeError: Invalid string length`.
