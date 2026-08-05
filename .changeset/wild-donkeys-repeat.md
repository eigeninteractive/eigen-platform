---
"create-eigen-game": minor
---

Scaffolded games get a native release path and real branding: signing, R8 and
obfuscation config, Fastlane, a checks/release CI pair, and launcher, splash
and notification icons generated and applied at scaffold time.

Also fixes template rendering corrupting binary files. `renderTree` read every
file as UTF-8 and wrote it back, so any byte that is not valid UTF-8 became
U+FFFD. It walked the destination rather than the template, which for the app
overlay meant rewriting everything `flutter create` had just produced — a
scaffolded project's Gradle wrapper JAR and launcher PNGs have been arriving
damaged. Nothing caught it because the end-to-end check runs `flutter
analyze`/`test`/`build web`, none of which read those bytes.
