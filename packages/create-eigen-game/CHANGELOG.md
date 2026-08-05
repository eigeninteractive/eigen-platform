# create-eigen-game

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
