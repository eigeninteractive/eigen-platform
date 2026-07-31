# doSchema

## Variables

### commands

```ts
const commands: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/do/schema.ts:88](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/do/schema.ts#L88)

`commandId → response` dedupe: a duplicate replays the stored
response instead of double-applying. Deleted by the finish compaction.

***

### frames

```ts
const frames: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/do/schema.ts:74](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/do/schema.ts#L74)

Per-seat projected frames, identified seats only — LIVE-ONLY: serves
socket gap recovery and the same-view compare, then the finish
compaction empties the whole table (replay re-projects instead).
A separate table so compaction never touches `transitions`.

***

### meta

```ts
const meta: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/do/schema.ts:23](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/do/schema.ts#L23)

The game row snapshot from lazy init + status + rng_seed. Exactly
one row, `id = 1`. The DO copies this from D1 once and owns `status` and
`rng_seed` from then on; D1's copy becomes the display read-model.

***

### outbox

```ts
const outbox: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/do/schema.ts:97](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/do/schema.ts#L97)

What the D1 apply needs, written atomically with the finish and
cleared only AFTER the apply succeeds — a surviving row is the recovery
signal for the gated admin re-poke.

***

### roster

```ts
const roster: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/do/schema.ts:44](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/do/schema.ts#L44)

Seats. Both ids null ⇒ account purged mid-game (plays on as "Deleted
User", can never act).

***

### transitions

```ts
const transitions: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/do/schema.ts:58](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/do/schema.ts#L58)

One row per version — the single-row transition shape, and it is
**append-only immutable**: no transition row is ever updated after commit,
which is what makes this table the game's permanent history verbatim.
The engine-owned envelope is the row's typed columns; `state` is the
game's opaque payload, parsed through the version's schema before any
hook sees it. Serves live gap recovery and post-finish replay
(re-projected via `computeObservation`).
