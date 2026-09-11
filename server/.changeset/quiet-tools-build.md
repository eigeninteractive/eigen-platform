---
"create-eigen-game": patch
---

Approve the required esbuild and workerd install scripts and decline fsevents'
unnecessary fallback build in generated npm projects, keeping scaffolding
warning-free on npm 11 and compatible with npm 12's default-deny install
policy.
