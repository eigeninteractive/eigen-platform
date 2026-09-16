// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'replica_database.dart';

// ignore_for_file: type=lint
class $AccountsTable extends Accounts
    with TableInfo<$AccountsTable, AccountRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $AccountsTable(this.attachedDatabase, [this._alias]);
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> email = GeneratedColumn<String>(
    'email',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<int> createdAt = GeneratedColumn<int>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> finishedCursor = GeneratedColumn<int>(
    'finished_cursor',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<String> historyFloor = GeneratedColumn<String>(
    'history_floor',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<int> lastSyncedAt = GeneratedColumn<int>(
    'last_synced_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    email,
    createdAt,
    finishedCursor,
    historyFloor,
    lastSyncedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'accounts';
  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  AccountRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return AccountRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      email: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}email'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
      finishedCursor: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}finished_cursor'],
      ),
      historyFloor: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}history_floor'],
      ),
      lastSyncedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}last_synced_at'],
      ),
    );
  }

  @override
  $AccountsTable createAlias(String alias) {
    return $AccountsTable(attachedDatabase, alias);
  }
}

class AccountRow extends DataClass implements Insertable<AccountRow> {
  final String id;
  final String? email;

  /// When the server created the account. It changes only when the account was
  /// deleted and created again under the same id, which is what tells the
  /// replica its rows describe an account that no longer exists.
  final int createdAt;

  /// The `finishSeq` the next sync asks after, or null before the first sync.
  final int? finishedCursor;

  /// Where older history continues, or null when none remains to fetch.
  final String? historyFloor;

  /// When a sync last completed, in epoch milliseconds.
  final int? lastSyncedAt;
  const AccountRow({
    required this.id,
    this.email,
    required this.createdAt,
    this.finishedCursor,
    this.historyFloor,
    this.lastSyncedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    if (!nullToAbsent || email != null) {
      map['email'] = Variable<String>(email);
    }
    map['created_at'] = Variable<int>(createdAt);
    if (!nullToAbsent || finishedCursor != null) {
      map['finished_cursor'] = Variable<int>(finishedCursor);
    }
    if (!nullToAbsent || historyFloor != null) {
      map['history_floor'] = Variable<String>(historyFloor);
    }
    if (!nullToAbsent || lastSyncedAt != null) {
      map['last_synced_at'] = Variable<int>(lastSyncedAt);
    }
    return map;
  }

  AccountsCompanion toCompanion(bool nullToAbsent) {
    return AccountsCompanion(
      id: Value(id),
      email: email == null && nullToAbsent
          ? const Value.absent()
          : Value(email),
      createdAt: Value(createdAt),
      finishedCursor: finishedCursor == null && nullToAbsent
          ? const Value.absent()
          : Value(finishedCursor),
      historyFloor: historyFloor == null && nullToAbsent
          ? const Value.absent()
          : Value(historyFloor),
      lastSyncedAt: lastSyncedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSyncedAt),
    );
  }

  factory AccountRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return AccountRow(
      id: serializer.fromJson<String>(json['id']),
      email: serializer.fromJson<String?>(json['email']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
      finishedCursor: serializer.fromJson<int?>(json['finishedCursor']),
      historyFloor: serializer.fromJson<String?>(json['historyFloor']),
      lastSyncedAt: serializer.fromJson<int?>(json['lastSyncedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'email': serializer.toJson<String?>(email),
      'createdAt': serializer.toJson<int>(createdAt),
      'finishedCursor': serializer.toJson<int?>(finishedCursor),
      'historyFloor': serializer.toJson<String?>(historyFloor),
      'lastSyncedAt': serializer.toJson<int?>(lastSyncedAt),
    };
  }

  AccountRow copyWith({
    String? id,
    Value<String?> email = const Value.absent(),
    int? createdAt,
    Value<int?> finishedCursor = const Value.absent(),
    Value<String?> historyFloor = const Value.absent(),
    Value<int?> lastSyncedAt = const Value.absent(),
  }) => AccountRow(
    id: id ?? this.id,
    email: email.present ? email.value : this.email,
    createdAt: createdAt ?? this.createdAt,
    finishedCursor: finishedCursor.present
        ? finishedCursor.value
        : this.finishedCursor,
    historyFloor: historyFloor.present ? historyFloor.value : this.historyFloor,
    lastSyncedAt: lastSyncedAt.present ? lastSyncedAt.value : this.lastSyncedAt,
  );
  AccountRow copyWithCompanion(AccountsCompanion data) {
    return AccountRow(
      id: data.id.present ? data.id.value : this.id,
      email: data.email.present ? data.email.value : this.email,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      finishedCursor: data.finishedCursor.present
          ? data.finishedCursor.value
          : this.finishedCursor,
      historyFloor: data.historyFloor.present
          ? data.historyFloor.value
          : this.historyFloor,
      lastSyncedAt: data.lastSyncedAt.present
          ? data.lastSyncedAt.value
          : this.lastSyncedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('AccountRow(')
          ..write('id: $id, ')
          ..write('email: $email, ')
          ..write('createdAt: $createdAt, ')
          ..write('finishedCursor: $finishedCursor, ')
          ..write('historyFloor: $historyFloor, ')
          ..write('lastSyncedAt: $lastSyncedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    email,
    createdAt,
    finishedCursor,
    historyFloor,
    lastSyncedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AccountRow &&
          other.id == this.id &&
          other.email == this.email &&
          other.createdAt == this.createdAt &&
          other.finishedCursor == this.finishedCursor &&
          other.historyFloor == this.historyFloor &&
          other.lastSyncedAt == this.lastSyncedAt);
}

class AccountsCompanion extends UpdateCompanion<AccountRow> {
  final Value<String> id;
  final Value<String?> email;
  final Value<int> createdAt;
  final Value<int?> finishedCursor;
  final Value<String?> historyFloor;
  final Value<int?> lastSyncedAt;
  final Value<int> rowid;
  const AccountsCompanion({
    this.id = const Value.absent(),
    this.email = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.finishedCursor = const Value.absent(),
    this.historyFloor = const Value.absent(),
    this.lastSyncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  AccountsCompanion.insert({
    required String id,
    this.email = const Value.absent(),
    required int createdAt,
    this.finishedCursor = const Value.absent(),
    this.historyFloor = const Value.absent(),
    this.lastSyncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       createdAt = Value(createdAt);
  static Insertable<AccountRow> custom({
    Expression<String>? id,
    Expression<String>? email,
    Expression<int>? createdAt,
    Expression<int>? finishedCursor,
    Expression<String>? historyFloor,
    Expression<int>? lastSyncedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (email != null) 'email': email,
      if (createdAt != null) 'created_at': createdAt,
      if (finishedCursor != null) 'finished_cursor': finishedCursor,
      if (historyFloor != null) 'history_floor': historyFloor,
      if (lastSyncedAt != null) 'last_synced_at': lastSyncedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  AccountsCompanion copyWith({
    Value<String>? id,
    Value<String?>? email,
    Value<int>? createdAt,
    Value<int?>? finishedCursor,
    Value<String?>? historyFloor,
    Value<int?>? lastSyncedAt,
    Value<int>? rowid,
  }) {
    return AccountsCompanion(
      id: id ?? this.id,
      email: email ?? this.email,
      createdAt: createdAt ?? this.createdAt,
      finishedCursor: finishedCursor ?? this.finishedCursor,
      historyFloor: historyFloor ?? this.historyFloor,
      lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (email.present) {
      map['email'] = Variable<String>(email.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (finishedCursor.present) {
      map['finished_cursor'] = Variable<int>(finishedCursor.value);
    }
    if (historyFloor.present) {
      map['history_floor'] = Variable<String>(historyFloor.value);
    }
    if (lastSyncedAt.present) {
      map['last_synced_at'] = Variable<int>(lastSyncedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('AccountsCompanion(')
          ..write('id: $id, ')
          ..write('email: $email, ')
          ..write('createdAt: $createdAt, ')
          ..write('finishedCursor: $finishedCursor, ')
          ..write('historyFloor: $historyFloor, ')
          ..write('lastSyncedAt: $lastSyncedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PlayersTable extends Players with TableInfo<$PlayersTable, PlayerRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PlayersTable(this.attachedDatabase, [this._alias]);
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> username = GeneratedColumn<String>(
    'username',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> displayName = GeneratedColumn<String>(
    'display_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> avatarUrl = GeneratedColumn<String>(
    'avatar_url',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<bool> isAnonymous = GeneratedColumn<bool>(
    'is_anonymous',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_anonymous" IN (0, 1))',
    ),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    username,
    displayName,
    avatarUrl,
    isAnonymous,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'players';
  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  PlayerRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PlayerRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      username: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}username'],
      )!,
      displayName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}display_name'],
      )!,
      avatarUrl: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}avatar_url'],
      ),
      isAnonymous: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_anonymous'],
      )!,
    );
  }

  @override
  $PlayersTable createAlias(String alias) {
    return $PlayersTable(attachedDatabase, alias);
  }
}

class PlayerRow extends DataClass implements Insertable<PlayerRow> {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final bool isAnonymous;
  const PlayerRow({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    required this.isAnonymous,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['username'] = Variable<String>(username);
    map['display_name'] = Variable<String>(displayName);
    if (!nullToAbsent || avatarUrl != null) {
      map['avatar_url'] = Variable<String>(avatarUrl);
    }
    map['is_anonymous'] = Variable<bool>(isAnonymous);
    return map;
  }

  PlayersCompanion toCompanion(bool nullToAbsent) {
    return PlayersCompanion(
      id: Value(id),
      username: Value(username),
      displayName: Value(displayName),
      avatarUrl: avatarUrl == null && nullToAbsent
          ? const Value.absent()
          : Value(avatarUrl),
      isAnonymous: Value(isAnonymous),
    );
  }

  factory PlayerRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PlayerRow(
      id: serializer.fromJson<String>(json['id']),
      username: serializer.fromJson<String>(json['username']),
      displayName: serializer.fromJson<String>(json['displayName']),
      avatarUrl: serializer.fromJson<String?>(json['avatarUrl']),
      isAnonymous: serializer.fromJson<bool>(json['isAnonymous']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'username': serializer.toJson<String>(username),
      'displayName': serializer.toJson<String>(displayName),
      'avatarUrl': serializer.toJson<String?>(avatarUrl),
      'isAnonymous': serializer.toJson<bool>(isAnonymous),
    };
  }

  PlayerRow copyWith({
    String? id,
    String? username,
    String? displayName,
    Value<String?> avatarUrl = const Value.absent(),
    bool? isAnonymous,
  }) => PlayerRow(
    id: id ?? this.id,
    username: username ?? this.username,
    displayName: displayName ?? this.displayName,
    avatarUrl: avatarUrl.present ? avatarUrl.value : this.avatarUrl,
    isAnonymous: isAnonymous ?? this.isAnonymous,
  );
  PlayerRow copyWithCompanion(PlayersCompanion data) {
    return PlayerRow(
      id: data.id.present ? data.id.value : this.id,
      username: data.username.present ? data.username.value : this.username,
      displayName: data.displayName.present
          ? data.displayName.value
          : this.displayName,
      avatarUrl: data.avatarUrl.present ? data.avatarUrl.value : this.avatarUrl,
      isAnonymous: data.isAnonymous.present
          ? data.isAnonymous.value
          : this.isAnonymous,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PlayerRow(')
          ..write('id: $id, ')
          ..write('username: $username, ')
          ..write('displayName: $displayName, ')
          ..write('avatarUrl: $avatarUrl, ')
          ..write('isAnonymous: $isAnonymous')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, username, displayName, avatarUrl, isAnonymous);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PlayerRow &&
          other.id == this.id &&
          other.username == this.username &&
          other.displayName == this.displayName &&
          other.avatarUrl == this.avatarUrl &&
          other.isAnonymous == this.isAnonymous);
}

class PlayersCompanion extends UpdateCompanion<PlayerRow> {
  final Value<String> id;
  final Value<String> username;
  final Value<String> displayName;
  final Value<String?> avatarUrl;
  final Value<bool> isAnonymous;
  final Value<int> rowid;
  const PlayersCompanion({
    this.id = const Value.absent(),
    this.username = const Value.absent(),
    this.displayName = const Value.absent(),
    this.avatarUrl = const Value.absent(),
    this.isAnonymous = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PlayersCompanion.insert({
    required String id,
    required String username,
    required String displayName,
    this.avatarUrl = const Value.absent(),
    required bool isAnonymous,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       username = Value(username),
       displayName = Value(displayName),
       isAnonymous = Value(isAnonymous);
  static Insertable<PlayerRow> custom({
    Expression<String>? id,
    Expression<String>? username,
    Expression<String>? displayName,
    Expression<String>? avatarUrl,
    Expression<bool>? isAnonymous,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (username != null) 'username': username,
      if (displayName != null) 'display_name': displayName,
      if (avatarUrl != null) 'avatar_url': avatarUrl,
      if (isAnonymous != null) 'is_anonymous': isAnonymous,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PlayersCompanion copyWith({
    Value<String>? id,
    Value<String>? username,
    Value<String>? displayName,
    Value<String?>? avatarUrl,
    Value<bool>? isAnonymous,
    Value<int>? rowid,
  }) {
    return PlayersCompanion(
      id: id ?? this.id,
      username: username ?? this.username,
      displayName: displayName ?? this.displayName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      isAnonymous: isAnonymous ?? this.isAnonymous,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (username.present) {
      map['username'] = Variable<String>(username.value);
    }
    if (displayName.present) {
      map['display_name'] = Variable<String>(displayName.value);
    }
    if (avatarUrl.present) {
      map['avatar_url'] = Variable<String>(avatarUrl.value);
    }
    if (isAnonymous.present) {
      map['is_anonymous'] = Variable<bool>(isAnonymous.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PlayersCompanion(')
          ..write('id: $id, ')
          ..write('username: $username, ')
          ..write('displayName: $displayName, ')
          ..write('avatarUrl: $avatarUrl, ')
          ..write('isAnonymous: $isAnonymous, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $BotsTable extends Bots with TableInfo<$BotsTable, BotRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $BotsTable(this.attachedDatabase, [this._alias]);
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> username = GeneratedColumn<String>(
    'username',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> displayName = GeneratedColumn<String>(
    'display_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> avatarUrl = GeneratedColumn<String>(
    'avatar_url',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<int> schemaVersion = GeneratedColumn<int>(
    'schema_version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumnWithTypeConverter<BotType, String> type =
      GeneratedColumn<String>(
        'type',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      ).withConverter<BotType>($BotsTable.$convertertype);
  @override
  late final GeneratedColumn<bool> ratedEligible = GeneratedColumn<bool>(
    'rated_eligible',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("rated_eligible" IN (0, 1))',
    ),
  );
  @override
  late final GeneratedColumnWithTypeConverter<Map<String, dynamic>, String>
  config = GeneratedColumn<String>(
    'config',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  ).withConverter<Map<String, dynamic>>($BotsTable.$converterconfig);
  @override
  late final GeneratedColumn<String> tier = GeneratedColumn<String>(
    'tier',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    username,
    displayName,
    avatarUrl,
    schemaVersion,
    type,
    ratedEligible,
    config,
    tier,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'bots';
  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  BotRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return BotRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      username: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}username'],
      )!,
      displayName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}display_name'],
      )!,
      avatarUrl: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}avatar_url'],
      ),
      schemaVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}schema_version'],
      )!,
      type: $BotsTable.$convertertype.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}type'],
        )!,
      ),
      ratedEligible: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}rated_eligible'],
      )!,
      config: $BotsTable.$converterconfig.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}config'],
        )!,
      ),
      tier: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}tier'],
      )!,
    );
  }

  @override
  $BotsTable createAlias(String alias) {
    return $BotsTable(attachedDatabase, alias);
  }

  static TypeConverter<BotType, String> $convertertype = botTypeConverter;
  static TypeConverter<Map<String, dynamic>, String> $converterconfig =
      const JsonObjectConverter();
}

class BotRow extends DataClass implements Insertable<BotRow> {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final int schemaVersion;
  final BotType type;
  final bool ratedEligible;
  final Map<String, dynamic> config;
  final String tier;
  const BotRow({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    required this.schemaVersion,
    required this.type,
    required this.ratedEligible,
    required this.config,
    required this.tier,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['username'] = Variable<String>(username);
    map['display_name'] = Variable<String>(displayName);
    if (!nullToAbsent || avatarUrl != null) {
      map['avatar_url'] = Variable<String>(avatarUrl);
    }
    map['schema_version'] = Variable<int>(schemaVersion);
    {
      map['type'] = Variable<String>($BotsTable.$convertertype.toSql(type));
    }
    map['rated_eligible'] = Variable<bool>(ratedEligible);
    {
      map['config'] = Variable<String>(
        $BotsTable.$converterconfig.toSql(config),
      );
    }
    map['tier'] = Variable<String>(tier);
    return map;
  }

  BotsCompanion toCompanion(bool nullToAbsent) {
    return BotsCompanion(
      id: Value(id),
      username: Value(username),
      displayName: Value(displayName),
      avatarUrl: avatarUrl == null && nullToAbsent
          ? const Value.absent()
          : Value(avatarUrl),
      schemaVersion: Value(schemaVersion),
      type: Value(type),
      ratedEligible: Value(ratedEligible),
      config: Value(config),
      tier: Value(tier),
    );
  }

  factory BotRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return BotRow(
      id: serializer.fromJson<String>(json['id']),
      username: serializer.fromJson<String>(json['username']),
      displayName: serializer.fromJson<String>(json['displayName']),
      avatarUrl: serializer.fromJson<String?>(json['avatarUrl']),
      schemaVersion: serializer.fromJson<int>(json['schemaVersion']),
      type: serializer.fromJson<BotType>(json['type']),
      ratedEligible: serializer.fromJson<bool>(json['ratedEligible']),
      config: serializer.fromJson<Map<String, dynamic>>(json['config']),
      tier: serializer.fromJson<String>(json['tier']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'username': serializer.toJson<String>(username),
      'displayName': serializer.toJson<String>(displayName),
      'avatarUrl': serializer.toJson<String?>(avatarUrl),
      'schemaVersion': serializer.toJson<int>(schemaVersion),
      'type': serializer.toJson<BotType>(type),
      'ratedEligible': serializer.toJson<bool>(ratedEligible),
      'config': serializer.toJson<Map<String, dynamic>>(config),
      'tier': serializer.toJson<String>(tier),
    };
  }

  BotRow copyWith({
    String? id,
    String? username,
    String? displayName,
    Value<String?> avatarUrl = const Value.absent(),
    int? schemaVersion,
    BotType? type,
    bool? ratedEligible,
    Map<String, dynamic>? config,
    String? tier,
  }) => BotRow(
    id: id ?? this.id,
    username: username ?? this.username,
    displayName: displayName ?? this.displayName,
    avatarUrl: avatarUrl.present ? avatarUrl.value : this.avatarUrl,
    schemaVersion: schemaVersion ?? this.schemaVersion,
    type: type ?? this.type,
    ratedEligible: ratedEligible ?? this.ratedEligible,
    config: config ?? this.config,
    tier: tier ?? this.tier,
  );
  BotRow copyWithCompanion(BotsCompanion data) {
    return BotRow(
      id: data.id.present ? data.id.value : this.id,
      username: data.username.present ? data.username.value : this.username,
      displayName: data.displayName.present
          ? data.displayName.value
          : this.displayName,
      avatarUrl: data.avatarUrl.present ? data.avatarUrl.value : this.avatarUrl,
      schemaVersion: data.schemaVersion.present
          ? data.schemaVersion.value
          : this.schemaVersion,
      type: data.type.present ? data.type.value : this.type,
      ratedEligible: data.ratedEligible.present
          ? data.ratedEligible.value
          : this.ratedEligible,
      config: data.config.present ? data.config.value : this.config,
      tier: data.tier.present ? data.tier.value : this.tier,
    );
  }

  @override
  String toString() {
    return (StringBuffer('BotRow(')
          ..write('id: $id, ')
          ..write('username: $username, ')
          ..write('displayName: $displayName, ')
          ..write('avatarUrl: $avatarUrl, ')
          ..write('schemaVersion: $schemaVersion, ')
          ..write('type: $type, ')
          ..write('ratedEligible: $ratedEligible, ')
          ..write('config: $config, ')
          ..write('tier: $tier')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    username,
    displayName,
    avatarUrl,
    schemaVersion,
    type,
    ratedEligible,
    config,
    tier,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is BotRow &&
          other.id == this.id &&
          other.username == this.username &&
          other.displayName == this.displayName &&
          other.avatarUrl == this.avatarUrl &&
          other.schemaVersion == this.schemaVersion &&
          other.type == this.type &&
          other.ratedEligible == this.ratedEligible &&
          other.config == this.config &&
          other.tier == this.tier);
}

class BotsCompanion extends UpdateCompanion<BotRow> {
  final Value<String> id;
  final Value<String> username;
  final Value<String> displayName;
  final Value<String?> avatarUrl;
  final Value<int> schemaVersion;
  final Value<BotType> type;
  final Value<bool> ratedEligible;
  final Value<Map<String, dynamic>> config;
  final Value<String> tier;
  final Value<int> rowid;
  const BotsCompanion({
    this.id = const Value.absent(),
    this.username = const Value.absent(),
    this.displayName = const Value.absent(),
    this.avatarUrl = const Value.absent(),
    this.schemaVersion = const Value.absent(),
    this.type = const Value.absent(),
    this.ratedEligible = const Value.absent(),
    this.config = const Value.absent(),
    this.tier = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  BotsCompanion.insert({
    required String id,
    required String username,
    required String displayName,
    this.avatarUrl = const Value.absent(),
    required int schemaVersion,
    required BotType type,
    required bool ratedEligible,
    required Map<String, dynamic> config,
    required String tier,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       username = Value(username),
       displayName = Value(displayName),
       schemaVersion = Value(schemaVersion),
       type = Value(type),
       ratedEligible = Value(ratedEligible),
       config = Value(config),
       tier = Value(tier);
  static Insertable<BotRow> custom({
    Expression<String>? id,
    Expression<String>? username,
    Expression<String>? displayName,
    Expression<String>? avatarUrl,
    Expression<int>? schemaVersion,
    Expression<String>? type,
    Expression<bool>? ratedEligible,
    Expression<String>? config,
    Expression<String>? tier,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (username != null) 'username': username,
      if (displayName != null) 'display_name': displayName,
      if (avatarUrl != null) 'avatar_url': avatarUrl,
      if (schemaVersion != null) 'schema_version': schemaVersion,
      if (type != null) 'type': type,
      if (ratedEligible != null) 'rated_eligible': ratedEligible,
      if (config != null) 'config': config,
      if (tier != null) 'tier': tier,
      if (rowid != null) 'rowid': rowid,
    });
  }

  BotsCompanion copyWith({
    Value<String>? id,
    Value<String>? username,
    Value<String>? displayName,
    Value<String?>? avatarUrl,
    Value<int>? schemaVersion,
    Value<BotType>? type,
    Value<bool>? ratedEligible,
    Value<Map<String, dynamic>>? config,
    Value<String>? tier,
    Value<int>? rowid,
  }) {
    return BotsCompanion(
      id: id ?? this.id,
      username: username ?? this.username,
      displayName: displayName ?? this.displayName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      schemaVersion: schemaVersion ?? this.schemaVersion,
      type: type ?? this.type,
      ratedEligible: ratedEligible ?? this.ratedEligible,
      config: config ?? this.config,
      tier: tier ?? this.tier,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (username.present) {
      map['username'] = Variable<String>(username.value);
    }
    if (displayName.present) {
      map['display_name'] = Variable<String>(displayName.value);
    }
    if (avatarUrl.present) {
      map['avatar_url'] = Variable<String>(avatarUrl.value);
    }
    if (schemaVersion.present) {
      map['schema_version'] = Variable<int>(schemaVersion.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(
        $BotsTable.$convertertype.toSql(type.value),
      );
    }
    if (ratedEligible.present) {
      map['rated_eligible'] = Variable<bool>(ratedEligible.value);
    }
    if (config.present) {
      map['config'] = Variable<String>(
        $BotsTable.$converterconfig.toSql(config.value),
      );
    }
    if (tier.present) {
      map['tier'] = Variable<String>(tier.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('BotsCompanion(')
          ..write('id: $id, ')
          ..write('username: $username, ')
          ..write('displayName: $displayName, ')
          ..write('avatarUrl: $avatarUrl, ')
          ..write('schemaVersion: $schemaVersion, ')
          ..write('type: $type, ')
          ..write('ratedEligible: $ratedEligible, ')
          ..write('config: $config, ')
          ..write('tier: $tier, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $GamesTable extends Games with TableInfo<$GamesTable, GameRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $GamesTable(this.attachedDatabase, [this._alias]);
  @override
  late final GeneratedColumn<String> accountId = GeneratedColumn<String>(
    'account_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> seq = GeneratedColumn<int>(
    'seq',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> createdBy = GeneratedColumn<String>(
    'created_by',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumnWithTypeConverter<GameStatus, String> status =
      GeneratedColumn<String>(
        'status',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      ).withConverter<GameStatus>($GamesTable.$converterstatus);
  @override
  late final GeneratedColumnWithTypeConverter<GameAccess, String> access =
      GeneratedColumn<String>(
        'access',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      ).withConverter<GameAccess>($GamesTable.$converteraccess);
  @override
  late final GeneratedColumnWithTypeConverter<GameOrigin, String> origin =
      GeneratedColumn<String>(
        'origin',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      ).withConverter<GameOrigin>($GamesTable.$converterorigin);
  @override
  late final GeneratedColumn<int> schemaVersion = GeneratedColumn<int>(
    'schema_version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumnWithTypeConverter<Map<String, dynamic>, String>
  config = GeneratedColumn<String>(
    'config',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  ).withConverter<Map<String, dynamic>>($GamesTable.$converterconfig);
  @override
  late final GeneratedColumn<int> turnSeconds = GeneratedColumn<int>(
    'turn_seconds',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<int> budgetSeconds = GeneratedColumn<int>(
    'budget_seconds',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<int> incrementSeconds = GeneratedColumn<int>(
    'increment_seconds',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<bool> rated = GeneratedColumn<bool>(
    'rated',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("rated" IN (0, 1))',
    ),
  );
  @override
  late final GeneratedColumn<String> ratingPool = GeneratedColumn<String>(
    'rating_pool',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<int> minPlayers = GeneratedColumn<int>(
    'min_players',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> maxPlayers = GeneratedColumn<int>(
    'max_players',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> shortCode = GeneratedColumn<String>(
    'short_code',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumnWithTypeConverter<List<int>?, String>
  pendingPlayers = GeneratedColumn<String>(
    'pending_players',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  ).withConverter<List<int>?>($GamesTable.$converterpendingPlayersn);
  @override
  late final GeneratedColumn<int> turnDeadline = GeneratedColumn<int>(
    'turn_deadline',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumnWithTypeConverter<List<Outcome>?, String> outcomes =
      GeneratedColumn<String>(
        'outcomes',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      ).withConverter<List<Outcome>?>($GamesTable.$converteroutcomesn);
  @override
  late final GeneratedColumn<int> finishedAt = GeneratedColumn<int>(
    'finished_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<int> createdAt = GeneratedColumn<int>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> updatedAt = GeneratedColumn<int>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<bool> framesComplete = GeneratedColumn<bool>(
    'frames_complete',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("frames_complete" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  @override
  late final GeneratedColumn<int> lastOpenedAt = GeneratedColumn<int>(
    'last_opened_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    accountId,
    id,
    seq,
    createdBy,
    status,
    access,
    origin,
    schemaVersion,
    config,
    turnSeconds,
    budgetSeconds,
    incrementSeconds,
    rated,
    ratingPool,
    minPlayers,
    maxPlayers,
    shortCode,
    pendingPlayers,
    turnDeadline,
    outcomes,
    finishedAt,
    createdAt,
    updatedAt,
    framesComplete,
    lastOpenedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'games';
  @override
  Set<GeneratedColumn> get $primaryKey => {accountId, id};
  @override
  GameRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return GameRow(
      accountId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}account_id'],
      )!,
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      seq: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}seq'],
      )!,
      createdBy: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}created_by'],
      ),
      status: $GamesTable.$converterstatus.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}status'],
        )!,
      ),
      access: $GamesTable.$converteraccess.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}access'],
        )!,
      ),
      origin: $GamesTable.$converterorigin.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}origin'],
        )!,
      ),
      schemaVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}schema_version'],
      )!,
      config: $GamesTable.$converterconfig.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}config'],
        )!,
      ),
      turnSeconds: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}turn_seconds'],
      ),
      budgetSeconds: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}budget_seconds'],
      ),
      incrementSeconds: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}increment_seconds'],
      ),
      rated: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}rated'],
      )!,
      ratingPool: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}rating_pool'],
      ),
      minPlayers: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}min_players'],
      )!,
      maxPlayers: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}max_players'],
      )!,
      shortCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}short_code'],
      )!,
      pendingPlayers: $GamesTable.$converterpendingPlayersn.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}pending_players'],
        ),
      ),
      turnDeadline: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}turn_deadline'],
      ),
      outcomes: $GamesTable.$converteroutcomesn.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}outcomes'],
        ),
      ),
      finishedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}finished_at'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      )!,
      framesComplete: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}frames_complete'],
      )!,
      lastOpenedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}last_opened_at'],
      ),
    );
  }

  @override
  $GamesTable createAlias(String alias) {
    return $GamesTable(attachedDatabase, alias);
  }

  static TypeConverter<GameStatus, String> $converterstatus =
      gameStatusConverter;
  static TypeConverter<GameAccess, String> $converteraccess =
      gameAccessConverter;
  static TypeConverter<GameOrigin, String> $converterorigin =
      gameOriginConverter;
  static TypeConverter<Map<String, dynamic>, String> $converterconfig =
      const JsonObjectConverter();
  static TypeConverter<List<int>, String> $converterpendingPlayers =
      const IntListConverter();
  static TypeConverter<List<int>?, String?> $converterpendingPlayersn =
      NullAwareTypeConverter.wrap($converterpendingPlayers);
  static TypeConverter<List<Outcome>, String> $converteroutcomes =
      outcomesConverter;
  static TypeConverter<List<Outcome>?, String?> $converteroutcomesn =
      NullAwareTypeConverter.wrap($converteroutcomes);
}

