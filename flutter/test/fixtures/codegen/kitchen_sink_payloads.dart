// GENERATED CODE - DO NOT MODIFY BY HAND.
// Generated from the game-owned EigenInteractive contract.

// ignore_for_file: prefer_adjacent_string_concatenation
// ignore_for_file: prefer_null_aware_operators, unnecessary_non_null_assertion
// ignore_for_file: unused_element

import 'package:eigen_flutter/eigen_flutter.dart';

bool _payloadEquals(Object? left, Object? right) {
  if (identical(left, right)) return true;
  if (left is List && right is List) {
    return left.length == right.length &&
        Iterable<int>.generate(
          left.length,
        ).every((index) => _payloadEquals(left[index], right[index]));
  }
  if (left is Map && right is Map) {
    return left.length == right.length &&
        left.keys.every(
          (key) =>
              right.containsKey(key) && _payloadEquals(left[key], right[key]),
        );
  }
  return left == right;
}

int _payloadHash(Object? value) {
  if (value is List) return Object.hashAll(value.map(_payloadHash));
  if (value is Map) {
    final keys = value.keys.toList()
      ..sort((left, right) => left.toString().compareTo(right.toString()));
    return Object.hashAll(
      keys.map((key) => Object.hash(key, _payloadHash(value[key]))),
    );
  }
  return value.hashCode;
}

Object? _payloadRequired(Map<String, dynamic> json, String key, String path) {
  if (json.containsKey(key)) return json[key];
  throw FormatException('$path: required field is missing');
}

Map<String, dynamic> _payloadMap(Object? value, String path) {
  if (value is Map<String, dynamic>) return value;
  throw FormatException('$path: expected an object');
}

List<dynamic> _payloadList(Object? value, String path) {
  if (value is List<dynamic>) return value;
  throw FormatException('$path: expected an array');
}

String _payloadString(Object? value, String path) {
  if (value is String) return value;
  throw FormatException('$path: expected a string');
}

int _payloadInt(Object? value, String path) {
  if (value is int) return value;
  throw FormatException('$path: expected an integer');
}

num _payloadNum(Object? value, String path) {
  if (value is num) return value;
  throw FormatException('$path: expected a number');
}

bool _payloadBool(Object? value, String path) {
  if (value is bool) return value;
  throw FormatException('$path: expected a boolean');
}

T _payloadNumberBounds<T extends num>(
  T value,
  String path,
  num? minimum,
  num? maximum,
  num? exclusiveMinimum,
  num? exclusiveMaximum,
) {
  if (minimum != null && value < minimum) {
    throw FormatException('$path: must be at least $minimum');
  }
  if (maximum != null && value > maximum) {
    throw FormatException('$path: must be at most $maximum');
  }
  if (exclusiveMinimum != null && value <= exclusiveMinimum) {
    throw FormatException('$path: must be greater than $exclusiveMinimum');
  }
  if (exclusiveMaximum != null && value >= exclusiveMaximum) {
    throw FormatException('$path: must be less than $exclusiveMaximum');
  }
  return value;
}

String _payloadStringBounds(
  String value,
  String path,
  int? minimum,
  int? maximum,
) {
  final length = value.runes.length;
  if (minimum != null && length < minimum) {
    throw FormatException('$path: must contain at least $minimum characters');
  }
  if (maximum != null && length > maximum) {
    throw FormatException('$path: must contain at most $maximum characters');
  }
  return value;
}

List<dynamic> _payloadListBounds(
  List<dynamic> value,
  String path,
  int? minimum,
  int? maximum,
  bool unique,
) {
  if (minimum != null && value.length < minimum) {
    throw FormatException('$path: must contain at least $minimum items');
  }
  if (maximum != null && value.length > maximum) {
    throw FormatException('$path: must contain at most $maximum items');
  }
  if (unique) {
    for (var index = 0; index < value.length; index++) {
      if (value
          .take(index)
          .any((prior) => _payloadEquals(prior, value[index]))) {
        throw FormatException('$path[$index]: duplicate item');
      }
    }
  }
  return value;
}

int _payloadIntChoice(int value, String path, List<int> allowed) {
  if (allowed.contains(value)) return value;
  throw FormatException('$path: expected one of $allowed');
}

