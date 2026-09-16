# 0013: the device replica and sync

- Status: proposed
- Date: 2026-09-16
- Amends: 0008's "Durable model", "Ordering rules", and "Offline behavior"
  sections; 0012's "The local engine and store" and "Synchronization"
  sections, and its statement of which web storage modes are available.

## Context

The application should feel like a native app rather than a web page in a
frame: it opens instantly, shows the player's games, history, ratings, profile,
and friends with no network, refreshes in the background and on pull-to-refresh,
and never polls. The web build is held to the same standard.

What exists falls short of that in structure, not only in coverage:

- Four providers (profile, player identity, friends, bot catalog) persist as
  opaque JSON snapshots through Riverpod's experimental `persist()`, in a `kv`
  table, versioned by hand-bumped `destroyKey`s and racing their own network
  fetch. Everything else is network-only: active games, history, ratings, and
  replays of online games.
- Screens fetch when they open. The home and history screens each merge the
  device's local games into the server's list by hand.
- A local game is one JSON document holding its whole transition log and every
  seat's frames, rewritten in full on every commit.
- 0008 describes a cold, stale-labelled session a game screen can open from.
  Nothing implements it: an online game cannot be opened offline at all.
- On the server, D1's summary mirror is written without being awaited, under a
  retry wrapper (`#mirrorD1`), as an unconditional update (`updateSummary`,
  `mirrorRoster`). An older write can therefore land after a newer one and
  regress the row.

The platform is in early development with no production games or users, so no
compatibility obligation constrains the design, on the device or on the wire.

## Decision

### The device holds a replica of the server's read model

The server already separates deciding from reading: a game's Durable Object
decides, and D1 is the read model every list is served from. The device gets
the same separation.

```text
writers                                    readers
sync pass (HTTP)       ─┐
open game coordinator  ─┼─► device replica ─► repositories ─► providers ─► screens
local engine commits   ─┘   (typed tables)     (live queries)
```

Screens read the replica only. No list, profile, rating, or replay reads the
network directly. Three writers fill it: the sync pass, the open game's
coordinator (its socket sessions, command responses, and gap recovery), and the
local engine. Opening a screen costs no request, and pull-to-refresh runs the
sync pass rather than invalidating a provider.

The open game is the one live path. Its coordinator (0008) remains the
serialized, in-memory authority for the `GameSession` stream the game screen
renders, because transition animation depends on applying frames one at a time
in order. It is seeded from the replica on a cold open and writes every session
it applies through to the replica, so leaving the game shows a current list with
no request.

### One revision orders every write to a game

A game's Durable Object already keeps a durable, monotonic `seq` in its `meta`,
advanced by every roster change, every commit, and the abort. `Session` carries
it. It becomes the game's revision everywhere:

- D1's `games` row stores the `seq` of the write that produced it, and
  `GameSummary` exposes it.
- Every D1 mirror write (the summary, the roster, the finish) MUST apply only when
  its `seq` is greater than the stored one. This closes the regression described
  above, and makes the mirror's retries safe in any order.
- Every device write to a game (a sync summary, a socket session, a command
  response, a local commit) MUST apply only when its `seq` is not older than the
  row's. Equal-`seq` writes carry the same header and are idempotent.

This replaces 0008's treatment of `streamSeq` as connection-local: the `seq`
the platform actually sends is per game and durable, so it orders writes across
connections and across sources. `version` continues to order frames.

A local game's row is written only by its engine. The device numbers a local
game's revisions itself, and the server numbers the imported copy's
independently, so the two are never compared. Sync may change a local game's
row in one way only: adopting a terminal status the server reached, such as the
abandoned-game reap, as 0012 already specifies.

### The schema mirrors the server's

The replica is a Drift database of generated, typed tables named after what they
mirror. Every table except `players`, `bots`, and `player_ratings` carries
`account_id` as its leading key, so an account's replica is exactly its own rows.

