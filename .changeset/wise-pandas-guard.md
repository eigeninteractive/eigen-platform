---

---

Repository tooling only. A test asserts the templates carry no file named
`biome.json`, which Biome loads as a nested root configuration and then refuses
to run — the language server included, silently.

Nothing published changes: the scaffolder already ships the config as
`biome.json.template` and strips the suffix when rendering.
