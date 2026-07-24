# d1Schema

## Type Aliases

### BotType

```ts
type BotType = "engine" | "external" | "local";
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:135](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/server/src/d1/schema.ts#L135)

How a bot's moves are produced — the dispatch discriminator:
- `engine`: the brain ships in the game's `GameModule` as
  `GameRules.botActions[username]`, run in-process by the DO;
- `external`: the bot is hosted elsewhere and woken over HMAC (`webhook_url`
  is then required);
- `local`: client-driven (future offline-solo transcript import) — a
  registry row for identity only, never dispatched server-side.
Replaces the Supabase-era `is_local` boolean.

## Variables

### bots

```ts
const bots: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:141](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/server/src/d1/schema.ts#L141)

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

Defined in: [eigen-server/packages/server/src/d1/schema.ts:242](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/server/src/d1/schema.ts#L242)

FCM push targets, keyed by Firebase Installation ID — unchanged.

***

### games

```ts
const games: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:45](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/server/src/d1/schema.ts#L45)

The game summary/read-model row (created worker-direct, before the
DO exists;: updated post-commit from DO effects, accepted staleness).

***

### participants

```ts
const participants: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:93](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/server/src/d1/schema.ts#L93)

The roster join table — one row per seat, the indexed access path for
"games of user X" (ported from the Supabase era; the JSON-snapshot detour
was reverted 2026-07-17). Written at create/join/leave alongside the games
row; the DO's own roster remains the integrity copy. The game-scoped
unique indexes guard the join race exactly as the old schema did.

***

### playerRatings

```ts
const playerRatings: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:170](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/server/src/d1/schema.ts#L170)

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

Defined in: [eigen-server/packages/server/src/d1/schema.ts:207](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/server/src/d1/schema.ts#L207)

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

Defined in: [eigen-server/packages/server/src/d1/schema.ts:111](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/server/src/d1/schema.ts#L111)

Friends — canonical pair order (`user_id_1 < user_id_2`, worker-enforced)
+ UNIQUE, as the Supabase era had.

***

### users

```ts
const users: SQLiteTableWithColumns<{
}>;
```

Defined in: [eigen-server/packages/server/src/d1/schema.ts:26](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/server/src/d1/schema.ts#L26)

Merged users + user_profiles (the split served RLS separation that no
longer exists). Provisioned on first sight of a verified Firebase token;
`avatar_url` defaults to the provider photo (null ⇒ client renders
initials).
