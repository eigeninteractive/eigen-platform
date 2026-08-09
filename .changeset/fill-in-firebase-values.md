---
"create-eigen-game": patch
---

A scaffold now fills in the deployment values it already knows, instead of leaving four empty strings for the reader to chase.

- `app-config.json` ships with `API_BASE_URL` pointing at `http://localhost:8787`, so `pnpm dev` and `flutter run` agree with nothing edited.
- `FIREBASE_PROJECT_ID` is written into `server/wrangler.jsonc` from the project FlutterFire recorded, and `GOOGLE_WEB_CLIENT_ID` into `app-config.json` from the OAuth client Firebase created for it. Left empty, as `FIREBASE_PROJECT_ID` was before, every authenticated request answers 500.

The writing belongs to `eigen_flutter`'s `configure_firebase`, which this now invokes as `--worker ../server`, and which the generated `firebase:configure` script passes too. One implementation, so a project configured by re-running that command ends up exactly where a freshly scaffolded one does. It needs an `eigen_flutter` new enough to accept `--worker`.

What is left is what genuinely cannot be derived, and the closing summary lists exactly that: the Google sign-in provider when it is off, since the OAuth client does not exist until somebody enables it in the console, and `FIREBASE_VAPID_KEY`, which is a Web Push certificate the Firebase CLI does not serve. `WEB_APP_ORIGIN` was already defaulted to the port the scaffold trusts.