void _payloadObjectBounds(
  Map<String, dynamic> value,
  String path,
  Set<String> allowedKeys,
  bool rejectUnknown,
  int? minimum,
  int? maximum,
) {
  if (minimum != null && value.length < minimum) {
    throw FormatException('$path: must contain at least $minimum properties');
  }
  if (maximum != null && value.length > maximum) {
    throw FormatException('$path: must contain at most $maximum properties');
  }
  if (rejectUnknown) {
    for (final key in value.keys) {
      if (!allowedKeys.contains(key)) {
        throw FormatException('$path.$key: unknown field');
      }
    }
  }
}

enum Game2048ArenaV1Move {
  classValue,
  inProgress,
  costMoney;

  static Game2048ArenaV1Move fromJson(
    Object? value, [
    String path = "Game2048ArenaV1Move",
  ]) => switch (value) {
    "class" => Game2048ArenaV1Move.classValue,
    "in-progress" => Game2048ArenaV1Move.inProgress,
    "cost\$money" => Game2048ArenaV1Move.costMoney,
    _ => throw FormatException(
      '$path: unknown Game2048ArenaV1Move value $value',
    ),
  };

  String toJson() => switch (this) {
    Game2048ArenaV1Move.classValue => "class",
    Game2048ArenaV1Move.inProgress => "in-progress",
    Game2048ArenaV1Move.costMoney => "cost\$money",
  };
}

final class Game2048ArenaV1Profile {
  Game2048ArenaV1Profile({required this.displayName, required this.nickname});

  factory Game2048ArenaV1Profile.fromJson(Map<String, dynamic> json) {
    const path = "Game2048ArenaV1Profile";
    _payloadObjectBounds(
      json,
      path,
      const <String>{"display-name", "nickname"},
      false,
      null,
      null,
    );
    return Game2048ArenaV1Profile(
      displayName: _payloadStringBounds(
        _payloadString(
          _payloadRequired(json, "display-name", "$path.display-name"),
          "$path.display-name",
        ),
        "$path.display-name",
        null,
        null,
      ),
      nickname: _payloadRequired(json, "nickname", "$path.nickname") == null
          ? null
          : _payloadStringBounds(
              _payloadString(
                _payloadRequired(json, "nickname", "$path.nickname"),
                "$path.nickname",
              ),
              "$path.nickname",
              null,
              null,
            ),
    );
  }

  final String displayName;

  final String? nickname;

  Map<String, dynamic> toJson() => {
    "display-name": displayName,
    "nickname": nickname == null ? null : nickname!,
  };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Game2048ArenaV1Profile &&
          _payloadEquals(displayName, other.displayName) &&
          _payloadEquals(nickname, other.nickname);

  @override
  int get hashCode =>
      Object.hashAll([_payloadHash(displayName), _payloadHash(nickname)]);
}

final class Game2048ArenaV1Observation {
  Game2048ArenaV1Observation({
    required this.profile,
    Iterable<Game2048ArenaV1Profile>? history,
    required Iterable<int> matrix,
    required Iterable<Game2048ArenaV1Move?> possibleMoves,
    this.note,
    required this.quoteKey,
  }) : history = history == null ? null : List.unmodifiable(history),
       matrix = List.unmodifiable(matrix),
       possibleMoves = List.unmodifiable(possibleMoves);

