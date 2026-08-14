---
"@eigeninteractive/server": patch
"@eigeninteractive/kernel": patch
---

Store command results as principal-scoped Durable Object receipts, and derive the
deadline alarm from committed state.

A retry carrying the same `(principal, commandId)` and the same canonical RFC 8785
request replays the committed result; the same id carrying different intent is
refused as `commandConflict` rather than guessed at. Receipts survive finish and
cancel compaction. Identity-less system commands, such as a deadline timeout,
store no receipt: they are idempotent because the kernel abstains once the state
they were derived from has moved on.

`CommitPlan.alarm` is gone. The host now derives the alarm from the committed
deadline with the new `alarmForDeadline` helper and reconciles it after every
command, so a `setAlarm` lost after its deadline committed repairs itself without
a player having to act.

Pre-production storage break: the Durable Object `commands` table is redefined in
the initial migration rather than migrated forward. Discard local development
state (`rm -rf .wrangler`) before running against it.
