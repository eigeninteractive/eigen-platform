---
"create-eigen-game": patch
---

Emit `^0.2.2`, so a new project gets the engine release that carries the brand
palette, the served faces and the local-D1 migration step.

No behaviour changes here. The range a scaffolded project receives comes from
this package's own `@eigeninteractive/server` devDependency, which pnpm rewrites
to an exact version when it packs — deliberately, because that is the version CI
compiled the templates against. The consequence is that the range only moves
when this package is republished: 0.7.0 was packed against 0.2.1 and goes on
emitting `^0.2.1` however many engine releases follow it, and pnpm will keep
resolving that to 0.2.1 because it satisfies the range.

So an engine release needs a scaffolder release behind it, or new projects
quietly start on the previous engine.