  factory Game2048ArenaV1Observation.fromJson(Map<String, dynamic> json) {
    const path = "Game2048ArenaV1Observation";
    _payloadObjectBounds(
      json,
      path,
      const <String>{
        "profile",
        "history",
        "matrix",
        "possible-moves",
        "note",
        "quote'\$key",
      },
      false,
      null,
      null,
    );
    return Game2048ArenaV1Observation(
      profile: Game2048ArenaV1Profile.fromJson(
        _payloadMap(
          _payloadRequired(json, "profile", "$path.profile"),
          "$path.profile",
        ),
      ),
      history: json.containsKey("history")
          ? _payloadListBounds(
              _payloadList(json["history"], "$path.history"),
              "$path.history",
              null,
              null,
              false,
            ).indexed.map((entry) {
              final index = entry.$1;
              final item = entry.$2;
              return Game2048ArenaV1Profile.fromJson(
                _payloadMap(item, "$path.history[$index]"),
              );
            }).toList()
          : null,
      matrix:
          _payloadListBounds(
            _payloadList(
              _payloadRequired(json, "matrix", "$path.matrix"),
              "$path.matrix",
            ),
            "$path.matrix",
            null,
            null,
            false,
          ).indexed.map((entry) {
            final index = entry.$1;
            final item = entry.$2;
            return _payloadNumberBounds(
              _payloadInt(item, "$path.matrix[$index]"),
              "$path.matrix[$index]",
              null,
              null,
              null,
              null,
            );
          }).toList(),
      possibleMoves:
          _payloadListBounds(
            _payloadList(
              _payloadRequired(json, "possible-moves", "$path.possible-moves"),
              "$path.possible-moves",
            ),
            "$path.possible-moves",
            null,
            null,
            false,
          ).indexed.map((entry) {
            final index = entry.$1;
            final item = entry.$2;
            return item == null
                ? null
                : Game2048ArenaV1Move.fromJson(
                    item,
                    "$path.possible-moves[$index]",
                  );
          }).toList(),
      note: json.containsKey("note")
          ? _payloadStringBounds(
              _payloadString(json["note"], "$path.note"),
              "$path.note",
              null,
              null,
            )
          : null,
      quoteKey: _payloadStringBounds(
        _payloadString(
          _payloadRequired(json, "quote'\$key", "$path.quote'\$key"),
          "$path.quote'\$key",
        ),
        "$path.quote'\$key",
        null,
        null,
      ),
    );
  }

  final Game2048ArenaV1Profile profile;

  final List<Game2048ArenaV1Profile>? history;

  final List<int> matrix;

  final List<Game2048ArenaV1Move?> possibleMoves;

  final String? note;

  final String quoteKey;

  Map<String, dynamic> toJson() => {
    "profile": profile.toJson(),
    if (history != null)
      "history": history!.map((item) => item.toJson()).toList(),
    "matrix": matrix.map((item) => item).toList(),
    "possible-moves": possibleMoves
        .map((item) => item == null ? null : item!.toJson())
        .toList(),
    "note": ?note,
    "quote'\$key": quoteKey,
  };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Game2048ArenaV1Observation &&
          _payloadEquals(profile, other.profile) &&
          _payloadEquals(history, other.history) &&
          _payloadEquals(matrix, other.matrix) &&
          _payloadEquals(possibleMoves, other.possibleMoves) &&
          _payloadEquals(note, other.note) &&
          _payloadEquals(quoteKey, other.quoteKey);

  @override
  int get hashCode => Object.hashAll([
    _payloadHash(profile),
    _payloadHash(history),
    _payloadHash(matrix),
    _payloadHash(possibleMoves),
    _payloadHash(note),
    _payloadHash(quoteKey),
  ]);
}

final class Game2048ArenaV1ActionMetadata {
  Game2048ArenaV1ActionMetadata({required this.switchValue});

  factory Game2048ArenaV1ActionMetadata.fromJson(Map<String, dynamic> json) {
    const path = "Game2048ArenaV1ActionMetadata";
    _payloadObjectBounds(
      json,
      path,
      const <String>{"switch"},
      false,
      null,
      null,
    );
    return Game2048ArenaV1ActionMetadata(
      switchValue: _payloadBool(
        _payloadRequired(json, "switch", "$path.switch"),
        "$path.switch",
      ),
    );
  }

  final bool switchValue;

  Map<String, dynamic> toJson() => {"switch": switchValue};

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Game2048ArenaV1ActionMetadata &&
          _payloadEquals(switchValue, other.switchValue);

  @override
  int get hashCode => Object.hashAll([_payloadHash(switchValue)]);
}

final class Game2048ArenaV1Action {
  Game2048ArenaV1Action({
    required this.move,
    required Iterable<int> targets,
    this.metadata,
  }) : targets = List.unmodifiable(targets);

