---
"@eigeninteractive/server": minor
---

Erasure now outlives the provider. A notification arriving after
`DELETE /api/engine/me` — a cancellation, a refund, a final renewal — could
write a grant and a user id back for an account that asked to be forgotten:
the transaction was anonymized by the purge, but nothing stopped the ledger
from creating a fresh one. The ledger refuses to write for an account it
cannot find, and reads an already-anonymized transaction as erased rather than
as belonging to somebody else. The notification is still accepted and recorded
as handled, because refusing it would only have the provider redeliver it for
days against an account that is never coming back.

A creation that lost an allowance slot to another of the same account's
creations was reported as the allowance being spent. The guarded insert
signals the two on the same column and they mean opposite things — NOT NULL is
the insert declining to produce a slot because the allowance is gone, UNIQUE is
another write having taken the number first while there was still room — so an
account well under its limit could be told it had reached it. They are now
distinguished, and contention is retried rather than reported.

`entitlement_grants.user_id` is NOT NULL. It was nullable and never null: a
grant is only ever about a person, where a transaction is also a record of
money, so an erasure deletes grants rather than anonymizing them.
