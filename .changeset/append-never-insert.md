---
"create-eigen-game": patch
---

Give the three edits into files the scaffolder does not own one shared whitespace
rule, and write down the doctrine they follow.

`enableAndroidCoreLibraryDesugaring`, `enableAndroidReleaseSigning` and
`configureLauncherIconsAndSplash` each append a block to a file `flutter create`
produced. All three normalised newlines themselves, with two different answers,
so the desugaring block got a blank line before it and the other two did not: in
a generated project the two Gradle blocks ended up flush against each other.
`appendBlock` now owns that and nothing else, one blank line before and one
newline after, with the block constants carrying neither, and the scaffold test
pins the separation rather than only the contents.

No behavioural change beyond the whitespace of generated `build.gradle.kts` and
`pubspec.yaml`. A comment claiming the release-signing block still prepends a
Kotlin `import` was also stale, describing an edit removed when it broke under
AGP 9, and said the opposite of the rule it sat next to.

MAINTAINERS.md gains **Editing files the scaffolder does not own**: append never
insert, why every block is recognised by a content probe on its own payload, and
why FlutterFire's `// START:`/`// END:` marker comments are deliberately not
copied. Those markers are attribution rather than machinery, never read back by
`flutterfire_cli` itself, and an append needs no anchor; the one condition that
would earn a marker pair is a block whose content must be found and replaced on a
later run, which is an upgrade command's problem and not one that exists yet. It
also records that configuration values are assigned into declared slots instead,
and the JSON-versus-JSONC rule that governs how.
