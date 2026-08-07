---
"create-eigen-game": minor
---

Configure Firebase during scaffolding, with `--firebase` or `--firebase-project <id>`.

It runs before the scaffold commit, so `firebase.json`, `google-services.json`, the generated `firebase_options.dart` and `web/firebase-config.js`, and FlutterFire's two Gradle edits are committed with everything else rather than arriving as the project's first diff. Opt-in, because it is the one step that reaches outside the destination directory — it registers apps in a Google account, and needs two globally installed CLIs and a browser login that nothing else here does. A failure leaves exactly what a scaffold without the flag produces, and the commit still happens.

The closing summary now names `firebase:configure` among the things to run next, until the scaffold has done it. The app throws `Firebase is not configured` at launch until it has run once, and the step lived only in the README, which is read after the failure.

The organization prompt shows the `applicationId` each answer produces, rather than describing how one is derived. `--org com.acme.chess` for a game called `chess` reads like the whole identifier and is not — it yields `com.acme.chess.chess`, and Google Play makes that permanent at the first upload.