| Mirrors | Table | Holds |
| --- | --- | --- |
| D1 `users` | `accounts` | One row per account signed in on this device: email, `created_at` (the epoch, below), the finished-games cursor and history floor, `last_synced_at`. |
| D1 `users`, `bots` | `players` | Public identity for humans and bots, exactly the wire's `Player`. Shared across accounts. |
| D1 `bots` | `bots` | The bot catalog, including `type` and `tier`. Shared. |
| D1 `games` | `games` | The `GameSummary` header, `seq`, and `last_opened_at`. |
| D1 `participants` | `participants` | One row per seat. |
| D1 `player_ratings` | `player_ratings` | Display ratings per identity and pool. The account's own arrive by sync; another player's are stored when viewed. Shared. |
| D1 `rating_history` | `rating_history` | Every identity's rating change per finished rated game. |
| D1 `relationships` | `relationships` | Accepted friends and pending requests with their direction. |
| DO `frames` | `frames` | The account's own projection per game and version. |
| DO `meta` | `local_games` | Local games only: seed, `remote_created`, `synced_version`, `diverged`. |
| DO `transitions` | `transitions` | Local games only: seat, kind, action data, and the raw state at each version. |
| none | `commerce_deliveries` | The existing purchase-delivery outbox, unchanged. |

A session is not stored separately: it is a `games` row, its `participants`,
and the account's newest `frames` row, which is what the server's `Session`
carries.

`frames` holds only projections the server served this account, or, for a local
game, the projection of its one human seat; `transitions` holds raw state only
for local games, whose only human is the account. Nothing here exposes more than
0007 and 0012 already allow the principal to hold.

The database starts at schema version 1 under a new name. Nothing migrates from
the current `eigen_local` database: there are no users, and every row in it is
either a cache or a development local game.

### Package boundary

`eigen_client` owns the schema, the repositories that expose live queries as
streams, the sync pass, and the local engine's storage. Drift is pure Dart, so
the client core still depends on no Flutter, Riverpod, Firebase, navigation,
analytics, or widget package. Its tests run in plain Dart against an in-memory
database. The client accepts a Drift `QueryExecutor` and opens nothing itself.

`eigen_flutter` opens the executor for the platform, exposes repository streams
as providers, turns connectivity and foreground push messages into sync
triggers, and owns the web-only storage and locking behavior below.
`eigen_shell` renders.

Removed: Riverpod `persist()` and `@JsonPersist` on every provider, the `kv`
table and `DriftJsonStorage`, the `LocalGameStore` port and
`DriftLocalGameStore`, the JSON `LocalGameRecord` as a stored document, the
hand merges in the home and history lists, and `LocalSyncCoordinator` as a
separate trigger listener. Device preferences that are not server data (theme,
notification permission markers, the review prompt counter) stay in
`SharedPreferences`.

`LocalDatabase` currently avoids generated tables on the grounds that generation
would cost every consuming app a code generator. It does not: generated files
ship inside the published package, as this package's Riverpod `.g.dart` files
already do.

### Sync protocol

Data syncs according to its shape.

**Small sets are returned whole**: the profile, the account's ratings,
relationships, and every game still in play. A whole set shows removals without
tombstones, and two removals would otherwise be missed: unfriending deletes the
D1 relationship row, and leaving a waiting game rewrites the roster without the
player. On receiving the active set, the device removes the account's
non-terminal games that are absent from it and not present in the finished
results.

**Finished games are returned incrementally**, because they are the only set
that grows without bound, and a finished or aborted game does not change, so an
increment only adds.

The increment's cursor is `finish_seq`, a strictly increasing number D1 assigns
in the same batch that first moves a game to `finished` or `aborted` (the finish
apply and the terminal roster mirror alike) and never reassigns. A timestamp
cannot serve: `finishedAt` is chosen before the write commits, and these writes
commit out of order (the rating compare-and-swap retries, a crashed finish is
re-applied, and mirrors retry without being awaited). A device whose cursor had
passed a later timestamp would skip an earlier-stamped game forever. Display
order (finish time) and sync order (`finish_seq`) are therefore separate.