class GameRow extends DataClass implements Insertable<GameRow> {
  final String accountId;
  final String id;

  /// The game's revision. A write carrying an older one changes nothing.
  final int seq;
  final String? createdBy;
  final GameStatus status;
  final GameAccess access;
  final GameOrigin origin;
  final int schemaVersion;
  final Map<String, dynamic> config;
  final int? turnSeconds;
  final int? budgetSeconds;
  final int? incrementSeconds;
  final bool rated;
  final String? ratingPool;
  final int minPlayers;
  final int maxPlayers;
  final String shortCode;
  final List<int>? pendingPlayers;
  final int? turnDeadline;
  final List<Outcome>? outcomes;
  final int? finishedAt;
  final int createdAt;
  final int updatedAt;

  /// Whether `frames` holds every version of this finished game, so its replay
  /// needs no request.
  final bool framesComplete;

  /// When the account last opened this game, which is what replay eviction
  /// orders by.
  final int? lastOpenedAt;
  const GameRow({
    required this.accountId,
    required this.id,
    required this.seq,
    this.createdBy,
    required this.status,
    required this.access,
    required this.origin,
    required this.schemaVersion,
    required this.config,
    this.turnSeconds,
    this.budgetSeconds,
    this.incrementSeconds,
    required this.rated,
    this.ratingPool,
    required this.minPlayers,
    required this.maxPlayers,
    required this.shortCode,
    this.pendingPlayers,
    this.turnDeadline,
    this.outcomes,
    this.finishedAt,
    required this.createdAt,
    required this.updatedAt,
    required this.framesComplete,
    this.lastOpenedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['account_id'] = Variable<String>(accountId);
    map['id'] = Variable<String>(id);
    map['seq'] = Variable<int>(seq);
    if (!nullToAbsent || createdBy != null) {
      map['created_by'] = Variable<String>(createdBy);
    }
    {
      map['status'] = Variable<String>(
        $GamesTable.$converterstatus.toSql(status),
      );
    }
    {
      map['access'] = Variable<String>(
        $GamesTable.$converteraccess.toSql(access),
      );
    }
    {
      map['origin'] = Variable<String>(
        $GamesTable.$converterorigin.toSql(origin),
      );
    }
    map['schema_version'] = Variable<int>(schemaVersion);
    {
      map['config'] = Variable<String>(
        $GamesTable.$converterconfig.toSql(config),
      );
    }
    if (!nullToAbsent || turnSeconds != null) {
      map['turn_seconds'] = Variable<int>(turnSeconds);
    }
    if (!nullToAbsent || budgetSeconds != null) {
      map['budget_seconds'] = Variable<int>(budgetSeconds);
    }
    if (!nullToAbsent || incrementSeconds != null) {
      map['increment_seconds'] = Variable<int>(incrementSeconds);
    }
    map['rated'] = Variable<bool>(rated);
    if (!nullToAbsent || ratingPool != null) {
      map['rating_pool'] = Variable<String>(ratingPool);
    }
    map['min_players'] = Variable<int>(minPlayers);
    map['max_players'] = Variable<int>(maxPlayers);
    map['short_code'] = Variable<String>(shortCode);
    if (!nullToAbsent || pendingPlayers != null) {
      map['pending_players'] = Variable<String>(
        $GamesTable.$converterpendingPlayersn.toSql(pendingPlayers),
      );
    }
    if (!nullToAbsent || turnDeadline != null) {
      map['turn_deadline'] = Variable<int>(turnDeadline);
    }
    if (!nullToAbsent || outcomes != null) {
      map['outcomes'] = Variable<String>(
        $GamesTable.$converteroutcomesn.toSql(outcomes),
      );
    }
    if (!nullToAbsent || finishedAt != null) {
      map['finished_at'] = Variable<int>(finishedAt);
    }
    map['created_at'] = Variable<int>(createdAt);
    map['updated_at'] = Variable<int>(updatedAt);
    map['frames_complete'] = Variable<bool>(framesComplete);
    if (!nullToAbsent || lastOpenedAt != null) {
      map['last_opened_at'] = Variable<int>(lastOpenedAt);
    }
    return map;
  }

  GamesCompanion toCompanion(bool nullToAbsent) {
    return GamesCompanion(
      accountId: Value(accountId),
      id: Value(id),
      seq: Value(seq),
      createdBy: createdBy == null && nullToAbsent
          ? const Value.absent()
          : Value(createdBy),
      status: Value(status),
      access: Value(access),
      origin: Value(origin),
      schemaVersion: Value(schemaVersion),
      config: Value(config),
      turnSeconds: turnSeconds == null && nullToAbsent
          ? const Value.absent()
          : Value(turnSeconds),
      budgetSeconds: budgetSeconds == null && nullToAbsent
          ? const Value.absent()
          : Value(budgetSeconds),
      incrementSeconds: incrementSeconds == null && nullToAbsent
          ? const Value.absent()
          : Value(incrementSeconds),
      rated: Value(rated),
      ratingPool: ratingPool == null && nullToAbsent
          ? const Value.absent()
          : Value(ratingPool),
      minPlayers: Value(minPlayers),
      maxPlayers: Value(maxPlayers),
      shortCode: Value(shortCode),
      pendingPlayers: pendingPlayers == null && nullToAbsent
          ? const Value.absent()
          : Value(pendingPlayers),
      turnDeadline: turnDeadline == null && nullToAbsent
          ? const Value.absent()
          : Value(turnDeadline),
      outcomes: outcomes == null && nullToAbsent
          ? const Value.absent()
          : Value(outcomes),
      finishedAt: finishedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(finishedAt),
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      framesComplete: Value(framesComplete),
      lastOpenedAt: lastOpenedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastOpenedAt),
    );
  }

