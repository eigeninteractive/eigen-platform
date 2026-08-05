---
"create-eigen-game": minor
---

Scaffolded games get a native release path and real branding: signing, R8 and
obfuscation config, Fastlane, and launcher and splash icons generated and
applied at scaffold time.

GitHub Actions workflows are **opt-in**. `release.yml` needs an upload keystore
and a Play service account that a new project does not have, so generating it
by default put a failing build on `main` from the first push. Pass `--ci` at
scaffold time, or run `create-eigen-game add ci` inside an existing project
once you are ready to ship.

Fixes template rendering corrupting binary files. `renderTree` read every file
as UTF-8 and wrote it back, so any byte that is not valid UTF-8 became U+FFFD,
and it walked the destination rather than the template — which for the app
overlay meant rewriting everything `flutter create` had just produced. Every
scaffolded project has been getting a damaged Gradle wrapper JAR and damaged
launcher icons. Nothing caught it because the end-to-end check runs `flutter
analyze`/`test`/`build web`, none of which read those bytes.

Two edits to Flutter's own output are gone. The release signing config no
longer prepends `import java.util.Properties` — parsing `key.properties` with
the Kotlin stdlib needs no import, so the edit is append-only and cannot
collide with what `flutterfire configure` writes. The notification icon and its
Firebase meta-data now come from `eigen_flutter`'s Android plugin via manifest
and resource merging, so the scaffold no longer writes a drawable or touches
the app manifest at all.

The pinned `eigen_flutter` range moves to `^0.3.0`, which is where the
notification icon and its Firebase meta-data now live.
