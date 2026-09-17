---
"create-eigen-game": patch
---

Pin `tmp` to `0.2.7` in a scaffolded game, for both npm (`overrides`) and pnpm (`pnpm-workspace.yaml`). `workbox-cli` pulls it in transitively through `inquirer` and `external-editor`, pinned at `^0.0.33`, a range that excludes the fixed version.
