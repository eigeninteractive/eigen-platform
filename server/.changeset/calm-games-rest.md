---
"@eigeninteractive/server": patch
---

Commit an aborted game's terminal status, monotonic session sequence, and
live-data compaction in one Durable Object SQLite transaction. Repeated aborts
now return the exact retained terminal sequence instead of announcing an
unpersisted increment.
