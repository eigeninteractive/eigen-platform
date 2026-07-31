# d1Schema

## Type Aliases

### BotType

```ts
type BotType = "engine" | "external" | "local";
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:137](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/d1/schema.ts#L137)

How a bot's moves are produced — the dispatch discriminator:
- `engine`: the brain ships in the game's `GameModule` as
  `GameRules.botActions[username]`, run in-process by the DO;
- `external`: the bot is hosted elsewhere and woken over HMAC (`webhook_url`
  is then required);
- `local`: client-driven (future offline-solo transcript import) — a
  registry row for identity only, never dispatched server-side.

## Variables

### bots

```ts
const bots: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:143](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/d1/schema.ts#L143)

Bot registry. `type` selects the dispatch path; `webhook_url` is
required for (and only for) `external`. `username` is the stable,
human-readable key the game's `botActions` map is keyed by for `engine`
bots.

***

### deviceInstallations

```ts
const deviceInstallations: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:244](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/d1/schema.ts#L244)

FCM push targets, keyed by Firebase Installation ID.

***

### games

```ts
const games: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:47](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/d1/schema.ts#L47)

The game summary/read-model row (created worker-direct, before the
DO exists;: updated post-commit from DO effects, accepted staleness).

***

### participants

```ts
const participants: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:94](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/d1/schema.ts#L94)

The roster join table — one row per seat, and the indexed access path for
"games of user X". Written at create/join/leave alongside the games row; the
DO's own roster remains the integrity copy. The game-scoped unique indexes
are what actually guard the join race.

***

### playerRatings

```ts
const playerRatings: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:172](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/d1/schema.ts#L172)

Per-identity per-pool OpenSkill rating. Exactly one of user_id/bot_id is
set. `revision` is the CAS counter: the finish apply reads
(mu, sigma, revision), computes in TS, and writes a `rating_history` row
stamped with the revision it read — whose UNIQUE index is what rejects a
concurrent finish (see `rating_history.revision_before`). The fix for the
legacy concurrent-finish lost-update bug.

***

### ratingHistory

```ts
const ratingHistory: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:209](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/d1/schema.ts#L209)

Immutable per-game rating log for the profile history screen — and the
concurrency control for rating writes.

Two unique indexes, guarding two different races:

- `(game_id, identity)` — idempotence. A re-poked apply for the SAME game
  cannot double-write. Paired with `finish_id`.
- `(identity, pool, revision_before)` — the CAS. Two finishes of DIFFERENT
  games sharing a player both read revision 7 and both try to log
  `revision_before = 7`; the second violates this index, its batch rolls
  back, and the apply recomputes against fresh priors. This is what makes
  the lost update impossible.

The CAS lives here rather than on the `player_ratings` UPDATE because
SQLite has no in-transaction abort primitive to reach for: an
`UPDATE ... WHERE revision = ?` that matches nothing silently succeeds,
so a guard there would let the other statements in the batch commit
against stale priors. A unique-index violation is an error, and an error
is what rolls a `batch()` back.

***

### relationships

```ts
const relationships: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:113](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/d1/schema.ts#L113)

Friends and blocks — one row per pair, in canonical order
(`user_id_1 < user_id_2`, worker-enforced) + UNIQUE, so a relationship can
never exist twice in opposite orientations.

***

### users

```ts
const users: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:28](https://github.com/eigeninteractive/eigen-server/blob/2ab21e75f9bf5968648e6bdb0a54bf7d33c9869b/packages/server/src/d1/schema.ts#L28)

One row per identity, public and private fields together — authorization is
enforced in the routes, not by table separation. Provisioned on first sight
of a verified Firebase token; `avatar_url` defaults to the provider photo
(null ⇒ client renders initials).
