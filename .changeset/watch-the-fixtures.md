---
"create-eigen-game": patch
---

`test:watch` now reruns when you edit only a fixture. It did not before, and the failure was silent: you saved a case, nothing happened, and the suite you were watching kept reporting the last result.

The cause is that `twinFixtureTests` reads fixtures with `readFileSync` at collect time, so they are not in Vite's module graph. Vitest looks a changed path up in that graph, finds nothing, checks whether the file is itself a test file, and reruns nothing. Fixture JSON was never even watched, since Vitest only adds paths outside the graph to its watcher when a trigger glob names them.

A scaffold therefore now ships `server/vitest.config.mts` carrying one option:

```ts
forceRerunTriggers: [...configDefaults.forceRerunTriggers, "**/src/module/fixtures/**/*.json"],
```

This is what `forceRerunTriggers` is for. Vitest's own defaults use it for `package.json` and the config files, which are read outside the graph for the same reason, and it appends `setupFiles` and `snapshotSerializers` to the same list.

Two things worth keeping if you edit the file. Spread the defaults rather than replacing them, because config resolution is a shallow merge and a bare array quietly stops manifest and config edits from triggering a rerun. And leave the trigger off any `@cloudflare/vitest-pool-workers` project you add later: a match reruns the whole suite, which costs nothing for pure-Node tests and is not free for workerd, where a fixture cannot change the result anyway.
