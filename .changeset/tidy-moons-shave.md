---
"create-eigen-game": minor
---

Configure Firebase as part of scaffolding, and show the applicationId while asking for it.

A scaffold now finishes with a runnable app. `firebase_options.dart` was a throwing placeholder until `firebase:configure` had been run, so the first `flutter run` ended at `Firebase is not configured` — a step that lived only in the README, which is read after the failure rather than before it. It runs before the scaffold commit, so `firebase.json`, `google-services.json`, the generated `firebase_options.dart` and `web/firebase-config.js`, and FlutterFire's two Gradle edits are committed with everything else instead of arriving as the project's first diff.

Never at the cost of the scaffold. The two CLIs and the Google sign-in are checked *before* the two minutes of Flutter and pub, and anything missing — including no terminal to answer the project prompt on — turns the step off, names what is missing and the command that installs it, and leaves exactly the scaffold that `--no-firebase` produces. Failures during the step itself are treated the same way: the project is complete, the commit still happens, and the summary ends by naming `firebase:configure`.

`--no-firebase` skips it. `--firebase-project <id>` names the project instead of being asked, which is also the form that works with no terminal attached.

The organization prompt shows the `applicationId` each answer produces, rather than describing how one is derived, and says when that string is also what gets registered in Firebase. `--org com.acme.chess` for a game called `chess` reads like the whole identifier and is not — it yields `com.acme.chess.chess`, Google Play makes that permanent at the first upload, and FlutterFire matches an existing Android app on exactly that string.
