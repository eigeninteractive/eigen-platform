---
"@eigeninteractive/rules": minor
"@eigeninteractive/kernel": minor
"@eigeninteractive/server": minor
"@eigeninteractive/testkit": minor
---

Simplify the pre-production engine contract around server-authoritative game
creation, contiguous game versions, operation-specific mutation correctness,
and short-lived WebSocket tickets. New games now use exactly the latest rules
version; the capabilities endpoint and generic command-receipt protocol are
removed. Rules declare allowed timing policies, and the kernel fixes charging
and deadline-alarm behavior across timed transitions. Unknown public game IDs
are rejected from the retained D1 registry before a Durable Object is derived
or woken. Game and external-bot JSON bodies are capped at 64 KiB, and the
server-only WebSocket closes clients that send application messages.

Build all public TypeScript packages with tsdown, including declaration maps,
from their own package dependencies rather than cross-workspace `node_modules`
paths.
