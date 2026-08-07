---
"create-eigen-game": patch
---

Refresh the seed launcher icons and splash art to the current brand accent.

The four files under `templates/app-overlay/assets/icon/` were byte-identical to
the brand assets as they stood before the accent moved to the Material 3 primary
generated from `Colors.teal`, so scaffolded games were getting a mark drawn in
`#2F6B5E` while the app theme, the worker's pages and the docs had all moved to
`#006A60` / `#82D5C8`. Ink and paper are unchanged; only the green moved.

The generated `main.dart` also stopped overriding `Branding.seedColor` with
`Colors.indigo`, which left a scaffolded app indigo while its own icon, splash
and website were teal. It now takes the default, with a comment saying how to
make it yours.

Also adds a commented-out `site` block to the generated `src/index.ts`. Nothing
in the generated code previously pointed at the configuration that turns on the
legal documents, which the app stores require.