  factory GameRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return GameRow(
      accountId: serializer.fromJson<String>(json['accountId']),
      id: serializer.fromJson<String>(json['id']),
      seq: serializer.fromJson<int>(json['seq']),
      createdBy: serializer.fromJson<String?>(json['createdBy']),
      status: serializer.fromJson<GameStatus>(json['status']),
      access: serializer.fromJson<GameAccess>(json['access']),
      origin: serializer.fromJson<GameOrigin>(json['origin']),
      schemaVersion: serializer.fromJson<int>(json['schemaVersion']),
      config: serializer.fromJson<Map<String, dynamic>>(json['config']),
      turnSeconds: serializer.fromJson<int?>(json['turnSeconds']),
      budgetSeconds: serializer.fromJson<int?>(json['budgetSeconds']),
      incrementSeconds: serializer.fromJson<int?>(json['incrementSeconds']),
      rated: serializer.fromJson<bool>(json['rated']),
      ratingPool: serializer.fromJson<String?>(json['ratingPool']),
      minPlayers: serializer.fromJson<int>(json['minPlayers']),
      maxPlayers: serializer.fromJson<int>(json['maxPlayers']),
      shortCode: serializer.fromJson<String>(json['shortCode']),
      pendingPlayers: serializer.fromJson<List<int>?>(json['pendingPlayers']),
      turnDeadline: serializer.fromJson<int?>(json['turnDeadline']),
      outcomes: serializer.fromJson<List<Outcome>?>(json['outcomes']),
      finishedAt: serializer.fromJson<int?>(json['finishedAt']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
      updatedAt: serializer.fromJson<int>(json['updatedAt']),
      framesComplete: serializer.fromJson<bool>(json['framesComplete']),
      lastOpenedAt: serializer.fromJson<int?>(json['lastOpenedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'accountId': serializer.toJson<String>(accountId),
      'id': serializer.toJson<String>(id),
      'seq': serializer.toJson<int>(seq),
      'createdBy': serializer.toJson<String?>(createdBy),
      'status': serializer.toJson<GameStatus>(status),
      'access': serializer.toJson<GameAccess>(access),
      'origin': serializer.toJson<GameOrigin>(origin),
      'schemaVersion': serializer.toJson<int>(schemaVersion),
      'config': serializer.toJson<Map<String, dynamic>>(config),
      'turnSeconds': serializer.toJson<int?>(turnSeconds),
      'budgetSeconds': serializer.toJson<int?>(budgetSeconds),
      'incrementSeconds': serializer.toJson<int?>(incrementSeconds),
      'rated': serializer.toJson<bool>(rated),
      'ratingPool': serializer.toJson<String?>(ratingPool),
      'minPlayers': serializer.toJson<int>(minPlayers),
      'maxPlayers': serializer.toJson<int>(maxPlayers),
      'shortCode': serializer.toJson<String>(shortCode),
      'pendingPlayers': serializer.toJson<List<int>?>(pendingPlayers),
      'turnDeadline': serializer.toJson<int?>(turnDeadline),
      'outcomes': serializer.toJson<List<Outcome>?>(outcomes),
      'finishedAt': serializer.toJson<int?>(finishedAt),
      'createdAt': serializer.toJson<int>(createdAt),
      'updatedAt': serializer.toJson<int>(updatedAt),
      'framesComplete': serializer.toJson<bool>(framesComplete),
      'lastOpenedAt': serializer.toJson<int?>(lastOpenedAt),
    };
  }

  GameRow copyWith({
    String? accountId,
    String? id,
    int? seq,
    Value<String?> createdBy = const Value.absent(),
    GameStatus? status,
    GameAccess? access,
    GameOrigin? origin,
    int? schemaVersion,
    Map<String, dynamic>? config,
    Value<int?> turnSeconds = const Value.absent(),
    Value<int?> budgetSeconds = const Value.absent(),
    Value<int?> incrementSeconds = const Value.absent(),
    bool? rated,
    Value<String?> ratingPool = const Value.absent(),
    int? minPlayers,
    int? maxPlayers,
    String? shortCode,
    Value<List<int>?> pendingPlayers = const Value.absent(),
    Value<int?> turnDeadline = const Value.absent(),
    Value<List<Outcome>?> outcomes = const Value.absent(),
    Value<int?> finishedAt = const Value.absent(),
    int? createdAt,
    int? updatedAt,
    bool? framesComplete,
    Value<int?> lastOpenedAt = const Value.absent(),
  }) => GameRow(
    accountId: accountId ?? this.accountId,
    id: id ?? this.id,
    seq: seq ?? this.seq,
    createdBy: createdBy.present ? createdBy.value : this.createdBy,
    status: status ?? this.status,
    access: access ?? this.access,
    origin: origin ?? this.origin,
    schemaVersion: schemaVersion ?? this.schemaVersion,
    config: config ?? this.config,
    turnSeconds: turnSeconds.present ? turnSeconds.value : this.turnSeconds,
    budgetSeconds: budgetSeconds.present
        ? budgetSeconds.value
        : this.budgetSeconds,
    incrementSeconds: incrementSeconds.present
        ? incrementSeconds.value
        : this.incrementSeconds,
    rated: rated ?? this.rated,
    ratingPool: ratingPool.present ? ratingPool.value : this.ratingPool,
    minPlayers: minPlayers ?? this.minPlayers,
    maxPlayers: maxPlayers ?? this.maxPlayers,
    shortCode: shortCode ?? this.shortCode,
    pendingPlayers: pendingPlayers.present
        ? pendingPlayers.value
        : this.pendingPlayers,
    turnDeadline: turnDeadline.present ? turnDeadline.value : this.turnDeadline,
    outcomes: outcomes.present ? outcomes.value : this.outcomes,
    finishedAt: finishedAt.present ? finishedAt.value : this.finishedAt,
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    framesComplete: framesComplete ?? this.framesComplete,
    lastOpenedAt: lastOpenedAt.present ? lastOpenedAt.value : this.lastOpenedAt,
  );
  GameRow copyWithCompanion(GamesCompanion data) {
    return GameRow(
      accountId: data.accountId.present ? data.accountId.value : this.accountId,
      id: data.id.present ? data.id.value : this.id,
      seq: data.seq.present ? data.seq.value : this.seq,
      createdBy: data.createdBy.present ? data.createdBy.value : this.createdBy,
      status: data.status.present ? data.status.value : this.status,
      access: data.access.present ? data.access.value : this.access,
      origin: data.origin.present ? data.origin.value : this.origin,
      schemaVersion: data.schemaVersion.present
          ? data.schemaVersion.value
          : this.schemaVersion,
      config: data.config.present ? data.config.value : this.config,
      turnSeconds: data.turnSeconds.present
          ? data.turnSeconds.value
          : this.turnSeconds,
      budgetSeconds: data.budgetSeconds.present
          ? data.budgetSeconds.value
          : this.budgetSeconds,
      incrementSeconds: data.incrementSeconds.present
          ? data.incrementSeconds.value
          : this.incrementSeconds,
      rated: data.rated.present ? data.rated.value : this.rated,
      ratingPool: data.ratingPool.present
          ? data.ratingPool.value
          : this.ratingPool,
      minPlayers: data.minPlayers.present
          ? data.minPlayers.value
          : this.minPlayers,
      maxPlayers: data.maxPlayers.present
          ? data.maxPlayers.value
          : this.maxPlayers,
      shortCode: data.shortCode.present ? data.shortCode.value : this.shortCode,
      pendingPlayers: data.pendingPlayers.present
          ? data.pendingPlayers.value
          : this.pendingPlayers,
      turnDeadline: data.turnDeadline.present
          ? data.turnDeadline.value
          : this.turnDeadline,
      outcomes: data.outcomes.present ? data.outcomes.value : this.outcomes,
      finishedAt: data.finishedAt.present
          ? data.finishedAt.value
          : this.finishedAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      framesComplete: data.framesComplete.present
          ? data.framesComplete.value
          : this.framesComplete,
      lastOpenedAt: data.lastOpenedAt.present
          ? data.lastOpenedAt.value
          : this.lastOpenedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('GameRow(')
          ..write('accountId: $accountId, ')
          ..write('id: $id, ')
          ..write('seq: $seq, ')
          ..write('createdBy: $createdBy, ')
          ..write('status: $status, ')
          ..write('access: $access, ')
          ..write('origin: $origin, ')
          ..write('schemaVersion: $schemaVersion, ')
          ..write('config: $config, ')
          ..write('turnSeconds: $turnSeconds, ')
          ..write('budgetSeconds: $budgetSeconds, ')
          ..write('incrementSeconds: $incrementSeconds, ')
          ..write('rated: $rated, ')
          ..write('ratingPool: $ratingPool, ')
          ..write('minPlayers: $minPlayers, ')
          ..write('maxPlayers: $maxPlayers, ')
          ..write('shortCode: $shortCode, ')
          ..write('pendingPlayers: $pendingPlayers, ')
          ..write('turnDeadline: $turnDeadline, ')
          ..write('outcomes: $outcomes, ')
          ..write('finishedAt: $finishedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('framesComplete: $framesComplete, ')
          ..write('lastOpenedAt: $lastOpenedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hashAll([
    accountId,
    id,
    seq,
    createdBy,
    status,
    access,
    origin,
    schemaVersion,
    config,
    turnSeconds,
    budgetSeconds,
    incrementSeconds,
    rated,
    ratingPool,
    minPlayers,
    maxPlayers,
    shortCode,
    pendingPlayers,
    turnDeadline,
    outcomes,
    finishedAt,
    createdAt,
    updatedAt,
    framesComplete,
    lastOpenedAt,
  ]);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is GameRow &&
          other.accountId == this.accountId &&
          other.id == this.id &&
          other.seq == this.seq &&
          other.createdBy == this.createdBy &&
          other.status == this.status &&
          other.access == this.access &&
          other.origin == this.origin &&
          other.schemaVersion == this.schemaVersion &&
          other.config == this.config &&
          other.turnSeconds == this.turnSeconds &&
          other.budgetSeconds == this.budgetSeconds &&
          other.incrementSeconds == this.incrementSeconds &&
          other.rated == this.rated &&
          other.ratingPool == this.ratingPool &&
          other.minPlayers == this.minPlayers &&
          other.maxPlayers == this.maxPlayers &&
          other.shortCode == this.shortCode &&
          other.pendingPlayers == this.pendingPlayers &&
          other.turnDeadline == this.turnDeadline &&
          other.outcomes == this.outcomes &&
          other.finishedAt == this.finishedAt &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.framesComplete == this.framesComplete &&
          other.lastOpenedAt == this.lastOpenedAt);
}

class GamesCompanion extends UpdateCompanion<GameRow> {
  final Value<String> accountId;
  final Value<String> id;
  final Value<int> seq;
  final Value<String?> createdBy;
  final Value<GameStatus> status;
  final Value<GameAccess> access;
  final Value<GameOrigin> origin;
  final Value<int> schemaVersion;
  final Value<Map<String, dynamic>> config;
  final Value<int?> turnSeconds;
  final Value<int?> budgetSeconds;
  final Value<int?> incrementSeconds;
  final Value<bool> rated;
  final Value<String?> ratingPool;
  final Value<int> minPlayers;
  final Value<int> maxPlayers;
  final Value<String> shortCode;
  final Value<List<int>?> pendingPlayers;
  final Value<int?> turnDeadline;
  final Value<List<Outcome>?> outcomes;
  final Value<int?> finishedAt;
  final Value<int> createdAt;
  final Value<int> updatedAt;
  final Value<bool> framesComplete;
  final Value<int?> lastOpenedAt;
  final Value<int> rowid;
  const GamesCompanion({
    this.accountId = const Value.absent(),
    this.id = const Value.absent(),
    this.seq = const Value.absent(),
    this.createdBy = const Value.absent(),
    this.status = const Value.absent(),
    this.access = const Value.absent(),
    this.origin = const Value.absent(),
    this.schemaVersion = const Value.absent(),
    this.config = const Value.absent(),
    this.turnSeconds = const Value.absent(),
    this.budgetSeconds = const Value.absent(),
    this.incrementSeconds = const Value.absent(),
    this.rated = const Value.absent(),
    this.ratingPool = const Value.absent(),
    this.minPlayers = const Value.absent(),
    this.maxPlayers = const Value.absent(),
    this.shortCode = const Value.absent(),
    this.pendingPlayers = const Value.absent(),
    this.turnDeadline = const Value.absent(),
    this.outcomes = const Value.absent(),
    this.finishedAt = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.framesComplete = const Value.absent(),
    this.lastOpenedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  GamesCompanion.insert({
    required String accountId,
    required String id,
    required int seq,
    this.createdBy = const Value.absent(),
    required GameStatus status,
    required GameAccess access,
    required GameOrigin origin,
    required int schemaVersion,
    required Map<String, dynamic> config,
    this.turnSeconds = const Value.absent(),
    this.budgetSeconds = const Value.absent(),
    this.incrementSeconds = const Value.absent(),
    required bool rated,
    this.ratingPool = const Value.absent(),
    required int minPlayers,
    required int maxPlayers,
    required String shortCode,
    this.pendingPlayers = const Value.absent(),
    this.turnDeadline = const Value.absent(),
    this.outcomes = const Value.absent(),
    this.finishedAt = const Value.absent(),
    required int createdAt,
    required int updatedAt,
    this.framesComplete = const Value.absent(),
    this.lastOpenedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : accountId = Value(accountId),
       id = Value(id),
       seq = Value(seq),
       status = Value(status),
       access = Value(access),
       origin = Value(origin),
       schemaVersion = Value(schemaVersion),
       config = Value(config),
       rated = Value(rated),
       minPlayers = Value(minPlayers),
       maxPlayers = Value(maxPlayers),
       shortCode = Value(shortCode),
       createdAt = Value(createdAt),
       updatedAt = Value(updatedAt);
  static Insertable<GameRow> custom({
    Expression<String>? accountId,
    Expression<String>? id,
    Expression<int>? seq,
    Expression<String>? createdBy,
    Expression<String>? status,
    Expression<String>? access,
    Expression<String>? origin,
    Expression<int>? schemaVersion,
    Expression<String>? config,
    Expression<int>? turnSeconds,
    Expression<int>? budgetSeconds,
    Expression<int>? incrementSeconds,
    Expression<bool>? rated,
    Expression<String>? ratingPool,
    Expression<int>? minPlayers,
    Expression<int>? maxPlayers,
    Expression<String>? shortCode,
    Expression<String>? pendingPlayers,
    Expression<int>? turnDeadline,
    Expression<String>? outcomes,
    Expression<int>? finishedAt,
    Expression<int>? createdAt,
    Expression<int>? updatedAt,
    Expression<bool>? framesComplete,
    Expression<int>? lastOpenedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (accountId != null) 'account_id': accountId,
      if (id != null) 'id': id,
      if (seq != null) 'seq': seq,
      if (createdBy != null) 'created_by': createdBy,
      if (status != null) 'status': status,
      if (access != null) 'access': access,
      if (origin != null) 'origin': origin,
      if (schemaVersion != null) 'schema_version': schemaVersion,
      if (config != null) 'config': config,
      if (turnSeconds != null) 'turn_seconds': turnSeconds,
      if (budgetSeconds != null) 'budget_seconds': budgetSeconds,
      if (incrementSeconds != null) 'increment_seconds': incrementSeconds,
      if (rated != null) 'rated': rated,
      if (ratingPool != null) 'rating_pool': ratingPool,
      if (minPlayers != null) 'min_players': minPlayers,
      if (maxPlayers != null) 'max_players': maxPlayers,
      if (shortCode != null) 'short_code': shortCode,
      if (pendingPlayers != null) 'pending_players': pendingPlayers,
      if (turnDeadline != null) 'turn_deadline': turnDeadline,
      if (outcomes != null) 'outcomes': outcomes,
      if (finishedAt != null) 'finished_at': finishedAt,
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (framesComplete != null) 'frames_complete': framesComplete,
      if (lastOpenedAt != null) 'last_opened_at': lastOpenedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  GamesCompanion copyWith({
    Value<String>? accountId,
    Value<String>? id,
    Value<int>? seq,
    Value<String?>? createdBy,
    Value<GameStatus>? status,
    Value<GameAccess>? access,
    Value<GameOrigin>? origin,
    Value<int>? schemaVersion,
    Value<Map<String, dynamic>>? config,
    Value<int?>? turnSeconds,
    Value<int?>? budgetSeconds,
    Value<int?>? incrementSeconds,
    Value<bool>? rated,
    Value<String?>? ratingPool,
    Value<int>? minPlayers,
    Value<int>? maxPlayers,
    Value<String>? shortCode,
    Value<List<int>?>? pendingPlayers,
    Value<int?>? turnDeadline,
    Value<List<Outcome>?>? outcomes,
    Value<int?>? finishedAt,
    Value<int>? createdAt,
    Value<int>? updatedAt,
    Value<bool>? framesComplete,
    Value<int?>? lastOpenedAt,
    Value<int>? rowid,
  }) {
    return GamesCompanion(
      accountId: accountId ?? this.accountId,
      id: id ?? this.id,
      seq: seq ?? this.seq,
      createdBy: createdBy ?? this.createdBy,
      status: status ?? this.status,
      access: access ?? this.access,
      origin: origin ?? this.origin,
      schemaVersion: schemaVersion ?? this.schemaVersion,
      config: config ?? this.config,
      turnSeconds: turnSeconds ?? this.turnSeconds,
      budgetSeconds: budgetSeconds ?? this.budgetSeconds,
      incrementSeconds: incrementSeconds ?? this.incrementSeconds,
      rated: rated ?? this.rated,
      ratingPool: ratingPool ?? this.ratingPool,
      minPlayers: minPlayers ?? this.minPlayers,
      maxPlayers: maxPlayers ?? this.maxPlayers,
      shortCode: shortCode ?? this.shortCode,
      pendingPlayers: pendingPlayers ?? this.pendingPlayers,
      turnDeadline: turnDeadline ?? this.turnDeadline,
      outcomes: outcomes ?? this.outcomes,
      finishedAt: finishedAt ?? this.finishedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      framesComplete: framesComplete ?? this.framesComplete,
      lastOpenedAt: lastOpenedAt ?? this.lastOpenedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (accountId.present) {
      map['account_id'] = Variable<String>(accountId.value);
    }
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (seq.present) {
      map['seq'] = Variable<int>(seq.value);
    }
    if (createdBy.present) {
      map['created_by'] = Variable<String>(createdBy.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(
        $GamesTable.$converterstatus.toSql(status.value),
      );
    }
    if (access.present) {
      map['access'] = Variable<String>(
        $GamesTable.$converteraccess.toSql(access.value),
      );
    }
    if (origin.present) {
      map['origin'] = Variable<String>(
        $GamesTable.$converterorigin.toSql(origin.value),
      );
    }
    if (schemaVersion.present) {
      map['schema_version'] = Variable<int>(schemaVersion.value);
    }
    if (config.present) {
      map['config'] = Variable<String>(
        $GamesTable.$converterconfig.toSql(config.value),
      );
    }
    if (turnSeconds.present) {
      map['turn_seconds'] = Variable<int>(turnSeconds.value);
    }
    if (budgetSeconds.present) {
      map['budget_seconds'] = Variable<int>(budgetSeconds.value);
    }
    if (incrementSeconds.present) {
      map['increment_seconds'] = Variable<int>(incrementSeconds.value);
    }
    if (rated.present) {
      map['rated'] = Variable<bool>(rated.value);
    }
    if (ratingPool.present) {
      map['rating_pool'] = Variable<String>(ratingPool.value);
    }
    if (minPlayers.present) {
      map['min_players'] = Variable<int>(minPlayers.value);
    }
    if (maxPlayers.present) {
      map['max_players'] = Variable<int>(maxPlayers.value);
    }
    if (shortCode.present) {
      map['short_code'] = Variable<String>(shortCode.value);
    }
    if (pendingPlayers.present) {
      map['pending_players'] = Variable<String>(
        $GamesTable.$converterpendingPlayersn.toSql(pendingPlayers.value),
      );
    }
    if (turnDeadline.present) {
      map['turn_deadline'] = Variable<int>(turnDeadline.value);
    }
    if (outcomes.present) {
      map['outcomes'] = Variable<String>(
        $GamesTable.$converteroutcomesn.toSql(outcomes.value),
      );
    }
    if (finishedAt.present) {
      map['finished_at'] = Variable<int>(finishedAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (framesComplete.present) {
      map['frames_complete'] = Variable<bool>(framesComplete.value);
    }
    if (lastOpenedAt.present) {
      map['last_opened_at'] = Variable<int>(lastOpenedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('GamesCompanion(')
          ..write('accountId: $accountId, ')
          ..write('id: $id, ')
          ..write('seq: $seq, ')
          ..write('createdBy: $createdBy, ')
          ..write('status: $status, ')
          ..write('access: $access, ')
          ..write('origin: $origin, ')
          ..write('schemaVersion: $schemaVersion, ')
          ..write('config: $config, ')
          ..write('turnSeconds: $turnSeconds, ')
          ..write('budgetSeconds: $budgetSeconds, ')
          ..write('incrementSeconds: $incrementSeconds, ')
          ..write('rated: $rated, ')
          ..write('ratingPool: $ratingPool, ')
          ..write('minPlayers: $minPlayers, ')
          ..write('maxPlayers: $maxPlayers, ')
          ..write('shortCode: $shortCode, ')
          ..write('pendingPlayers: $pendingPlayers, ')
          ..write('turnDeadline: $turnDeadline, ')
          ..write('outcomes: $outcomes, ')
          ..write('finishedAt: $finishedAt, ')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('framesComplete: $framesComplete, ')
          ..write('lastOpenedAt: $lastOpenedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ParticipantsTable extends Participants
    with TableInfo<$ParticipantsTable, ParticipantRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ParticipantsTable(this.attachedDatabase, [this._alias]);
  @override
  late final GeneratedColumn<String> accountId = GeneratedColumn<String>(
    'account_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> gameId = GeneratedColumn<String>(
    'game_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> playerIndex = GeneratedColumn<int>(
    'player_index',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<String> botId = GeneratedColumn<String>(
    'bot_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumnWithTypeConverter<SeatTypeEnum, String> type =
      GeneratedColumn<String>(
        'type',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      ).withConverter<SeatTypeEnum>($ParticipantsTable.$convertertype);
  @override
  List<GeneratedColumn> get $columns => [
    accountId,
    gameId,
    playerIndex,
    userId,
    botId,
    type,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'participants';
  @override
  Set<GeneratedColumn> get $primaryKey => {accountId, gameId, playerIndex};
  @override
  ParticipantRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ParticipantRow(
      accountId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}account_id'],
      )!,
      gameId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}game_id'],
      )!,
      playerIndex: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}player_index'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      ),
      botId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}bot_id'],
      ),
      type: $ParticipantsTable.$convertertype.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}type'],
        )!,
      ),
    );
  }

  @override
  $ParticipantsTable createAlias(String alias) {
    return $ParticipantsTable(attachedDatabase, alias);
  }

  static TypeConverter<SeatTypeEnum, String> $convertertype = seatTypeConverter;
}

class ParticipantRow extends DataClass implements Insertable<ParticipantRow> {
  final String accountId;
  final String gameId;
  final int playerIndex;
  final String? userId;
  final String? botId;
  final SeatTypeEnum type;
  const ParticipantRow({
    required this.accountId,
    required this.gameId,
    required this.playerIndex,
    this.userId,
    this.botId,
    required this.type,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['account_id'] = Variable<String>(accountId);
    map['game_id'] = Variable<String>(gameId);
    map['player_index'] = Variable<int>(playerIndex);
    if (!nullToAbsent || userId != null) {
      map['user_id'] = Variable<String>(userId);
    }
    if (!nullToAbsent || botId != null) {
      map['bot_id'] = Variable<String>(botId);
    }
    {
      map['type'] = Variable<String>(
        $ParticipantsTable.$convertertype.toSql(type),
      );
    }
    return map;
  }

  ParticipantsCompanion toCompanion(bool nullToAbsent) {
    return ParticipantsCompanion(
      accountId: Value(accountId),
      gameId: Value(gameId),
      playerIndex: Value(playerIndex),
      userId: userId == null && nullToAbsent
          ? const Value.absent()
          : Value(userId),
      botId: botId == null && nullToAbsent
          ? const Value.absent()
          : Value(botId),
      type: Value(type),
    );
  }

  factory ParticipantRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ParticipantRow(
      accountId: serializer.fromJson<String>(json['accountId']),
      gameId: serializer.fromJson<String>(json['gameId']),
      playerIndex: serializer.fromJson<int>(json['playerIndex']),
      userId: serializer.fromJson<String?>(json['userId']),
      botId: serializer.fromJson<String?>(json['botId']),
      type: serializer.fromJson<SeatTypeEnum>(json['type']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'accountId': serializer.toJson<String>(accountId),
      'gameId': serializer.toJson<String>(gameId),
      'playerIndex': serializer.toJson<int>(playerIndex),
      'userId': serializer.toJson<String?>(userId),
      'botId': serializer.toJson<String?>(botId),
      'type': serializer.toJson<SeatTypeEnum>(type),
    };
  }

  ParticipantRow copyWith({
    String? accountId,
    String? gameId,
    int? playerIndex,
    Value<String?> userId = const Value.absent(),
    Value<String?> botId = const Value.absent(),
    SeatTypeEnum? type,
  }) => ParticipantRow(
    accountId: accountId ?? this.accountId,
    gameId: gameId ?? this.gameId,
    playerIndex: playerIndex ?? this.playerIndex,
    userId: userId.present ? userId.value : this.userId,
    botId: botId.present ? botId.value : this.botId,
    type: type ?? this.type,
  );
  ParticipantRow copyWithCompanion(ParticipantsCompanion data) {
    return ParticipantRow(
      accountId: data.accountId.present ? data.accountId.value : this.accountId,
      gameId: data.gameId.present ? data.gameId.value : this.gameId,
      playerIndex: data.playerIndex.present
          ? data.playerIndex.value
          : this.playerIndex,
      userId: data.userId.present ? data.userId.value : this.userId,
      botId: data.botId.present ? data.botId.value : this.botId,
      type: data.type.present ? data.type.value : this.type,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ParticipantRow(')
          ..write('accountId: $accountId, ')
          ..write('gameId: $gameId, ')
          ..write('playerIndex: $playerIndex, ')
          ..write('userId: $userId, ')
          ..write('botId: $botId, ')
          ..write('type: $type')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(accountId, gameId, playerIndex, userId, botId, type);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ParticipantRow &&
          other.accountId == this.accountId &&
          other.gameId == this.gameId &&
          other.playerIndex == this.playerIndex &&
          other.userId == this.userId &&
          other.botId == this.botId &&
          other.type == this.type);
}

class ParticipantsCompanion extends UpdateCompanion<ParticipantRow> {
  final Value<String> accountId;
  final Value<String> gameId;
  final Value<int> playerIndex;
  final Value<String?> userId;
  final Value<String?> botId;
  final Value<SeatTypeEnum> type;
  final Value<int> rowid;
  const ParticipantsCompanion({
    this.accountId = const Value.absent(),
    this.gameId = const Value.absent(),
    this.playerIndex = const Value.absent(),
    this.userId = const Value.absent(),
    this.botId = const Value.absent(),
    this.type = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ParticipantsCompanion.insert({
    required String accountId,
    required String gameId,
    required int playerIndex,
    this.userId = const Value.absent(),
    this.botId = const Value.absent(),
    required SeatTypeEnum type,
    this.rowid = const Value.absent(),
  }) : accountId = Value(accountId),
       gameId = Value(gameId),
       playerIndex = Value(playerIndex),
       type = Value(type);
  static Insertable<ParticipantRow> custom({
    Expression<String>? accountId,
    Expression<String>? gameId,
    Expression<int>? playerIndex,
    Expression<String>? userId,
    Expression<String>? botId,
    Expression<String>? type,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (accountId != null) 'account_id': accountId,
      if (gameId != null) 'game_id': gameId,
      if (playerIndex != null) 'player_index': playerIndex,
      if (userId != null) 'user_id': userId,
      if (botId != null) 'bot_id': botId,
      if (type != null) 'type': type,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ParticipantsCompanion copyWith({
    Value<String>? accountId,
    Value<String>? gameId,
    Value<int>? playerIndex,
    Value<String?>? userId,
    Value<String?>? botId,
    Value<SeatTypeEnum>? type,
    Value<int>? rowid,
  }) {
    return ParticipantsCompanion(
      accountId: accountId ?? this.accountId,
      gameId: gameId ?? this.gameId,
      playerIndex: playerIndex ?? this.playerIndex,
      userId: userId ?? this.userId,
      botId: botId ?? this.botId,
      type: type ?? this.type,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (accountId.present) {
      map['account_id'] = Variable<String>(accountId.value);
    }
    if (gameId.present) {
      map['game_id'] = Variable<String>(gameId.value);
    }
    if (playerIndex.present) {
      map['player_index'] = Variable<int>(playerIndex.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (botId.present) {
      map['bot_id'] = Variable<String>(botId.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(
        $ParticipantsTable.$convertertype.toSql(type.value),
      );
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ParticipantsCompanion(')
          ..write('accountId: $accountId, ')
          ..write('gameId: $gameId, ')
          ..write('playerIndex: $playerIndex, ')
          ..write('userId: $userId, ')
          ..write('botId: $botId, ')
          ..write('type: $type, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PlayerRatingsTable extends PlayerRatings
    with TableInfo<$PlayerRatingsTable, PlayerRatingRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PlayerRatingsTable(this.attachedDatabase, [this._alias]);
  @override
  late final GeneratedColumn<String> playerId = GeneratedColumn<String>(
    'player_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> pool = GeneratedColumn<String>(
    'pool',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<double> mu = GeneratedColumn<double>(
    'mu',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<double> sigma = GeneratedColumn<double>(
    'sigma',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> displayRating = GeneratedColumn<int>(
    'display_rating',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> updatedAt = GeneratedColumn<int>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    playerId,
    pool,
    mu,
    sigma,
    displayRating,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'player_ratings';
  @override
  Set<GeneratedColumn> get $primaryKey => {playerId, pool};
  @override
  PlayerRatingRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PlayerRatingRow(
      playerId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}player_id'],
      )!,
      pool: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pool'],
      )!,
      mu: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}mu'],
      )!,
      sigma: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}sigma'],
      )!,
      displayRating: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}display_rating'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $PlayerRatingsTable createAlias(String alias) {
    return $PlayerRatingsTable(attachedDatabase, alias);
  }
}

class PlayerRatingRow extends DataClass implements Insertable<PlayerRatingRow> {
  final String playerId;
  final String pool;
  final double mu;
  final double sigma;
  final int displayRating;
  final int updatedAt;
  const PlayerRatingRow({
    required this.playerId,
    required this.pool,
    required this.mu,
    required this.sigma,
    required this.displayRating,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['player_id'] = Variable<String>(playerId);
    map['pool'] = Variable<String>(pool);
    map['mu'] = Variable<double>(mu);
    map['sigma'] = Variable<double>(sigma);
    map['display_rating'] = Variable<int>(displayRating);
    map['updated_at'] = Variable<int>(updatedAt);
    return map;
  }

  PlayerRatingsCompanion toCompanion(bool nullToAbsent) {
    return PlayerRatingsCompanion(
      playerId: Value(playerId),
      pool: Value(pool),
      mu: Value(mu),
      sigma: Value(sigma),
      displayRating: Value(displayRating),
      updatedAt: Value(updatedAt),
    );
  }

  factory PlayerRatingRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PlayerRatingRow(
      playerId: serializer.fromJson<String>(json['playerId']),
      pool: serializer.fromJson<String>(json['pool']),
      mu: serializer.fromJson<double>(json['mu']),
      sigma: serializer.fromJson<double>(json['sigma']),
      displayRating: serializer.fromJson<int>(json['displayRating']),
      updatedAt: serializer.fromJson<int>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'playerId': serializer.toJson<String>(playerId),
      'pool': serializer.toJson<String>(pool),
      'mu': serializer.toJson<double>(mu),
      'sigma': serializer.toJson<double>(sigma),
      'displayRating': serializer.toJson<int>(displayRating),
      'updatedAt': serializer.toJson<int>(updatedAt),
    };
  }

  PlayerRatingRow copyWith({
    String? playerId,
    String? pool,
    double? mu,
    double? sigma,
    int? displayRating,
    int? updatedAt,
  }) => PlayerRatingRow(
    playerId: playerId ?? this.playerId,
    pool: pool ?? this.pool,
    mu: mu ?? this.mu,
    sigma: sigma ?? this.sigma,
    displayRating: displayRating ?? this.displayRating,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  PlayerRatingRow copyWithCompanion(PlayerRatingsCompanion data) {
    return PlayerRatingRow(
      playerId: data.playerId.present ? data.playerId.value : this.playerId,
      pool: data.pool.present ? data.pool.value : this.pool,
      mu: data.mu.present ? data.mu.value : this.mu,
      sigma: data.sigma.present ? data.sigma.value : this.sigma,
      displayRating: data.displayRating.present
          ? data.displayRating.value
          : this.displayRating,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PlayerRatingRow(')
          ..write('playerId: $playerId, ')
          ..write('pool: $pool, ')
          ..write('mu: $mu, ')
          ..write('sigma: $sigma, ')
          ..write('displayRating: $displayRating, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(playerId, pool, mu, sigma, displayRating, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PlayerRatingRow &&
          other.playerId == this.playerId &&
          other.pool == this.pool &&
          other.mu == this.mu &&
          other.sigma == this.sigma &&
          other.displayRating == this.displayRating &&
          other.updatedAt == this.updatedAt);
}

class PlayerRatingsCompanion extends UpdateCompanion<PlayerRatingRow> {
  final Value<String> playerId;
  final Value<String> pool;
  final Value<double> mu;
  final Value<double> sigma;
  final Value<int> displayRating;
  final Value<int> updatedAt;
  final Value<int> rowid;
  const PlayerRatingsCompanion({
    this.playerId = const Value.absent(),
    this.pool = const Value.absent(),
    this.mu = const Value.absent(),
    this.sigma = const Value.absent(),
    this.displayRating = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PlayerRatingsCompanion.insert({
    required String playerId,
    required String pool,
    required double mu,
    required double sigma,
    required int displayRating,
    required int updatedAt,
    this.rowid = const Value.absent(),
  }) : playerId = Value(playerId),
       pool = Value(pool),
       mu = Value(mu),
       sigma = Value(sigma),
       displayRating = Value(displayRating),
       updatedAt = Value(updatedAt);
  static Insertable<PlayerRatingRow> custom({
    Expression<String>? playerId,
    Expression<String>? pool,
    Expression<double>? mu,
    Expression<double>? sigma,
    Expression<int>? displayRating,
    Expression<int>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (playerId != null) 'player_id': playerId,
      if (pool != null) 'pool': pool,
      if (mu != null) 'mu': mu,
      if (sigma != null) 'sigma': sigma,
      if (displayRating != null) 'display_rating': displayRating,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PlayerRatingsCompanion copyWith({
    Value<String>? playerId,
    Value<String>? pool,
    Value<double>? mu,
    Value<double>? sigma,
    Value<int>? displayRating,
    Value<int>? updatedAt,
    Value<int>? rowid,
  }) {
    return PlayerRatingsCompanion(
      playerId: playerId ?? this.playerId,
      pool: pool ?? this.pool,
      mu: mu ?? this.mu,
      sigma: sigma ?? this.sigma,
      displayRating: displayRating ?? this.displayRating,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (playerId.present) {
      map['player_id'] = Variable<String>(playerId.value);
    }
    if (pool.present) {
      map['pool'] = Variable<String>(pool.value);
    }
    if (mu.present) {
      map['mu'] = Variable<double>(mu.value);
    }
    if (sigma.present) {
      map['sigma'] = Variable<double>(sigma.value);
    }
    if (displayRating.present) {
      map['display_rating'] = Variable<int>(displayRating.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<int>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PlayerRatingsCompanion(')
          ..write('playerId: $playerId, ')
          ..write('pool: $pool, ')
          ..write('mu: $mu, ')
          ..write('sigma: $sigma, ')
          ..write('displayRating: $displayRating, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $RatingHistoryTable extends RatingHistory
    with TableInfo<$RatingHistoryTable, RatingHistoryRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RatingHistoryTable(this.attachedDatabase, [this._alias]);
  @override
  late final GeneratedColumn<String> accountId = GeneratedColumn<String>(
    'account_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> gameId = GeneratedColumn<String>(
    'game_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> identity = GeneratedColumn<String>(
    'identity',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<String> botId = GeneratedColumn<String>(
    'bot_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumn<String> pool = GeneratedColumn<String>(
    'pool',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<double> muBefore = GeneratedColumn<double>(
    'mu_before',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<double> sigmaBefore = GeneratedColumn<double>(
    'sigma_before',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> displayBefore = GeneratedColumn<int>(
    'display_before',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<double> muAfter = GeneratedColumn<double>(
    'mu_after',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<double> sigmaAfter = GeneratedColumn<double>(
    'sigma_after',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> displayAfter = GeneratedColumn<int>(
    'display_after',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> displayChange = GeneratedColumn<int>(
    'display_change',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    accountId,
    gameId,
    identity,
    userId,
    botId,
    pool,
    muBefore,
    sigmaBefore,
    displayBefore,
    muAfter,
    sigmaAfter,
    displayAfter,
    displayChange,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'rating_history';
  @override
  Set<GeneratedColumn> get $primaryKey => {accountId, gameId, identity};
  @override
  RatingHistoryRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RatingHistoryRow(
      accountId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}account_id'],
      )!,
      gameId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}game_id'],
      )!,
      identity: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}identity'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      ),
      botId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}bot_id'],
      ),
      pool: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pool'],
      )!,
      muBefore: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}mu_before'],
      )!,
      sigmaBefore: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}sigma_before'],
      )!,
      displayBefore: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}display_before'],
      )!,
      muAfter: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}mu_after'],
      )!,
      sigmaAfter: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}sigma_after'],
      )!,
      displayAfter: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}display_after'],
      )!,
      displayChange: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}display_change'],
      )!,
    );
  }

  @override
  $RatingHistoryTable createAlias(String alias) {
    return $RatingHistoryTable(attachedDatabase, alias);
  }
}

class RatingHistoryRow extends DataClass
    implements Insertable<RatingHistoryRow> {
  final String accountId;
  final String gameId;

  /// `u:<userId>` or `b:<botId>`: exactly one identity per change, spelled as
  /// one non-null key column.
  final String identity;
  final String? userId;
  final String? botId;
  final String pool;
  final double muBefore;
  final double sigmaBefore;
  final int displayBefore;
  final double muAfter;
  final double sigmaAfter;
  final int displayAfter;
  final int displayChange;
  const RatingHistoryRow({
    required this.accountId,
    required this.gameId,
    required this.identity,
    this.userId,
    this.botId,
    required this.pool,
    required this.muBefore,
    required this.sigmaBefore,
    required this.displayBefore,
    required this.muAfter,
    required this.sigmaAfter,
    required this.displayAfter,
    required this.displayChange,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['account_id'] = Variable<String>(accountId);
    map['game_id'] = Variable<String>(gameId);
    map['identity'] = Variable<String>(identity);
    if (!nullToAbsent || userId != null) {
      map['user_id'] = Variable<String>(userId);
    }
    if (!nullToAbsent || botId != null) {
      map['bot_id'] = Variable<String>(botId);
    }
    map['pool'] = Variable<String>(pool);
    map['mu_before'] = Variable<double>(muBefore);
    map['sigma_before'] = Variable<double>(sigmaBefore);
    map['display_before'] = Variable<int>(displayBefore);
    map['mu_after'] = Variable<double>(muAfter);
    map['sigma_after'] = Variable<double>(sigmaAfter);
    map['display_after'] = Variable<int>(displayAfter);
    map['display_change'] = Variable<int>(displayChange);
    return map;
  }

  RatingHistoryCompanion toCompanion(bool nullToAbsent) {
    return RatingHistoryCompanion(
      accountId: Value(accountId),
      gameId: Value(gameId),
      identity: Value(identity),
      userId: userId == null && nullToAbsent
          ? const Value.absent()
          : Value(userId),
      botId: botId == null && nullToAbsent
          ? const Value.absent()
          : Value(botId),
      pool: Value(pool),
      muBefore: Value(muBefore),
      sigmaBefore: Value(sigmaBefore),
      displayBefore: Value(displayBefore),
      muAfter: Value(muAfter),
      sigmaAfter: Value(sigmaAfter),
      displayAfter: Value(displayAfter),
      displayChange: Value(displayChange),
    );
  }

  factory RatingHistoryRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RatingHistoryRow(
      accountId: serializer.fromJson<String>(json['accountId']),
      gameId: serializer.fromJson<String>(json['gameId']),
      identity: serializer.fromJson<String>(json['identity']),
      userId: serializer.fromJson<String?>(json['userId']),
      botId: serializer.fromJson<String?>(json['botId']),
      pool: serializer.fromJson<String>(json['pool']),
      muBefore: serializer.fromJson<double>(json['muBefore']),
      sigmaBefore: serializer.fromJson<double>(json['sigmaBefore']),
      displayBefore: serializer.fromJson<int>(json['displayBefore']),
      muAfter: serializer.fromJson<double>(json['muAfter']),
      sigmaAfter: serializer.fromJson<double>(json['sigmaAfter']),
      displayAfter: serializer.fromJson<int>(json['displayAfter']),
      displayChange: serializer.fromJson<int>(json['displayChange']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'accountId': serializer.toJson<String>(accountId),
      'gameId': serializer.toJson<String>(gameId),
      'identity': serializer.toJson<String>(identity),
      'userId': serializer.toJson<String?>(userId),
      'botId': serializer.toJson<String?>(botId),
      'pool': serializer.toJson<String>(pool),
      'muBefore': serializer.toJson<double>(muBefore),
      'sigmaBefore': serializer.toJson<double>(sigmaBefore),
      'displayBefore': serializer.toJson<int>(displayBefore),
      'muAfter': serializer.toJson<double>(muAfter),
      'sigmaAfter': serializer.toJson<double>(sigmaAfter),
      'displayAfter': serializer.toJson<int>(displayAfter),
      'displayChange': serializer.toJson<int>(displayChange),
    };
  }

  RatingHistoryRow copyWith({
    String? accountId,
    String? gameId,
    String? identity,
    Value<String?> userId = const Value.absent(),
    Value<String?> botId = const Value.absent(),
    String? pool,
    double? muBefore,
    double? sigmaBefore,
    int? displayBefore,
    double? muAfter,
    double? sigmaAfter,
    int? displayAfter,
    int? displayChange,
  }) => RatingHistoryRow(
    accountId: accountId ?? this.accountId,
    gameId: gameId ?? this.gameId,
    identity: identity ?? this.identity,
    userId: userId.present ? userId.value : this.userId,
    botId: botId.present ? botId.value : this.botId,
    pool: pool ?? this.pool,
    muBefore: muBefore ?? this.muBefore,
    sigmaBefore: sigmaBefore ?? this.sigmaBefore,
    displayBefore: displayBefore ?? this.displayBefore,
    muAfter: muAfter ?? this.muAfter,
    sigmaAfter: sigmaAfter ?? this.sigmaAfter,
    displayAfter: displayAfter ?? this.displayAfter,
    displayChange: displayChange ?? this.displayChange,
  );
  RatingHistoryRow copyWithCompanion(RatingHistoryCompanion data) {
    return RatingHistoryRow(
      accountId: data.accountId.present ? data.accountId.value : this.accountId,
      gameId: data.gameId.present ? data.gameId.value : this.gameId,
      identity: data.identity.present ? data.identity.value : this.identity,
      userId: data.userId.present ? data.userId.value : this.userId,
      botId: data.botId.present ? data.botId.value : this.botId,
      pool: data.pool.present ? data.pool.value : this.pool,
      muBefore: data.muBefore.present ? data.muBefore.value : this.muBefore,
      sigmaBefore: data.sigmaBefore.present
          ? data.sigmaBefore.value
          : this.sigmaBefore,
      displayBefore: data.displayBefore.present
          ? data.displayBefore.value
          : this.displayBefore,
      muAfter: data.muAfter.present ? data.muAfter.value : this.muAfter,
      sigmaAfter: data.sigmaAfter.present
          ? data.sigmaAfter.value
          : this.sigmaAfter,
      displayAfter: data.displayAfter.present
          ? data.displayAfter.value
          : this.displayAfter,
      displayChange: data.displayChange.present
          ? data.displayChange.value
          : this.displayChange,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RatingHistoryRow(')
          ..write('accountId: $accountId, ')
          ..write('gameId: $gameId, ')
          ..write('identity: $identity, ')
          ..write('userId: $userId, ')
          ..write('botId: $botId, ')
          ..write('pool: $pool, ')
          ..write('muBefore: $muBefore, ')
          ..write('sigmaBefore: $sigmaBefore, ')
          ..write('displayBefore: $displayBefore, ')
          ..write('muAfter: $muAfter, ')
          ..write('sigmaAfter: $sigmaAfter, ')
          ..write('displayAfter: $displayAfter, ')
          ..write('displayChange: $displayChange')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    accountId,
    gameId,
    identity,
    userId,
    botId,
    pool,
    muBefore,
    sigmaBefore,
    displayBefore,
    muAfter,
    sigmaAfter,
    displayAfter,
    displayChange,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RatingHistoryRow &&
          other.accountId == this.accountId &&
          other.gameId == this.gameId &&
          other.identity == this.identity &&
          other.userId == this.userId &&
          other.botId == this.botId &&
          other.pool == this.pool &&
          other.muBefore == this.muBefore &&
          other.sigmaBefore == this.sigmaBefore &&
          other.displayBefore == this.displayBefore &&
          other.muAfter == this.muAfter &&
          other.sigmaAfter == this.sigmaAfter &&
          other.displayAfter == this.displayAfter &&
          other.displayChange == this.displayChange);
}

class RatingHistoryCompanion extends UpdateCompanion<RatingHistoryRow> {
  final Value<String> accountId;
  final Value<String> gameId;
  final Value<String> identity;
  final Value<String?> userId;
  final Value<String?> botId;
  final Value<String> pool;
  final Value<double> muBefore;
  final Value<double> sigmaBefore;
  final Value<int> displayBefore;
  final Value<double> muAfter;
  final Value<double> sigmaAfter;
  final Value<int> displayAfter;
  final Value<int> displayChange;
  final Value<int> rowid;
  const RatingHistoryCompanion({
    this.accountId = const Value.absent(),
    this.gameId = const Value.absent(),
    this.identity = const Value.absent(),
    this.userId = const Value.absent(),
    this.botId = const Value.absent(),
    this.pool = const Value.absent(),
    this.muBefore = const Value.absent(),
    this.sigmaBefore = const Value.absent(),
    this.displayBefore = const Value.absent(),
    this.muAfter = const Value.absent(),
    this.sigmaAfter = const Value.absent(),
    this.displayAfter = const Value.absent(),
    this.displayChange = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  RatingHistoryCompanion.insert({
    required String accountId,
    required String gameId,
    required String identity,
    this.userId = const Value.absent(),
    this.botId = const Value.absent(),
    required String pool,
    required double muBefore,
    required double sigmaBefore,
    required int displayBefore,
    required double muAfter,
    required double sigmaAfter,
    required int displayAfter,
    required int displayChange,
    this.rowid = const Value.absent(),
  }) : accountId = Value(accountId),
       gameId = Value(gameId),
       identity = Value(identity),
       pool = Value(pool),
       muBefore = Value(muBefore),
       sigmaBefore = Value(sigmaBefore),
       displayBefore = Value(displayBefore),
       muAfter = Value(muAfter),
       sigmaAfter = Value(sigmaAfter),
       displayAfter = Value(displayAfter),
       displayChange = Value(displayChange);
  static Insertable<RatingHistoryRow> custom({
    Expression<String>? accountId,
    Expression<String>? gameId,
    Expression<String>? identity,
    Expression<String>? userId,
    Expression<String>? botId,
    Expression<String>? pool,
    Expression<double>? muBefore,
    Expression<double>? sigmaBefore,
    Expression<int>? displayBefore,
    Expression<double>? muAfter,
    Expression<double>? sigmaAfter,
    Expression<int>? displayAfter,
    Expression<int>? displayChange,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (accountId != null) 'account_id': accountId,
      if (gameId != null) 'game_id': gameId,
      if (identity != null) 'identity': identity,
      if (userId != null) 'user_id': userId,
      if (botId != null) 'bot_id': botId,
      if (pool != null) 'pool': pool,
      if (muBefore != null) 'mu_before': muBefore,
      if (sigmaBefore != null) 'sigma_before': sigmaBefore,
      if (displayBefore != null) 'display_before': displayBefore,
      if (muAfter != null) 'mu_after': muAfter,
      if (sigmaAfter != null) 'sigma_after': sigmaAfter,
      if (displayAfter != null) 'display_after': displayAfter,
      if (displayChange != null) 'display_change': displayChange,
      if (rowid != null) 'rowid': rowid,
    });
  }

  RatingHistoryCompanion copyWith({
    Value<String>? accountId,
    Value<String>? gameId,
    Value<String>? identity,
    Value<String?>? userId,
    Value<String?>? botId,
    Value<String>? pool,
    Value<double>? muBefore,
    Value<double>? sigmaBefore,
    Value<int>? displayBefore,
    Value<double>? muAfter,
    Value<double>? sigmaAfter,
    Value<int>? displayAfter,
    Value<int>? displayChange,
    Value<int>? rowid,
  }) {
    return RatingHistoryCompanion(
      accountId: accountId ?? this.accountId,
      gameId: gameId ?? this.gameId,
      identity: identity ?? this.identity,
      userId: userId ?? this.userId,
      botId: botId ?? this.botId,
      pool: pool ?? this.pool,
      muBefore: muBefore ?? this.muBefore,
      sigmaBefore: sigmaBefore ?? this.sigmaBefore,
      displayBefore: displayBefore ?? this.displayBefore,
      muAfter: muAfter ?? this.muAfter,
      sigmaAfter: sigmaAfter ?? this.sigmaAfter,
      displayAfter: displayAfter ?? this.displayAfter,
      displayChange: displayChange ?? this.displayChange,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (accountId.present) {
      map['account_id'] = Variable<String>(accountId.value);
    }
    if (gameId.present) {
      map['game_id'] = Variable<String>(gameId.value);
    }
    if (identity.present) {
      map['identity'] = Variable<String>(identity.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (botId.present) {
      map['bot_id'] = Variable<String>(botId.value);
    }
    if (pool.present) {
      map['pool'] = Variable<String>(pool.value);
    }
    if (muBefore.present) {
      map['mu_before'] = Variable<double>(muBefore.value);
    }
    if (sigmaBefore.present) {
      map['sigma_before'] = Variable<double>(sigmaBefore.value);
    }
    if (displayBefore.present) {
      map['display_before'] = Variable<int>(displayBefore.value);
    }
    if (muAfter.present) {
      map['mu_after'] = Variable<double>(muAfter.value);
    }
    if (sigmaAfter.present) {
      map['sigma_after'] = Variable<double>(sigmaAfter.value);
    }
    if (displayAfter.present) {
      map['display_after'] = Variable<int>(displayAfter.value);
    }
    if (displayChange.present) {
      map['display_change'] = Variable<int>(displayChange.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RatingHistoryCompanion(')
          ..write('accountId: $accountId, ')
          ..write('gameId: $gameId, ')
          ..write('identity: $identity, ')
          ..write('userId: $userId, ')
          ..write('botId: $botId, ')
          ..write('pool: $pool, ')
          ..write('muBefore: $muBefore, ')
          ..write('sigmaBefore: $sigmaBefore, ')
          ..write('displayBefore: $displayBefore, ')
          ..write('muAfter: $muAfter, ')
          ..write('sigmaAfter: $sigmaAfter, ')
          ..write('displayAfter: $displayAfter, ')
          ..write('displayChange: $displayChange, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $RelationshipsTable extends Relationships
    with TableInfo<$RelationshipsTable, RelationshipRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RelationshipsTable(this.attachedDatabase, [this._alias]);
  @override
  late final GeneratedColumn<String> accountId = GeneratedColumn<String>(
    'account_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
    'user_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<bool> accepted = GeneratedColumn<bool>(
    'accepted',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("accepted" IN (0, 1))',
    ),
  );
  @override
  late final GeneratedColumnWithTypeConverter<
    FriendRequestDirectionEnum?,
    String
  >
  direction =
      GeneratedColumn<String>(
        'direction',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      ).withConverter<FriendRequestDirectionEnum?>(
        $RelationshipsTable.$converterdirectionn,
      );
  @override
  late final GeneratedColumn<int> since = GeneratedColumn<int>(
    'since',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    accountId,
    userId,
    accepted,
    direction,
    since,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'relationships';
  @override
  Set<GeneratedColumn> get $primaryKey => {accountId, userId};
  @override
  RelationshipRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RelationshipRow(
      accountId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}account_id'],
      )!,
      userId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}user_id'],
      )!,
      accepted: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}accepted'],
      )!,
      direction: $RelationshipsTable.$converterdirectionn.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}direction'],
        ),
      ),
      since: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}since'],
      )!,
    );
  }

  @override
  $RelationshipsTable createAlias(String alias) {
    return $RelationshipsTable(attachedDatabase, alias);
  }

  static TypeConverter<FriendRequestDirectionEnum, String> $converterdirection =
      requestDirectionConverter;
  static TypeConverter<FriendRequestDirectionEnum?, String?>
  $converterdirectionn = NullAwareTypeConverter.wrap($converterdirection);
}

class RelationshipRow extends DataClass implements Insertable<RelationshipRow> {
  final String accountId;
  final String userId;

  /// True for an accepted friend, false for a pending request.
  final bool accepted;

  /// A pending request's direction; null for a friend.
  final FriendRequestDirectionEnum? direction;
  final int since;
  const RelationshipRow({
    required this.accountId,
    required this.userId,
    required this.accepted,
    this.direction,
    required this.since,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['account_id'] = Variable<String>(accountId);
    map['user_id'] = Variable<String>(userId);
    map['accepted'] = Variable<bool>(accepted);
    if (!nullToAbsent || direction != null) {
      map['direction'] = Variable<String>(
        $RelationshipsTable.$converterdirectionn.toSql(direction),
      );
    }
    map['since'] = Variable<int>(since);
    return map;
  }

  RelationshipsCompanion toCompanion(bool nullToAbsent) {
    return RelationshipsCompanion(
      accountId: Value(accountId),
      userId: Value(userId),
      accepted: Value(accepted),
      direction: direction == null && nullToAbsent
          ? const Value.absent()
          : Value(direction),
      since: Value(since),
    );
  }

  factory RelationshipRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RelationshipRow(
      accountId: serializer.fromJson<String>(json['accountId']),
      userId: serializer.fromJson<String>(json['userId']),
      accepted: serializer.fromJson<bool>(json['accepted']),
      direction: serializer.fromJson<FriendRequestDirectionEnum?>(
        json['direction'],
      ),
      since: serializer.fromJson<int>(json['since']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'accountId': serializer.toJson<String>(accountId),
      'userId': serializer.toJson<String>(userId),
      'accepted': serializer.toJson<bool>(accepted),
      'direction': serializer.toJson<FriendRequestDirectionEnum?>(direction),
      'since': serializer.toJson<int>(since),
    };
  }

  RelationshipRow copyWith({
    String? accountId,
    String? userId,
    bool? accepted,
    Value<FriendRequestDirectionEnum?> direction = const Value.absent(),
    int? since,
  }) => RelationshipRow(
    accountId: accountId ?? this.accountId,
    userId: userId ?? this.userId,
    accepted: accepted ?? this.accepted,
    direction: direction.present ? direction.value : this.direction,
    since: since ?? this.since,
  );
  RelationshipRow copyWithCompanion(RelationshipsCompanion data) {
    return RelationshipRow(
      accountId: data.accountId.present ? data.accountId.value : this.accountId,
      userId: data.userId.present ? data.userId.value : this.userId,
      accepted: data.accepted.present ? data.accepted.value : this.accepted,
      direction: data.direction.present ? data.direction.value : this.direction,
      since: data.since.present ? data.since.value : this.since,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RelationshipRow(')
          ..write('accountId: $accountId, ')
          ..write('userId: $userId, ')
          ..write('accepted: $accepted, ')
          ..write('direction: $direction, ')
          ..write('since: $since')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(accountId, userId, accepted, direction, since);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RelationshipRow &&
          other.accountId == this.accountId &&
          other.userId == this.userId &&
          other.accepted == this.accepted &&
          other.direction == this.direction &&
          other.since == this.since);
}

class RelationshipsCompanion extends UpdateCompanion<RelationshipRow> {
  final Value<String> accountId;
  final Value<String> userId;
  final Value<bool> accepted;
  final Value<FriendRequestDirectionEnum?> direction;
  final Value<int> since;
  final Value<int> rowid;
  const RelationshipsCompanion({
    this.accountId = const Value.absent(),
    this.userId = const Value.absent(),
    this.accepted = const Value.absent(),
    this.direction = const Value.absent(),
    this.since = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  RelationshipsCompanion.insert({
    required String accountId,
    required String userId,
    required bool accepted,
    this.direction = const Value.absent(),
    required int since,
    this.rowid = const Value.absent(),
  }) : accountId = Value(accountId),
       userId = Value(userId),
       accepted = Value(accepted),
       since = Value(since);
  static Insertable<RelationshipRow> custom({
    Expression<String>? accountId,
    Expression<String>? userId,
    Expression<bool>? accepted,
    Expression<String>? direction,
    Expression<int>? since,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (accountId != null) 'account_id': accountId,
      if (userId != null) 'user_id': userId,
      if (accepted != null) 'accepted': accepted,
      if (direction != null) 'direction': direction,
      if (since != null) 'since': since,
      if (rowid != null) 'rowid': rowid,
    });
  }

  RelationshipsCompanion copyWith({
    Value<String>? accountId,
    Value<String>? userId,
    Value<bool>? accepted,
    Value<FriendRequestDirectionEnum?>? direction,
    Value<int>? since,
    Value<int>? rowid,
  }) {
    return RelationshipsCompanion(
      accountId: accountId ?? this.accountId,
      userId: userId ?? this.userId,
      accepted: accepted ?? this.accepted,
      direction: direction ?? this.direction,
      since: since ?? this.since,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (accountId.present) {
      map['account_id'] = Variable<String>(accountId.value);
    }
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (accepted.present) {
      map['accepted'] = Variable<bool>(accepted.value);
    }
    if (direction.present) {
      map['direction'] = Variable<String>(
        $RelationshipsTable.$converterdirectionn.toSql(direction.value),
      );
    }
    if (since.present) {
      map['since'] = Variable<int>(since.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RelationshipsCompanion(')
          ..write('accountId: $accountId, ')
          ..write('userId: $userId, ')
          ..write('accepted: $accepted, ')
          ..write('direction: $direction, ')
          ..write('since: $since, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $FramesTable extends Frames with TableInfo<$FramesTable, FrameRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $FramesTable(this.attachedDatabase, [this._alias]);
  @override
  late final GeneratedColumn<String> accountId = GeneratedColumn<String>(
    'account_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> gameId = GeneratedColumn<String>(
    'game_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> version = GeneratedColumn<int>(
    'version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumnWithTypeConverter<Map<String, dynamic>, String>
  data = GeneratedColumn<String>(
    'data',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  ).withConverter<Map<String, dynamic>>($FramesTable.$converterdata);
  @override
  late final GeneratedColumnWithTypeConverter<List<int>, String>
  pendingPlayers = GeneratedColumn<String>(
    'pending_players',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  ).withConverter<List<int>>($FramesTable.$converterpendingPlayers);
  @override
  late final GeneratedColumn<int> deadline = GeneratedColumn<int>(
    'deadline',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumnWithTypeConverter<List<int>?, String> playerTimes =
      GeneratedColumn<String>(
        'player_times',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      ).withConverter<List<int>?>($FramesTable.$converterplayerTimesn);
  @override
  late final GeneratedColumnWithTypeConverter<List<Outcome>?, String> outcomes =
      GeneratedColumn<String>(
        'outcomes',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      ).withConverter<List<Outcome>?>($FramesTable.$converteroutcomesn);
  @override
  late final GeneratedColumnWithTypeConverter<List<RatingDelta>?, String>
  ratings = GeneratedColumn<String>(
    'ratings',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  ).withConverter<List<RatingDelta>?>($FramesTable.$converterratingsn);
  @override
  List<GeneratedColumn> get $columns => [
    accountId,
    gameId,
    version,
    data,
    pendingPlayers,
    deadline,
    playerTimes,
    outcomes,
    ratings,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'frames';
  @override
  Set<GeneratedColumn> get $primaryKey => {accountId, gameId, version};
  @override
  FrameRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return FrameRow(
      accountId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}account_id'],
      )!,
      gameId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}game_id'],
      )!,
      version: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}version'],
      )!,
      data: $FramesTable.$converterdata.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}data'],
        )!,
      ),
      pendingPlayers: $FramesTable.$converterpendingPlayers.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}pending_players'],
        )!,
      ),
      deadline: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}deadline'],
      ),
      playerTimes: $FramesTable.$converterplayerTimesn.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}player_times'],
        ),
      ),
      outcomes: $FramesTable.$converteroutcomesn.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}outcomes'],
        ),
      ),
      ratings: $FramesTable.$converterratingsn.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}ratings'],
        ),
      ),
    );
  }

  @override
  $FramesTable createAlias(String alias) {
    return $FramesTable(attachedDatabase, alias);
  }

  static TypeConverter<Map<String, dynamic>, String> $converterdata =
      const JsonObjectConverter();
  static TypeConverter<List<int>, String> $converterpendingPlayers =
      const IntListConverter();
  static TypeConverter<List<int>, String> $converterplayerTimes =
      const IntListConverter();
  static TypeConverter<List<int>?, String?> $converterplayerTimesn =
      NullAwareTypeConverter.wrap($converterplayerTimes);
  static TypeConverter<List<Outcome>, String> $converteroutcomes =
      outcomesConverter;
  static TypeConverter<List<Outcome>?, String?> $converteroutcomesn =
      NullAwareTypeConverter.wrap($converteroutcomes);
  static TypeConverter<List<RatingDelta>, String> $converterratings =
      ratingDeltasConverter;
  static TypeConverter<List<RatingDelta>?, String?> $converterratingsn =
      NullAwareTypeConverter.wrap($converterratings);
}

class FrameRow extends DataClass implements Insertable<FrameRow> {
  final String accountId;
  final String gameId;
  final int version;
  final Map<String, dynamic> data;
  final List<int> pendingPlayers;
  final int? deadline;
  final List<int>? playerTimes;
  final List<Outcome>? outcomes;
  final List<RatingDelta>? ratings;
  const FrameRow({
    required this.accountId,
    required this.gameId,
    required this.version,
    required this.data,
    required this.pendingPlayers,
    this.deadline,
    this.playerTimes,
    this.outcomes,
    this.ratings,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['account_id'] = Variable<String>(accountId);
    map['game_id'] = Variable<String>(gameId);
    map['version'] = Variable<int>(version);
    {
      map['data'] = Variable<String>($FramesTable.$converterdata.toSql(data));
    }
    {
      map['pending_players'] = Variable<String>(
        $FramesTable.$converterpendingPlayers.toSql(pendingPlayers),
      );
    }
    if (!nullToAbsent || deadline != null) {
      map['deadline'] = Variable<int>(deadline);
    }
    if (!nullToAbsent || playerTimes != null) {
      map['player_times'] = Variable<String>(
        $FramesTable.$converterplayerTimesn.toSql(playerTimes),
      );
    }
    if (!nullToAbsent || outcomes != null) {
      map['outcomes'] = Variable<String>(
        $FramesTable.$converteroutcomesn.toSql(outcomes),
      );
    }
    if (!nullToAbsent || ratings != null) {
      map['ratings'] = Variable<String>(
        $FramesTable.$converterratingsn.toSql(ratings),
      );
    }
    return map;
  }

  FramesCompanion toCompanion(bool nullToAbsent) {
    return FramesCompanion(
      accountId: Value(accountId),
      gameId: Value(gameId),
      version: Value(version),
      data: Value(data),
      pendingPlayers: Value(pendingPlayers),
      deadline: deadline == null && nullToAbsent
          ? const Value.absent()
          : Value(deadline),
      playerTimes: playerTimes == null && nullToAbsent
          ? const Value.absent()
          : Value(playerTimes),
      outcomes: outcomes == null && nullToAbsent
          ? const Value.absent()
          : Value(outcomes),
      ratings: ratings == null && nullToAbsent
          ? const Value.absent()
          : Value(ratings),
    );
  }

  factory FrameRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return FrameRow(
      accountId: serializer.fromJson<String>(json['accountId']),
      gameId: serializer.fromJson<String>(json['gameId']),
      version: serializer.fromJson<int>(json['version']),
      data: serializer.fromJson<Map<String, dynamic>>(json['data']),
      pendingPlayers: serializer.fromJson<List<int>>(json['pendingPlayers']),
      deadline: serializer.fromJson<int?>(json['deadline']),
      playerTimes: serializer.fromJson<List<int>?>(json['playerTimes']),
      outcomes: serializer.fromJson<List<Outcome>?>(json['outcomes']),
      ratings: serializer.fromJson<List<RatingDelta>?>(json['ratings']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'accountId': serializer.toJson<String>(accountId),
      'gameId': serializer.toJson<String>(gameId),
      'version': serializer.toJson<int>(version),
      'data': serializer.toJson<Map<String, dynamic>>(data),
      'pendingPlayers': serializer.toJson<List<int>>(pendingPlayers),
      'deadline': serializer.toJson<int?>(deadline),
      'playerTimes': serializer.toJson<List<int>?>(playerTimes),
      'outcomes': serializer.toJson<List<Outcome>?>(outcomes),
      'ratings': serializer.toJson<List<RatingDelta>?>(ratings),
    };
  }

  FrameRow copyWith({
    String? accountId,
    String? gameId,
    int? version,
    Map<String, dynamic>? data,
    List<int>? pendingPlayers,
    Value<int?> deadline = const Value.absent(),
    Value<List<int>?> playerTimes = const Value.absent(),
    Value<List<Outcome>?> outcomes = const Value.absent(),
    Value<List<RatingDelta>?> ratings = const Value.absent(),
  }) => FrameRow(
    accountId: accountId ?? this.accountId,
    gameId: gameId ?? this.gameId,
    version: version ?? this.version,
    data: data ?? this.data,
    pendingPlayers: pendingPlayers ?? this.pendingPlayers,
    deadline: deadline.present ? deadline.value : this.deadline,
    playerTimes: playerTimes.present ? playerTimes.value : this.playerTimes,
    outcomes: outcomes.present ? outcomes.value : this.outcomes,
    ratings: ratings.present ? ratings.value : this.ratings,
  );
  FrameRow copyWithCompanion(FramesCompanion data) {
    return FrameRow(
      accountId: data.accountId.present ? data.accountId.value : this.accountId,
      gameId: data.gameId.present ? data.gameId.value : this.gameId,
      version: data.version.present ? data.version.value : this.version,
      data: data.data.present ? data.data.value : this.data,
      pendingPlayers: data.pendingPlayers.present
          ? data.pendingPlayers.value
          : this.pendingPlayers,
      deadline: data.deadline.present ? data.deadline.value : this.deadline,
      playerTimes: data.playerTimes.present
          ? data.playerTimes.value
          : this.playerTimes,
      outcomes: data.outcomes.present ? data.outcomes.value : this.outcomes,
      ratings: data.ratings.present ? data.ratings.value : this.ratings,
    );
  }

  @override
  String toString() {
    return (StringBuffer('FrameRow(')
          ..write('accountId: $accountId, ')
          ..write('gameId: $gameId, ')
          ..write('version: $version, ')
          ..write('data: $data, ')
          ..write('pendingPlayers: $pendingPlayers, ')
          ..write('deadline: $deadline, ')
          ..write('playerTimes: $playerTimes, ')
          ..write('outcomes: $outcomes, ')
          ..write('ratings: $ratings')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    accountId,
    gameId,
    version,
    data,
    pendingPlayers,
    deadline,
    playerTimes,
    outcomes,
    ratings,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is FrameRow &&
          other.accountId == this.accountId &&
          other.gameId == this.gameId &&
          other.version == this.version &&
          other.data == this.data &&
          other.pendingPlayers == this.pendingPlayers &&
          other.deadline == this.deadline &&
          other.playerTimes == this.playerTimes &&
          other.outcomes == this.outcomes &&
          other.ratings == this.ratings);
}

class FramesCompanion extends UpdateCompanion<FrameRow> {
  final Value<String> accountId;
  final Value<String> gameId;
  final Value<int> version;
  final Value<Map<String, dynamic>> data;
  final Value<List<int>> pendingPlayers;
  final Value<int?> deadline;
  final Value<List<int>?> playerTimes;
  final Value<List<Outcome>?> outcomes;
  final Value<List<RatingDelta>?> ratings;
  final Value<int> rowid;
  const FramesCompanion({
    this.accountId = const Value.absent(),
    this.gameId = const Value.absent(),
    this.version = const Value.absent(),
    this.data = const Value.absent(),
    this.pendingPlayers = const Value.absent(),
    this.deadline = const Value.absent(),
    this.playerTimes = const Value.absent(),
    this.outcomes = const Value.absent(),
    this.ratings = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  FramesCompanion.insert({
    required String accountId,
    required String gameId,
    required int version,
    required Map<String, dynamic> data,
    required List<int> pendingPlayers,
    this.deadline = const Value.absent(),
    this.playerTimes = const Value.absent(),
    this.outcomes = const Value.absent(),
    this.ratings = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : accountId = Value(accountId),
       gameId = Value(gameId),
       version = Value(version),
       data = Value(data),
       pendingPlayers = Value(pendingPlayers);
  static Insertable<FrameRow> custom({
    Expression<String>? accountId,
    Expression<String>? gameId,
    Expression<int>? version,
    Expression<String>? data,
    Expression<String>? pendingPlayers,
    Expression<int>? deadline,
    Expression<String>? playerTimes,
    Expression<String>? outcomes,
    Expression<String>? ratings,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (accountId != null) 'account_id': accountId,
      if (gameId != null) 'game_id': gameId,
      if (version != null) 'version': version,
      if (data != null) 'data': data,
      if (pendingPlayers != null) 'pending_players': pendingPlayers,
      if (deadline != null) 'deadline': deadline,
      if (playerTimes != null) 'player_times': playerTimes,
      if (outcomes != null) 'outcomes': outcomes,
      if (ratings != null) 'ratings': ratings,
      if (rowid != null) 'rowid': rowid,
    });
  }

  FramesCompanion copyWith({
    Value<String>? accountId,
    Value<String>? gameId,
    Value<int>? version,
    Value<Map<String, dynamic>>? data,
    Value<List<int>>? pendingPlayers,
    Value<int?>? deadline,
    Value<List<int>?>? playerTimes,
    Value<List<Outcome>?>? outcomes,
    Value<List<RatingDelta>?>? ratings,
    Value<int>? rowid,
  }) {
    return FramesCompanion(
      accountId: accountId ?? this.accountId,
      gameId: gameId ?? this.gameId,
      version: version ?? this.version,
      data: data ?? this.data,
      pendingPlayers: pendingPlayers ?? this.pendingPlayers,
      deadline: deadline ?? this.deadline,
      playerTimes: playerTimes ?? this.playerTimes,
      outcomes: outcomes ?? this.outcomes,
      ratings: ratings ?? this.ratings,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (accountId.present) {
      map['account_id'] = Variable<String>(accountId.value);
    }
    if (gameId.present) {
      map['game_id'] = Variable<String>(gameId.value);
    }
    if (version.present) {
      map['version'] = Variable<int>(version.value);
    }
    if (data.present) {
      map['data'] = Variable<String>(
        $FramesTable.$converterdata.toSql(data.value),
      );
    }
    if (pendingPlayers.present) {
      map['pending_players'] = Variable<String>(
        $FramesTable.$converterpendingPlayers.toSql(pendingPlayers.value),
      );
    }
    if (deadline.present) {
      map['deadline'] = Variable<int>(deadline.value);
    }
    if (playerTimes.present) {
      map['player_times'] = Variable<String>(
        $FramesTable.$converterplayerTimesn.toSql(playerTimes.value),
      );
    }
    if (outcomes.present) {
      map['outcomes'] = Variable<String>(
        $FramesTable.$converteroutcomesn.toSql(outcomes.value),
      );
    }
    if (ratings.present) {
      map['ratings'] = Variable<String>(
        $FramesTable.$converterratingsn.toSql(ratings.value),
      );
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('FramesCompanion(')
          ..write('accountId: $accountId, ')
          ..write('gameId: $gameId, ')
          ..write('version: $version, ')
          ..write('data: $data, ')
          ..write('pendingPlayers: $pendingPlayers, ')
          ..write('deadline: $deadline, ')
          ..write('playerTimes: $playerTimes, ')
          ..write('outcomes: $outcomes, ')
          ..write('ratings: $ratings, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $LocalGamesTable extends LocalGames
    with TableInfo<$LocalGamesTable, LocalGameRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalGamesTable(this.attachedDatabase, [this._alias]);
  @override
  late final GeneratedColumn<String> accountId = GeneratedColumn<String>(
    'account_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> gameId = GeneratedColumn<String>(
    'game_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> seed = GeneratedColumn<String>(
    'seed',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<bool> remoteCreated = GeneratedColumn<bool>(
    'remote_created',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("remote_created" IN (0, 1))',
    ),
  );
  @override
  late final GeneratedColumn<int> syncedVersion = GeneratedColumn<int>(
    'synced_version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<bool> diverged = GeneratedColumn<bool>(
    'diverged',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("diverged" IN (0, 1))',
    ),
  );
  @override
  List<GeneratedColumn> get $columns => [
    accountId,
    gameId,
    seed,
    remoteCreated,
    syncedVersion,
    diverged,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_games';
  @override
  Set<GeneratedColumn> get $primaryKey => {accountId, gameId};
  @override
  LocalGameRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalGameRow(
      accountId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}account_id'],
      )!,
      gameId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}game_id'],
      )!,
      seed: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}seed'],
      )!,
      remoteCreated: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}remote_created'],
      )!,
      syncedVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}synced_version'],
      )!,
      diverged: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}diverged'],
      )!,
    );
  }

  @override
  $LocalGamesTable createAlias(String alias) {
    return $LocalGamesTable(attachedDatabase, alias);
  }
}

class LocalGameRow extends DataClass implements Insertable<LocalGameRow> {
  final String accountId;
  final String gameId;
  final String seed;
  final bool remoteCreated;

  /// The highest version the server has accepted, or -1 before the game exists
  /// there.
  final int syncedVersion;
  final bool diverged;
  const LocalGameRow({
    required this.accountId,
    required this.gameId,
    required this.seed,
    required this.remoteCreated,
    required this.syncedVersion,
    required this.diverged,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['account_id'] = Variable<String>(accountId);
    map['game_id'] = Variable<String>(gameId);
    map['seed'] = Variable<String>(seed);
    map['remote_created'] = Variable<bool>(remoteCreated);
    map['synced_version'] = Variable<int>(syncedVersion);
    map['diverged'] = Variable<bool>(diverged);
    return map;
  }

  LocalGamesCompanion toCompanion(bool nullToAbsent) {
    return LocalGamesCompanion(
      accountId: Value(accountId),
      gameId: Value(gameId),
      seed: Value(seed),
      remoteCreated: Value(remoteCreated),
      syncedVersion: Value(syncedVersion),
      diverged: Value(diverged),
    );
  }

  factory LocalGameRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalGameRow(
      accountId: serializer.fromJson<String>(json['accountId']),
      gameId: serializer.fromJson<String>(json['gameId']),
      seed: serializer.fromJson<String>(json['seed']),
      remoteCreated: serializer.fromJson<bool>(json['remoteCreated']),
      syncedVersion: serializer.fromJson<int>(json['syncedVersion']),
      diverged: serializer.fromJson<bool>(json['diverged']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'accountId': serializer.toJson<String>(accountId),
      'gameId': serializer.toJson<String>(gameId),
      'seed': serializer.toJson<String>(seed),
      'remoteCreated': serializer.toJson<bool>(remoteCreated),
      'syncedVersion': serializer.toJson<int>(syncedVersion),
      'diverged': serializer.toJson<bool>(diverged),
    };
  }

  LocalGameRow copyWith({
    String? accountId,
    String? gameId,
    String? seed,
    bool? remoteCreated,
    int? syncedVersion,
    bool? diverged,
  }) => LocalGameRow(
    accountId: accountId ?? this.accountId,
    gameId: gameId ?? this.gameId,
    seed: seed ?? this.seed,
    remoteCreated: remoteCreated ?? this.remoteCreated,
    syncedVersion: syncedVersion ?? this.syncedVersion,
    diverged: diverged ?? this.diverged,
  );
  LocalGameRow copyWithCompanion(LocalGamesCompanion data) {
    return LocalGameRow(
      accountId: data.accountId.present ? data.accountId.value : this.accountId,
      gameId: data.gameId.present ? data.gameId.value : this.gameId,
      seed: data.seed.present ? data.seed.value : this.seed,
      remoteCreated: data.remoteCreated.present
          ? data.remoteCreated.value
          : this.remoteCreated,
      syncedVersion: data.syncedVersion.present
          ? data.syncedVersion.value
          : this.syncedVersion,
      diverged: data.diverged.present ? data.diverged.value : this.diverged,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalGameRow(')
          ..write('accountId: $accountId, ')
          ..write('gameId: $gameId, ')
          ..write('seed: $seed, ')
          ..write('remoteCreated: $remoteCreated, ')
          ..write('syncedVersion: $syncedVersion, ')
          ..write('diverged: $diverged')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    accountId,
    gameId,
    seed,
    remoteCreated,
    syncedVersion,
    diverged,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalGameRow &&
          other.accountId == this.accountId &&
          other.gameId == this.gameId &&
          other.seed == this.seed &&
          other.remoteCreated == this.remoteCreated &&
          other.syncedVersion == this.syncedVersion &&
          other.diverged == this.diverged);
}

class LocalGamesCompanion extends UpdateCompanion<LocalGameRow> {
  final Value<String> accountId;
  final Value<String> gameId;
  final Value<String> seed;
  final Value<bool> remoteCreated;
  final Value<int> syncedVersion;
  final Value<bool> diverged;
  final Value<int> rowid;
  const LocalGamesCompanion({
    this.accountId = const Value.absent(),
    this.gameId = const Value.absent(),
    this.seed = const Value.absent(),
    this.remoteCreated = const Value.absent(),
    this.syncedVersion = const Value.absent(),
    this.diverged = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalGamesCompanion.insert({
    required String accountId,
    required String gameId,
    required String seed,
    required bool remoteCreated,
    required int syncedVersion,
    required bool diverged,
    this.rowid = const Value.absent(),
  }) : accountId = Value(accountId),
       gameId = Value(gameId),
       seed = Value(seed),
       remoteCreated = Value(remoteCreated),
       syncedVersion = Value(syncedVersion),
       diverged = Value(diverged);
  static Insertable<LocalGameRow> custom({
    Expression<String>? accountId,
    Expression<String>? gameId,
    Expression<String>? seed,
    Expression<bool>? remoteCreated,
    Expression<int>? syncedVersion,
    Expression<bool>? diverged,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (accountId != null) 'account_id': accountId,
      if (gameId != null) 'game_id': gameId,
      if (seed != null) 'seed': seed,
      if (remoteCreated != null) 'remote_created': remoteCreated,
      if (syncedVersion != null) 'synced_version': syncedVersion,
      if (diverged != null) 'diverged': diverged,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalGamesCompanion copyWith({
    Value<String>? accountId,
    Value<String>? gameId,
    Value<String>? seed,
    Value<bool>? remoteCreated,
    Value<int>? syncedVersion,
    Value<bool>? diverged,
    Value<int>? rowid,
  }) {
    return LocalGamesCompanion(
      accountId: accountId ?? this.accountId,
      gameId: gameId ?? this.gameId,
      seed: seed ?? this.seed,
      remoteCreated: remoteCreated ?? this.remoteCreated,
      syncedVersion: syncedVersion ?? this.syncedVersion,
      diverged: diverged ?? this.diverged,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (accountId.present) {
      map['account_id'] = Variable<String>(accountId.value);
    }
    if (gameId.present) {
      map['game_id'] = Variable<String>(gameId.value);
    }
    if (seed.present) {
      map['seed'] = Variable<String>(seed.value);
    }
    if (remoteCreated.present) {
      map['remote_created'] = Variable<bool>(remoteCreated.value);
    }
    if (syncedVersion.present) {
      map['synced_version'] = Variable<int>(syncedVersion.value);
    }
    if (diverged.present) {
      map['diverged'] = Variable<bool>(diverged.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalGamesCompanion(')
          ..write('accountId: $accountId, ')
          ..write('gameId: $gameId, ')
          ..write('seed: $seed, ')
          ..write('remoteCreated: $remoteCreated, ')
          ..write('syncedVersion: $syncedVersion, ')
          ..write('diverged: $diverged, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $TransitionsTable extends Transitions
    with TableInfo<$TransitionsTable, TransitionRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TransitionsTable(this.attachedDatabase, [this._alias]);
  @override
  late final GeneratedColumn<String> accountId = GeneratedColumn<String>(
    'account_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> gameId = GeneratedColumn<String>(
    'game_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> version = GeneratedColumn<int>(
    'version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumnWithTypeConverter<Map<String, dynamic>, String>
  state = GeneratedColumn<String>(
    'state',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  ).withConverter<Map<String, dynamic>>($TransitionsTable.$converterstate);
  @override
  late final GeneratedColumnWithTypeConverter<Map<String, dynamic>?, String>
  action = GeneratedColumn<String>(
    'action',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  ).withConverter<Map<String, dynamic>?>($TransitionsTable.$converteractionn);
  @override
  late final GeneratedColumnWithTypeConverter<List<int>, String> pending =
      GeneratedColumn<String>(
        'pending',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      ).withConverter<List<int>>($TransitionsTable.$converterpending);
  @override
  List<GeneratedColumn> get $columns => [
    accountId,
    gameId,
    version,
    state,
    action,
    pending,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'transitions';
  @override
  Set<GeneratedColumn> get $primaryKey => {accountId, gameId, version};
  @override
  TransitionRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return TransitionRow(
      accountId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}account_id'],
      )!,
      gameId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}game_id'],
      )!,
      version: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}version'],
      )!,
      state: $TransitionsTable.$converterstate.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}state'],
        )!,
      ),
      action: $TransitionsTable.$converteractionn.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}action'],
        ),
      ),
      pending: $TransitionsTable.$converterpending.fromSql(
        attachedDatabase.typeMapping.read(
          DriftSqlType.string,
          data['${effectivePrefix}pending'],
        )!,
      ),
    );
  }

  @override
  $TransitionsTable createAlias(String alias) {
    return $TransitionsTable(attachedDatabase, alias);
  }

  static TypeConverter<Map<String, dynamic>, String> $converterstate =
      const JsonObjectConverter();
  static TypeConverter<Map<String, dynamic>, String> $converteraction =
      const JsonObjectConverter();
  static TypeConverter<Map<String, dynamic>?, String?> $converteractionn =
      NullAwareTypeConverter.wrap($converteraction);
  static TypeConverter<List<int>, String> $converterpending =
      const IntListConverter();
}

class TransitionRow extends DataClass implements Insertable<TransitionRow> {
  final String accountId;
  final String gameId;
  final int version;
  final Map<String, dynamic> state;
  final Map<String, dynamic>? action;
  final List<int> pending;
  const TransitionRow({
    required this.accountId,
    required this.gameId,
    required this.version,
    required this.state,
    this.action,
    required this.pending,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['account_id'] = Variable<String>(accountId);
    map['game_id'] = Variable<String>(gameId);
    map['version'] = Variable<int>(version);
    {
      map['state'] = Variable<String>(
        $TransitionsTable.$converterstate.toSql(state),
      );
    }
    if (!nullToAbsent || action != null) {
      map['action'] = Variable<String>(
        $TransitionsTable.$converteractionn.toSql(action),
      );
    }
    {
      map['pending'] = Variable<String>(
        $TransitionsTable.$converterpending.toSql(pending),
      );
    }
    return map;
  }

  TransitionsCompanion toCompanion(bool nullToAbsent) {
    return TransitionsCompanion(
      accountId: Value(accountId),
      gameId: Value(gameId),
      version: Value(version),
      state: Value(state),
      action: action == null && nullToAbsent
          ? const Value.absent()
          : Value(action),
      pending: Value(pending),
    );
  }

  factory TransitionRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return TransitionRow(
      accountId: serializer.fromJson<String>(json['accountId']),
      gameId: serializer.fromJson<String>(json['gameId']),
      version: serializer.fromJson<int>(json['version']),
      state: serializer.fromJson<Map<String, dynamic>>(json['state']),
      action: serializer.fromJson<Map<String, dynamic>?>(json['action']),
      pending: serializer.fromJson<List<int>>(json['pending']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'accountId': serializer.toJson<String>(accountId),
      'gameId': serializer.toJson<String>(gameId),
      'version': serializer.toJson<int>(version),
      'state': serializer.toJson<Map<String, dynamic>>(state),
      'action': serializer.toJson<Map<String, dynamic>?>(action),
      'pending': serializer.toJson<List<int>>(pending),
    };
  }

  TransitionRow copyWith({
    String? accountId,
    String? gameId,
    int? version,
    Map<String, dynamic>? state,
    Value<Map<String, dynamic>?> action = const Value.absent(),
    List<int>? pending,
  }) => TransitionRow(
    accountId: accountId ?? this.accountId,
    gameId: gameId ?? this.gameId,
    version: version ?? this.version,
    state: state ?? this.state,
    action: action.present ? action.value : this.action,
    pending: pending ?? this.pending,
  );
  TransitionRow copyWithCompanion(TransitionsCompanion data) {
    return TransitionRow(
      accountId: data.accountId.present ? data.accountId.value : this.accountId,
      gameId: data.gameId.present ? data.gameId.value : this.gameId,
      version: data.version.present ? data.version.value : this.version,
      state: data.state.present ? data.state.value : this.state,
      action: data.action.present ? data.action.value : this.action,
      pending: data.pending.present ? data.pending.value : this.pending,
    );
  }

  @override
  String toString() {
    return (StringBuffer('TransitionRow(')
          ..write('accountId: $accountId, ')
          ..write('gameId: $gameId, ')
          ..write('version: $version, ')
          ..write('state: $state, ')
          ..write('action: $action, ')
          ..write('pending: $pending')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(accountId, gameId, version, state, action, pending);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is TransitionRow &&
          other.accountId == this.accountId &&
          other.gameId == this.gameId &&
          other.version == this.version &&
          other.state == this.state &&
          other.action == this.action &&
          other.pending == this.pending);
}

class TransitionsCompanion extends UpdateCompanion<TransitionRow> {
  final Value<String> accountId;
  final Value<String> gameId;
  final Value<int> version;
  final Value<Map<String, dynamic>> state;
  final Value<Map<String, dynamic>?> action;
  final Value<List<int>> pending;
  final Value<int> rowid;
  const TransitionsCompanion({
    this.accountId = const Value.absent(),
    this.gameId = const Value.absent(),
    this.version = const Value.absent(),
    this.state = const Value.absent(),
    this.action = const Value.absent(),
    this.pending = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TransitionsCompanion.insert({
    required String accountId,
    required String gameId,
    required int version,
    required Map<String, dynamic> state,
    this.action = const Value.absent(),
    required List<int> pending,
    this.rowid = const Value.absent(),
  }) : accountId = Value(accountId),
       gameId = Value(gameId),
       version = Value(version),
       state = Value(state),
       pending = Value(pending);
  static Insertable<TransitionRow> custom({
    Expression<String>? accountId,
    Expression<String>? gameId,
    Expression<int>? version,
    Expression<String>? state,
    Expression<String>? action,
    Expression<String>? pending,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (accountId != null) 'account_id': accountId,
      if (gameId != null) 'game_id': gameId,
      if (version != null) 'version': version,
      if (state != null) 'state': state,
      if (action != null) 'action': action,
      if (pending != null) 'pending': pending,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TransitionsCompanion copyWith({
    Value<String>? accountId,
    Value<String>? gameId,
    Value<int>? version,
    Value<Map<String, dynamic>>? state,
    Value<Map<String, dynamic>?>? action,
    Value<List<int>>? pending,
    Value<int>? rowid,
  }) {
    return TransitionsCompanion(
      accountId: accountId ?? this.accountId,
      gameId: gameId ?? this.gameId,
      version: version ?? this.version,
      state: state ?? this.state,
      action: action ?? this.action,
      pending: pending ?? this.pending,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (accountId.present) {
      map['account_id'] = Variable<String>(accountId.value);
    }
    if (gameId.present) {
      map['game_id'] = Variable<String>(gameId.value);
    }
    if (version.present) {
      map['version'] = Variable<int>(version.value);
    }
    if (state.present) {
      map['state'] = Variable<String>(
        $TransitionsTable.$converterstate.toSql(state.value),
      );
    }
    if (action.present) {
      map['action'] = Variable<String>(
        $TransitionsTable.$converteractionn.toSql(action.value),
      );
    }
    if (pending.present) {
      map['pending'] = Variable<String>(
        $TransitionsTable.$converterpending.toSql(pending.value),
      );
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TransitionsCompanion(')
          ..write('accountId: $accountId, ')
          ..write('gameId: $gameId, ')
          ..write('version: $version, ')
          ..write('state: $state, ')
          ..write('action: $action, ')
          ..write('pending: $pending, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CommerceDeliveriesTable extends CommerceDeliveries
    with TableInfo<$CommerceDeliveriesTable, CommerceDeliveryRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CommerceDeliveriesTable(this.attachedDatabase, [this._alias]);
  @override
  late final GeneratedColumn<String> provider = GeneratedColumn<String>(
    'provider',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> deliveryId = GeneratedColumn<String>(
    'delivery_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> offerKey = GeneratedColumn<String>(
    'offer_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<String> providerReference =
      GeneratedColumn<String>(
        'provider_reference',
        aliasedName,
        false,
        type: DriftSqlType.string,
        requiredDuringInsert: true,
      );
  @override
  late final GeneratedColumn<String> evidence = GeneratedColumn<String>(
    'evidence',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  late final GeneratedColumn<int> createdAt = GeneratedColumn<int>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    provider,
    deliveryId,
    offerKey,
    providerReference,
    evidence,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'commerce_deliveries';
  @override
  Set<GeneratedColumn> get $primaryKey => {provider, deliveryId};
  @override
  CommerceDeliveryRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CommerceDeliveryRow(
      provider: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}provider'],
      )!,
      deliveryId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}delivery_id'],
      )!,
      offerKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}offer_key'],
      )!,
      providerReference: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}provider_reference'],
      )!,
      evidence: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}evidence'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $CommerceDeliveriesTable createAlias(String alias) {
    return $CommerceDeliveriesTable(attachedDatabase, alias);
  }
}

class CommerceDeliveryRow extends DataClass
    implements Insertable<CommerceDeliveryRow> {
  final String provider;
  final String deliveryId;
  final String offerKey;
  final String providerReference;
  final String evidence;
  final int createdAt;
  const CommerceDeliveryRow({
    required this.provider,
    required this.deliveryId,
    required this.offerKey,
    required this.providerReference,
    required this.evidence,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['provider'] = Variable<String>(provider);
    map['delivery_id'] = Variable<String>(deliveryId);
    map['offer_key'] = Variable<String>(offerKey);
    map['provider_reference'] = Variable<String>(providerReference);
    map['evidence'] = Variable<String>(evidence);
    map['created_at'] = Variable<int>(createdAt);
    return map;
  }

  CommerceDeliveriesCompanion toCompanion(bool nullToAbsent) {
    return CommerceDeliveriesCompanion(
      provider: Value(provider),
      deliveryId: Value(deliveryId),
      offerKey: Value(offerKey),
      providerReference: Value(providerReference),
      evidence: Value(evidence),
      createdAt: Value(createdAt),
    );
  }

  factory CommerceDeliveryRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CommerceDeliveryRow(
      provider: serializer.fromJson<String>(json['provider']),
      deliveryId: serializer.fromJson<String>(json['deliveryId']),
      offerKey: serializer.fromJson<String>(json['offerKey']),
      providerReference: serializer.fromJson<String>(json['providerReference']),
      evidence: serializer.fromJson<String>(json['evidence']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'provider': serializer.toJson<String>(provider),
      'deliveryId': serializer.toJson<String>(deliveryId),
      'offerKey': serializer.toJson<String>(offerKey),
      'providerReference': serializer.toJson<String>(providerReference),
      'evidence': serializer.toJson<String>(evidence),
      'createdAt': serializer.toJson<int>(createdAt),
    };
  }

  CommerceDeliveryRow copyWith({
    String? provider,
    String? deliveryId,
    String? offerKey,
    String? providerReference,
    String? evidence,
    int? createdAt,
  }) => CommerceDeliveryRow(
    provider: provider ?? this.provider,
    deliveryId: deliveryId ?? this.deliveryId,
    offerKey: offerKey ?? this.offerKey,
    providerReference: providerReference ?? this.providerReference,
    evidence: evidence ?? this.evidence,
    createdAt: createdAt ?? this.createdAt,
  );
  CommerceDeliveryRow copyWithCompanion(CommerceDeliveriesCompanion data) {
    return CommerceDeliveryRow(
      provider: data.provider.present ? data.provider.value : this.provider,
      deliveryId: data.deliveryId.present
          ? data.deliveryId.value
          : this.deliveryId,
      offerKey: data.offerKey.present ? data.offerKey.value : this.offerKey,
      providerReference: data.providerReference.present
          ? data.providerReference.value
          : this.providerReference,
      evidence: data.evidence.present ? data.evidence.value : this.evidence,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CommerceDeliveryRow(')
          ..write('provider: $provider, ')
          ..write('deliveryId: $deliveryId, ')
          ..write('offerKey: $offerKey, ')
          ..write('providerReference: $providerReference, ')
          ..write('evidence: $evidence, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    provider,
    deliveryId,
    offerKey,
    providerReference,
    evidence,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CommerceDeliveryRow &&
          other.provider == this.provider &&
          other.deliveryId == this.deliveryId &&
          other.offerKey == this.offerKey &&
          other.providerReference == this.providerReference &&
          other.evidence == this.evidence &&
          other.createdAt == this.createdAt);
}

class CommerceDeliveriesCompanion extends UpdateCompanion<CommerceDeliveryRow> {
  final Value<String> provider;
  final Value<String> deliveryId;
  final Value<String> offerKey;
  final Value<String> providerReference;
  final Value<String> evidence;
  final Value<int> createdAt;
  final Value<int> rowid;
  const CommerceDeliveriesCompanion({
    this.provider = const Value.absent(),
    this.deliveryId = const Value.absent(),
    this.offerKey = const Value.absent(),
    this.providerReference = const Value.absent(),
    this.evidence = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CommerceDeliveriesCompanion.insert({
    required String provider,
    required String deliveryId,
    required String offerKey,
    required String providerReference,
    required String evidence,
    required int createdAt,
    this.rowid = const Value.absent(),
  }) : provider = Value(provider),
       deliveryId = Value(deliveryId),
       offerKey = Value(offerKey),
       providerReference = Value(providerReference),
       evidence = Value(evidence),
       createdAt = Value(createdAt);
  static Insertable<CommerceDeliveryRow> custom({
    Expression<String>? provider,
    Expression<String>? deliveryId,
    Expression<String>? offerKey,
    Expression<String>? providerReference,
    Expression<String>? evidence,
    Expression<int>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (provider != null) 'provider': provider,
      if (deliveryId != null) 'delivery_id': deliveryId,
      if (offerKey != null) 'offer_key': offerKey,
      if (providerReference != null) 'provider_reference': providerReference,
      if (evidence != null) 'evidence': evidence,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CommerceDeliveriesCompanion copyWith({
    Value<String>? provider,
    Value<String>? deliveryId,
    Value<String>? offerKey,
    Value<String>? providerReference,
    Value<String>? evidence,
    Value<int>? createdAt,
    Value<int>? rowid,
  }) {
    return CommerceDeliveriesCompanion(
      provider: provider ?? this.provider,
      deliveryId: deliveryId ?? this.deliveryId,
      offerKey: offerKey ?? this.offerKey,
      providerReference: providerReference ?? this.providerReference,
      evidence: evidence ?? this.evidence,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (provider.present) {
      map['provider'] = Variable<String>(provider.value);
    }
    if (deliveryId.present) {
      map['delivery_id'] = Variable<String>(deliveryId.value);
    }
    if (offerKey.present) {
      map['offer_key'] = Variable<String>(offerKey.value);
    }
    if (providerReference.present) {
      map['provider_reference'] = Variable<String>(providerReference.value);
    }
    if (evidence.present) {
      map['evidence'] = Variable<String>(evidence.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CommerceDeliveriesCompanion(')
          ..write('provider: $provider, ')
          ..write('deliveryId: $deliveryId, ')
          ..write('offerKey: $offerKey, ')
          ..write('providerReference: $providerReference, ')
          ..write('evidence: $evidence, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$ReplicaDatabase extends GeneratedDatabase {
  _$ReplicaDatabase(QueryExecutor e) : super(e);
  late final $AccountsTable accounts = $AccountsTable(this);
  late final $PlayersTable players = $PlayersTable(this);
  late final $BotsTable bots = $BotsTable(this);
  late final $GamesTable games = $GamesTable(this);
  late final $ParticipantsTable participants = $ParticipantsTable(this);
  late final $PlayerRatingsTable playerRatings = $PlayerRatingsTable(this);
  late final $RatingHistoryTable ratingHistory = $RatingHistoryTable(this);
  late final $RelationshipsTable relationships = $RelationshipsTable(this);
  late final $FramesTable frames = $FramesTable(this);
  late final $LocalGamesTable localGames = $LocalGamesTable(this);
  late final $TransitionsTable transitions = $TransitionsTable(this);
  late final $CommerceDeliveriesTable commerceDeliveries =
      $CommerceDeliveriesTable(this);
  late final Index idxGamesAccountStatus = Index(
    'idx_games_account_status',
    'CREATE INDEX idx_games_account_status ON games (account_id, status)',
  );
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    accounts,
    players,
    bots,
    games,
    participants,
    playerRatings,
    ratingHistory,
    relationships,
    frames,
    localGames,
    transitions,
    commerceDeliveries,
    idxGamesAccountStatus,
  ];
}
