---
"@eigeninteractive/rules": minor
"@eigeninteractive/server": minor
---

Add the optional provider-neutral commerce runtime: fixed access capabilities,
registered content, entitlements, commercial limits, verified transaction and
webhook ingestion, restoration, reconciliation, and atomic creation usage.

Game creation now requires a stable `creationId`. Retrying the same normalized
create returns the original game; reusing that identity for different inputs is
rejected. Rules may declare selected commercial content through the pure
`contentForCreate` hook.