  factory Game2048ArenaV1Action.fromJson(Map<String, dynamic> json) {
    const path = "Game2048ArenaV1Action";
    _payloadObjectBounds(
      json,
      path,
      const <String>{"move", "targets", "metadata"},
      true,
      null,
      null,
    );
    return Game2048ArenaV1Action(
      move: Game2048ArenaV1Move.fromJson(
        _payloadRequired(json, "move", "$path.move"),
        "$path.move",
      ),
      targets:
          _payloadListBounds(
            _payloadList(
              _payloadRequired(json, "targets", "$path.targets"),
              "$path.targets",
            ),
            "$path.targets",
            1,
            2,
            true,
          ).indexed.map((entry) {
            final index = entry.$1;
            final item = entry.$2;
            return _payloadNumberBounds(
              _payloadInt(item, "$path.targets[$index]"),
              "$path.targets[$index]",
              null,
              null,
              null,
              null,
            );
          }).toList(),
      metadata: json.containsKey("metadata")
          ? Game2048ArenaV1ActionMetadata.fromJson(
              _payloadMap(json["metadata"], "$path.metadata"),
            )
          : null,
    );
  }

  final Game2048ArenaV1Move move;

  final List<int> targets;

  final Game2048ArenaV1ActionMetadata? metadata;

  Map<String, dynamic> toJson() => {
    "move": move.toJson(),
    "targets": targets.map((item) => item).toList(),
    if (metadata != null) "metadata": metadata!.toJson(),
  };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Game2048ArenaV1Action &&
          _payloadEquals(move, other.move) &&
          _payloadEquals(targets, other.targets) &&
          _payloadEquals(metadata, other.metadata);

  @override
  int get hashCode => Object.hashAll([
    _payloadHash(move),
    _payloadHash(targets),
    _payloadHash(metadata),
  ]);
}

enum Game2048ArenaV1ConfigMode {
  solo,
  teamPlay;

  static Game2048ArenaV1ConfigMode fromJson(
    Object? value, [
    String path = "Game2048ArenaV1ConfigMode",
  ]) => switch (value) {
    "solo" => Game2048ArenaV1ConfigMode.solo,
    "team-play" => Game2048ArenaV1ConfigMode.teamPlay,
    _ => throw FormatException(
      '$path: unknown Game2048ArenaV1ConfigMode value $value',
    ),
  };

  String toJson() => switch (this) {
    Game2048ArenaV1ConfigMode.solo => "solo",
    Game2048ArenaV1ConfigMode.teamPlay => "team-play",
  };
}

final class Game2048ArenaV1Config {
  Game2048ArenaV1Config({
    required this.mode,
    required this.level,
    required Iterable<String?> labels,
  }) : labels = List.unmodifiable(labels);

  factory Game2048ArenaV1Config.fromJson(Map<String, dynamic> json) {
    const path = "Game2048ArenaV1Config";
    _payloadObjectBounds(
      json,
      path,
      const <String>{"mode", "level", "labels"},
      true,
      null,
      null,
    );
    return Game2048ArenaV1Config(
      mode: Game2048ArenaV1ConfigMode.fromJson(
        _payloadRequired(json, "mode", "$path.mode"),
        "$path.mode",
      ),
      level: _payloadIntChoice(
        _payloadInt(
          _payloadRequired(json, "level", "$path.level"),
          "$path.level",
        ),
        "$path.level",
        const [1, 2],
      ),
      labels:
          _payloadListBounds(
            _payloadList(
              _payloadRequired(json, "labels", "$path.labels"),
              "$path.labels",
            ),
            "$path.labels",
            null,
            null,
            false,
          ).indexed.map((entry) {
            final index = entry.$1;
            final item = entry.$2;
            return item == null
                ? null
                : _payloadStringBounds(
                    _payloadString(item, "$path.labels[$index]"),
                    "$path.labels[$index]",
                    null,
                    null,
                  );
          }).toList(),
    );
  }

  final Game2048ArenaV1ConfigMode mode;

  final int level;

  final List<String?> labels;

  Map<String, dynamic> toJson() => {
    "mode": mode.toJson(),
    "level": level,
    "labels": labels.map((item) => item == null ? null : item!).toList(),
  };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Game2048ArenaV1Config &&
          _payloadEquals(mode, other.mode) &&
          _payloadEquals(level, other.level) &&
          _payloadEquals(labels, other.labels);

  @override
  int get hashCode => Object.hashAll([
    _payloadHash(mode),
    _payloadHash(level),
    _payloadHash(labels),
  ]);
}

