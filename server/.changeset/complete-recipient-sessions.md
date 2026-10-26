---
"@eigeninteractive/server": patch
"create-eigen-game": patch
---

Return complete sessions projected for the authenticated recipient on every accepted command, including starts and offline bot transitions. Preserve outcomes on rating transitions so HTTP, socket and cold reads agree at the same sequence. Remove the redundant solo-start read.

Update scaffold dependencies, use Workbox's supported Node build API without the vulnerable CLI watcher dependency, and let Pub resolve the Firebase Core version compatible with the selected adapter.
