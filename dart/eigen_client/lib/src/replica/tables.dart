import 'package:drift/drift.dart';

import 'converters.dart';

// The device replica's tables (decision 0013), named after what they mirror.
//
// Every table but `players`, `bots` and `player_ratings` leads its key with
// `account_id`, so one account's replica is exactly its own rows: signing out
// leaves them, deleting the account deletes them, and a second account on the
// same device never reads them. The three that do not are public reference data
// every account on the device shares.

/// One row per account signed in on this device: the private half of its
/// profile, and where its sync stands. Mirrors D1 `users`.
@DataClassName('AccountRow')
class Accounts extends Table {
  TextColumn get id => text()();
  TextColumn get email => text().nullable()();

  /// When the server created the account. It changes only when the account was
  /// deleted and created again under the same id, which is what tells the
  /// replica its rows describe an account that no longer exists.
  IntColumn get createdAt => integer()();

  /// The `finishSeq` the next sync asks after, or null before the first sync.
  IntColumn get finishedCursor => integer().nullable()();

  /// Where older history continues, or null when none remains to fetch.
  TextColumn get historyFloor => text().nullable()();

  /// How current the replica is, in epoch milliseconds: when the last completed
  /// sync began pulling.
  IntColumn get lastSyncedAt => integer().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

/// Public identity, humans and bots alike, exactly the wire's `Player`.
/// Mirrors D1 `users`.
@DataClassName('PlayerRow')
class Players extends Table {
  TextColumn get id => text()();
  TextColumn get username => text()();
  TextColumn get displayName => text()();
  TextColumn get avatarUrl => text().nullable()();
  BoolColumn get isAnonymous => boolean()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

/// The bot catalog. Mirrors D1 `bots`, minus what never leaves the server.
@DataClassName('BotRow')
class Bots extends Table {
  TextColumn get id => text()();
  TextColumn get username => text()();
  TextColumn get displayName => text()();
  TextColumn get avatarUrl => text().nullable()();
  IntColumn get schemaVersion => integer()();
  TextColumn get type => text().map(botTypeConverter)();
  BoolColumn get ratedEligible => boolean()();
  TextColumn get config => text().map(const JsonObjectConverter())();
  TextColumn get tier => text()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

/// One game an account holds a seat in: the wire's `GameSummary` header.
/// Mirrors D1 `games`.
@DataClassName('GameRow')
@TableIndex(name: 'idx_games_account_status', columns: {#accountId, #status})
class Games extends Table {
  TextColumn get accountId => text()();
  TextColumn get id => text()();

  /// The game's revision. A write carrying an older one changes nothing.
  IntColumn get seq => integer()();
  TextColumn get createdBy => text().nullable()();
  TextColumn get status => text().map(gameStatusConverter)();
  TextColumn get access => text().map(gameAccessConverter)();
  TextColumn get origin => text().map(gameOriginConverter)();
  IntColumn get schemaVersion => integer()();
  TextColumn get config => text().map(const JsonObjectConverter())();
  IntColumn get turnSeconds => integer().nullable()();
  IntColumn get budgetSeconds => integer().nullable()();
  IntColumn get incrementSeconds => integer().nullable()();
  BoolColumn get rated => boolean()();
  TextColumn get ratingPool => text().nullable()();
  IntColumn get minPlayers => integer()();
  IntColumn get maxPlayers => integer()();
  TextColumn get shortCode => text()();
  TextColumn get pendingPlayers =>
      text().map(const IntListConverter()).nullable()();
  IntColumn get turnDeadline => integer().nullable()();
  TextColumn get outcomes => text().map(outcomesConverter).nullable()();
  IntColumn get finishedAt => integer().nullable()();
  IntColumn get createdAt => integer()();
  IntColumn get updatedAt => integer()();

  /// Whether `frames` holds every version of this finished game, so its replay
  /// needs no request.
  BoolColumn get framesComplete =>
      boolean().withDefault(const Constant(false))();

  /// When the account last opened this game, which is what replay eviction
  /// orders by.
  IntColumn get lastOpenedAt => integer().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {accountId, id};
}

/// One seat of a game. Mirrors D1 `participants`.
@DataClassName('ParticipantRow')
class Participants extends Table {
  TextColumn get accountId => text()();
  TextColumn get gameId => text()();
  IntColumn get playerIndex => integer()();
  TextColumn get userId => text().nullable()();
  TextColumn get botId => text().nullable()();
  TextColumn get type => text().map(seatTypeConverter)();

  @override
  Set<Column<Object>> get primaryKey => {accountId, gameId, playerIndex};
}

/// Display ratings per identity per pool. Mirrors D1 `player_ratings`.
@DataClassName('PlayerRatingRow')
class PlayerRatings extends Table {
  TextColumn get playerId => text()();
  TextColumn get pool => text()();
  RealColumn get mu => real()();
  RealColumn get sigma => real()();
  IntColumn get displayRating => integer()();
  IntColumn get updatedAt => integer()();

  @override
  Set<Column<Object>> get primaryKey => {playerId, pool};
}

/// Every identity's rating change in a finished rated game. Mirrors D1
/// `rating_history`.
@DataClassName('RatingHistoryRow')
class RatingHistory extends Table {
  TextColumn get accountId => text()();
  TextColumn get gameId => text()();

  /// `u:<userId>` or `b:<botId>`: exactly one identity per change, spelled as
  /// one non-null key column.
  TextColumn get identity => text()();
  TextColumn get userId => text().nullable()();
  TextColumn get botId => text().nullable()();
  TextColumn get pool => text()();
  RealColumn get muBefore => real()();
  RealColumn get sigmaBefore => real()();
  IntColumn get displayBefore => integer()();
  RealColumn get muAfter => real()();
  RealColumn get sigmaAfter => real()();
  IntColumn get displayAfter => integer()();
  IntColumn get displayChange => integer()();

  @override
  Set<Column<Object>> get primaryKey => {accountId, gameId, identity};
}

/// Accepted friends and pending requests. Mirrors D1 `relationships`, seen
/// from one side; the other user's identity is in `players`.
@DataClassName('RelationshipRow')
class Relationships extends Table {
  TextColumn get accountId => text()();
  TextColumn get userId => text()();

  /// True for an accepted friend, false for a pending request.
  BoolColumn get accepted => boolean()();

  /// A pending request's direction; null for a friend.
  TextColumn get direction =>
      text().map(requestDirectionConverter).nullable()();
  IntColumn get since => integer()();

  @override
  Set<Column<Object>> get primaryKey => {accountId, userId};
}

/// The account's own projection of a game, per version: exactly what the
/// server served this account, or for a local game what its one human saw.
/// Mirrors the Durable Object's `frames`.
@DataClassName('FrameRow')
class Frames extends Table {
  TextColumn get accountId => text()();
  TextColumn get gameId => text()();
  IntColumn get version => integer()();
  TextColumn get data => text().map(const JsonObjectConverter())();
  TextColumn get pendingPlayers => text().map(const IntListConverter())();
  IntColumn get deadline => integer().nullable()();
  TextColumn get playerTimes =>
      text().map(const IntListConverter()).nullable()();
  TextColumn get outcomes => text().map(outcomesConverter).nullable()();
  TextColumn get ratings => text().map(ratingDeltasConverter).nullable()();

  @override
  Set<Column<Object>> get primaryKey => {accountId, gameId, version};
}

/// What only a game this device decides needs: its seed and how far it has
/// synchronized. Mirrors the Durable Object's `meta` for a local game
/// (decision 0012).
@DataClassName('LocalGameRow')
class LocalGames extends Table {
  TextColumn get accountId => text()();
  TextColumn get gameId => text()();
  TextColumn get seed => text()();
  BoolColumn get remoteCreated => boolean()();

  /// The highest version the server has accepted, or -1 before the game exists
  /// there.
  IntColumn get syncedVersion => integer()();
  BoolColumn get diverged => boolean()();

  @override
  Set<Column<Object>> get primaryKey => {accountId, gameId};
}

/// A local game's authoritative log: the raw state at each version and the
/// action that produced it. Mirrors the Durable Object's `transitions`.
@DataClassName('TransitionRow')
class Transitions extends Table {
  TextColumn get accountId => text()();
  TextColumn get gameId => text()();
  IntColumn get version => integer()();
  TextColumn get state => text().map(const JsonObjectConverter())();
  TextColumn get action => text().map(const JsonObjectConverter()).nullable()();
  TextColumn get pending => text().map(const IntListConverter())();

  @override
  Set<Column<Object>> get primaryKey => {accountId, gameId, version};
}

/// Store purchases waiting to be delivered to the server: an outbox, so a
/// purchase the device holds evidence for survives a restart before the claim
/// lands.
@DataClassName('CommerceDeliveryRow')
class CommerceDeliveries extends Table {
  TextColumn get provider => text()();
  TextColumn get deliveryId => text()();
  TextColumn get offerKey => text()();
  TextColumn get providerReference => text()();
  TextColumn get evidence => text()();
  IntColumn get createdAt => integer()();

  @override
  Set<Column<Object>> get primaryKey => {provider, deliveryId};
}
