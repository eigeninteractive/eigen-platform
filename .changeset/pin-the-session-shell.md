---
"create-eigen-game": minor
---

Generated apps now install `eigen_flutter@^0.4.0`, the first shell that speaks the engine's session-snapshot wire.

This pin is usually only an improvement deferred until a human confirms the templates still compile, but not this time. A scaffold writes both halves of a project, and the worker half is this repository's own line, so the shell it installs has to read that line's socket. Every published `eigen_flutter` 0.3.x constrains `eigen_api: ^0.2.0`, which cannot decode a 0.3.x engine's session at all, so a scaffold left on the old pin would resolve cleanly, compile cleanly, and then fail to render a game on first run.

The **Scaffolded project builds** job asserts both halves of the claim, and this is exactly the release where the two come apart: `flutter analyze` and `flutter test` cover the Dart API, which never broke here (the templates read `GameContentContext`, and 0.4.0 only added a field to it), while the `eigen_api` line check off the generated `pubspec.lock` covers the wire, which is the half that did.
