---
---

Repository tooling only. `rules`, `kernel` and `testkit` move their tsup flags
from the build script into a `tsup.config.ts`, and every library gains a `dev`
script running `tsup --watch` for working against a linked game checkout.

Deliberately unreleased: the workspace was built with the old scripts and with
the new config and every file in every `dist` compared, byte for byte. Nothing
a consumer can observe has changed.