`GET /api/engine/me/sync?finishedAfter=<finish_seq>` answers, in one consistent
read:

- `account`: the profile, including `createdAt`;
- `ratings`, `relationships`, and `active` (with rosters), each whole;
- `finished`: games with `finish_seq` greater than `finishedAfter`, ascending,
  with rosters and rating changes, bounded per response with `hasMore`;
- `players`: the identity of every user and bot referenced by the above;
- `cursor`: the highest `finish_seq` included.

Without `finishedAfter`, as on a fresh device, `finished` is instead the newest
page in display order, `cursor` is the account's highest `finish_seq` read in the
same query, and a `floor` display cursor marks the oldest game returned. Scrolling
history past the floor calls
`GET /api/engine/me/games/finished?before=<floor>`, stores the page, and lowers
the floor. Every finished game is then reachable exactly once: above the cursor
through the increment, or at or below it through display-ordered paging.

The `me` list reads this route supersedes (the caller's games by bucket, ratings,
friends, and requests) are removed. Reads about other players stay. `GET /bots`
is unchanged and runs in the same pass, since the catalog is not per account.
Commerce access keeps its own reads: every action it gates needs the server
anyway.

**The epoch.** If `account.createdAt` differs from the stored value, the account
was deleted and re-provisioned (a swept guest keeps its Firebase uid, and the
auth middleware re-creates the `users` row on its next request). The device
deletes every row for that account and syncs from empty, rather than trusting a
cursor from an account that no longer exists.

**Identity.** Identities already stored refresh through the batch player lookup
when shown. An id the lookup no longer returns is removed from `players`, and its
seats render as deleted. This covers the one change a finished game does see:
account deletion removes the deleted user's identity from D1 without a new
`finish_seq`.

### The sync pass

