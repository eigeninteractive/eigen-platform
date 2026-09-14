---
"create-eigen-game": patch
---

Install `eigen_shell` 0.2.0 and `eigen_firebase` 0.3.0 in a newly scaffolded
project, and check every floor against the registry from now on.

Both packages released with offline play, and the scaffolder's floors still
named the lines they had left, so a fresh project installed a shell two lines
behind the templates written against it.

`scaffold-e2e.mjs` already refused to let `flutterClientVersion` go stale, but
only through the wire pairing, which `eigen_shell`, `eigen_firebase` and
`eigen_codegen` cannot answer: they carry no `eigen_api` constraint. Every floor
the scaffolder emits is now compared with the newest published line of the
package it names, which has no window where it is expected to be red — while a
release is in flight pub.dev still serves the line the floor names.
