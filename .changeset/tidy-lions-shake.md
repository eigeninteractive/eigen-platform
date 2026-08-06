---
"create-eigen-game": minor
---

Initialise a git repository and commit the scaffold, and ask for the Android
organization when it is not given.

The scaffold runs `flutter_launcher_icons` and `flutter_native_splash`, which
write generated-but-committed files across `android/`, `web/` and `assets/`.
Without a first commit there is no baseline, so the first branding change is
indistinguishable from the files the scaffolder happened to produce. `--no-git`
opts out, and a scaffold created inside an existing checkout is left alone
rather than given a nested repository.

`--org` is now asked for interactively when omitted and there is a terminal,
because it becomes the Android `applicationId` — which Google Play makes
permanent at first upload. Both the flag and the answer are validated as
reverse domain notation, so `com.example-games` fails at scaffold time rather
than at the first Gradle build. An empty value still falls back to
`com.example`, and non-interactive use is unchanged.