One pass per account, single-flight, with two steps: upload the account's local
games (0012's create and append protocol, unchanged), then pull through
`/me/sync` until `hasMore` is false, and refresh the bot catalog. Each response
is written in one transaction.

The pass runs on:

- app start, once auth has resolved;
- resume;
- connectivity regained;
- pull-to-refresh on any list;
- a push message received while the app is in the foreground; and
- a local game finishing.

It never runs on a timer. A failed pass leaves the replica unchanged, and the
next trigger retries. Screens that show synced data state when it was last
synced.

`NotificationService` exposes only notification taps today. It gains a stream of
messages received in the foreground, and the Firebase adapter implements it.

### Local games

A local game is stored as every game is (a `games` row and its `participants`)
plus `local_games` and `transitions`. A commit is one transaction that appends the
transition, appends the human seat's frame, and updates the `games` row: the
device's Durable Object commit and its D1 mirror in one atomic step, which the
device can do and the server cannot.

Bot seats' observations are not stored. The engine computes them from the state
it holds when a brain runs, as it already does when rebuilding a record pulled
from another device.

Upload reads `transitions` after `synced_version`. Resuming on another device
writes the pulled log into the same tables.

### What the player sees offline

- A **local game** plays from its engine and never consults connectivity.
- An **online game** opens from the replica, labelled stale until its socket
  confirms it. With no connection its board is read-only, marked with the time it
  was last current, and its controls are disabled.
- An online game **never opened on this device** shows its header and roster;
  the board needs a connection.
- A **finished game** replays from `frames`. A replay needs every version from 0
  to the final one; missing ranges are fetched and stored. Frames of finished
  online games are evicted least-recently-opened under a storage budget. Frames
  of games still in play, and of local games, are never evicted.
- Actions that need the server (the lobby, joining, creating an online game,
  friend requests) are disabled with the reason shown. The lobby and friends' open
  games are not replicated, because a list of games joinable now is wrong as soon
  as it is stale.

Connectivity is the platform's reported network state (`connectivity_plus`),
not reachability. It triggers the sync pass, drives one neutral offline
indicator, and disables server-only actions. A network that reports connected
without reaching the internet costs only a failed pass, which changes nothing.

### Accounts

Signing out keeps an account's rows, so signing back in is instant and works
offline. Deleting the account deletes them, including its local games. An epoch
mismatch deletes them and resyncs. `players`, `bots`, and `player_ratings` are
public and shared by every account on the device.

### Web

The same code runs. Three things differ.

**Storage mode.** The shell cannot send the cross-origin isolation headers,
because they break the sign-in popup, so Drift chooses among `opfsShared`
(currently Firefox only), `sharedIndexedDb` (needs shared workers),
`unsafeIndexedDb` (no shared workers, and documented as unsafe for more than one
tab), and an in-memory fallback. This corrects 0012, which named lock-based OPFS
as available: that mode requires the isolation headers.

- Under `unsafeIndexedDb`, a tab MUST hold an exclusive Web Lock on the database
  for its lifetime, and a second tab says the app is open elsewhere.
- Under the in-memory fallback nothing survives a reload, so the app says so and
  does not offer local play.

**Concurrency.** Every sync pass and every local game's engine runs under a Web
Lock named for the account or the game, so two tabs sharing a database never
sync at once or play one local game twice.

**Eviction.** A browser may clear site storage. Replicated rows recover through
the next sync; unsynchronized local games cannot. The app requests persistent
storage (`navigator.storage.persist()`) when the first local game is created.

The offline service worker is unchanged.

## Invariants

Unchanged: one Durable Object is authoritative for each game; D1 is a registry
and read model; the TypeScript rules decide what the server records; the client
never decides the validity of an online game; there is no durable offline command
queue (0009).

New:

- Screens read the replica. Only the open game's coordinator consumes the
  network directly, and it writes through.
- Every write to a game, in D1's mirror and on the device, is ordered by the
  game's `seq`. A local game's row is ordered by its engine alone.
- The replica holds what the server served the account, plus raw state for local
  games only.

## Testing

- `eigen_client`, in plain Dart on an in-memory database: an older write is
  ignored from every source; the active set removes a game the account left;
  finished increments are idempotent and resume from the cursor; the first sync's
  cursor and floor miss no game committed out of order; an epoch mismatch empties
  the account; a local commit is atomic; upload resumes from `synced_version`;
  replay fills a missing frame range.
- Server: `finish_seq` is assigned once and increases in commit order, for aborts
  as well as finishes; a mirror write carrying an older `seq` changes nothing,
  which is today's regression; `/me/sync` returns a cursor and floor consistent
  with its page; the backfill pages without gaps or repeats.
- Drift schema dumps are generated and checked, so every later schema change
  ships a tested migration.
- The scaffold's web build check continues to assert the offline assets, and adds
  the Drift worker the replica needs.

## Delivery

1. Server: `seq` on D1 games and `GameSummary`, guarded mirror writes,
   `finish_seq`, `/me/sync`, the finished backfill, removal of the superseded
   reads, and the regenerated OpenAPI and Dart client.
2. `eigen_client`: the schema, repositories, and sync pass; the local engine on
   tables; removal of `LocalGameStore` and the stored JSON record.
3. `eigen_flutter`: the executor, stream providers, sync triggers including
   foreground push, web locks and the persistence request; removal of `persist()`
   and `kv`.
4. `eigen_shell`: every screen on the replica, offline states, history over the
   local query with backfill, and the neutral offline indicator.
5. Documentation: `how-it-works/storage.md`, `how-it-works/the-client-app.md`
   (whose persistence section already describes a storage engine and expiry
   policy that no longer exist), and the sync section of
   `build-a-game/offline-play.md`.

## Open questions

- The frame storage budget, and whether an app configures it.
- The active set is returned whole. A product that lets one account hold hundreds
  of open games would need it paged.
- Other players' rating history is not replicated.
- Sync while the app is closed (Android background work, web periodic
  background sync) is deferred until a measured need.
