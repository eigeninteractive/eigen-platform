---
"create-eigen-game": patch
---

Scaffold an optional `AUTH_DOMAIN`.

Web sign-in runs through Firebase's popup, which loads
`https://<authDomain>/__/auth/handler`, so Google's account chooser reads "Sign
in to continue to my-project.firebaseapp.com". `app-config.json` now carries an
`AUTH_DOMAIN` key and `main.dart` passes it to `EngineConfig.authDomain`. The
pinned `eigen_flutter` floor moves to `^0.4.1` for that parameter: additive, so
a patch pre-1.0, but the floor has to rise or a scaffold could resolve 0.4.0 and
fail to compile.

Empty is the scaffolded value and the right answer for almost every game: it
leaves sign-in on the Firebase project's own domain, which works everywhere and
needs no Firebase Hosting. Setting it is cosmetic and web-only, and it is not
`APP_HOST`: the value must be a Firebase Hosting domain, a sibling of the
Worker's host rather than the host itself.