abstract class Game2048ArenaV1RulesBase
    extends
        GameRules<
          Game2048ArenaV1Observation,
          Game2048ArenaV1Action,
          Game2048ArenaV1Config
        > {
  const Game2048ArenaV1RulesBase();

  @override
  Game2048ArenaV1Config parseConfig(Map<String, dynamic> json) =>
      Game2048ArenaV1Config.fromJson(json);

  @override
  Game2048ArenaV1Observation parseObservation(Map<String, dynamic> json) =>
      Game2048ArenaV1Observation.fromJson(json);

  @override
  Game2048ArenaV1Action parseAction(Map<String, dynamic> json) =>
      Game2048ArenaV1Action.fromJson(json);

  @override
  Map<String, dynamic> serializeAction(Game2048ArenaV1Action action) =>
      action.toJson();
}

final class Game2048ArenaV2Observation {
  Game2048ArenaV2Observation({required this.turn});

  factory Game2048ArenaV2Observation.fromJson(Map<String, dynamic> json) {
    const path = "Game2048ArenaV2Observation";
    _payloadObjectBounds(json, path, const <String>{"turn"}, false, null, null);
    return Game2048ArenaV2Observation(
      turn: _payloadNumberBounds(
        _payloadInt(_payloadRequired(json, "turn", "$path.turn"), "$path.turn"),
        "$path.turn",
        null,
        null,
        null,
        null,
      ),
    );
  }

  final int turn;

  Map<String, dynamic> toJson() => {"turn": turn};

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Game2048ArenaV2Observation && _payloadEquals(turn, other.turn);

  @override
  int get hashCode => Object.hashAll([_payloadHash(turn)]);
}

final class Game2048ArenaV2Action {
  Game2048ArenaV2Action({required this.pass});

  factory Game2048ArenaV2Action.fromJson(Map<String, dynamic> json) {
    const path = "Game2048ArenaV2Action";
    _payloadObjectBounds(json, path, const <String>{"pass"}, false, null, null);
    return Game2048ArenaV2Action(
      pass: _payloadBool(
        _payloadRequired(json, "pass", "$path.pass"),
        "$path.pass",
      ),
    );
  }

  final bool pass;

  Map<String, dynamic> toJson() => {"pass": pass};

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Game2048ArenaV2Action && _payloadEquals(pass, other.pass);

  @override
  int get hashCode => Object.hashAll([_payloadHash(pass)]);
}

final class Game2048ArenaV2Config {
  Game2048ArenaV2Config({required this.boardSize});

  factory Game2048ArenaV2Config.fromJson(Map<String, dynamic> json) {
    const path = "Game2048ArenaV2Config";
    _payloadObjectBounds(
      json,
      path,
      const <String>{"board-size"},
      false,
      null,
      null,
    );
    return Game2048ArenaV2Config(
      boardSize: _payloadNumberBounds(
        _payloadInt(
          _payloadRequired(json, "board-size", "$path.board-size"),
          "$path.board-size",
        ),
        "$path.board-size",
        null,
        null,
        null,
        null,
      ),
    );
  }

  final int boardSize;

  Map<String, dynamic> toJson() => {"board-size": boardSize};

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Game2048ArenaV2Config &&
          _payloadEquals(boardSize, other.boardSize);

  @override
  int get hashCode => Object.hashAll([_payloadHash(boardSize)]);
}

abstract class Game2048ArenaV2RulesBase
    extends
        GameRules<
          Game2048ArenaV2Observation,
          Game2048ArenaV2Action,
          Game2048ArenaV2Config
        > {
  const Game2048ArenaV2RulesBase();

  @override
  Game2048ArenaV2Config parseConfig(Map<String, dynamic> json) =>
      Game2048ArenaV2Config.fromJson(json);

  @override
  Game2048ArenaV2Observation parseObservation(Map<String, dynamic> json) =>
      Game2048ArenaV2Observation.fromJson(json);

  @override
  Game2048ArenaV2Action parseAction(Map<String, dynamic> json) =>
      Game2048ArenaV2Action.fromJson(json);

  @override
  Map<String, dynamic> serializeAction(Game2048ArenaV2Action action) =>
      action.toJson();
}
