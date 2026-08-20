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

enum RpsV1Move {
  rock,
  paper,
  scissors;

  static RpsV1Move fromJson(Object? value, [String path = "RpsV1Move"]) =>
      switch (value) {
        "rock" => RpsV1Move.rock,
        "paper" => RpsV1Move.paper,
        "scissors" => RpsV1Move.scissors,
        _ => throw FormatException('$path: unknown RpsV1Move value $value'),
      };

  String toJson() => switch (this) {
    RpsV1Move.rock => "rock",
    RpsV1Move.paper => "paper",
    RpsV1Move.scissors => "scissors",
  };
}

final class RpsV1Round {
  RpsV1Round({required Iterable<RpsV1Move> moves, required this.winner})
    : moves = List.unmodifiable(moves);

  factory RpsV1Round.fromJson(Map<String, dynamic> json) {
    const path = "RpsV1Round";
    _payloadObjectBounds(
      json,
      path,
      const <String>{"moves", "winner"},
      true,
      null,
      null,
    );
    return RpsV1Round(
      moves:
          _payloadListBounds(
            _payloadList(
              _payloadRequired(json, "moves", "$path.moves"),
              "$path.moves",
            ),
            "$path.moves",
            2,
            2,
            false,
          ).indexed.map((entry) {
            final index = entry.$1;
            final item = entry.$2;
            return RpsV1Move.fromJson(item, "$path.moves[$index]");
          }).toList(),
      winner: _payloadRequired(json, "winner", "$path.winner") == null
          ? null
          : _payloadNumberBounds(
              _payloadInt(
                _payloadRequired(json, "winner", "$path.winner"),
                "$path.winner",
              ),
              "$path.winner",
              0,
              1,
              null,
              null,
            ),
    );
  }

  final List<RpsV1Move> moves;

  final int? winner;

  Map<String, dynamic> toJson() => {
    "moves": moves.map((item) => item.toJson()).toList(),
    "winner": winner == null ? null : winner!,
  };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RpsV1Round &&
          _payloadEquals(moves, other.moves) &&
          _payloadEquals(winner, other.winner);

  @override
  int get hashCode =>
      Object.hashAll([_payloadHash(moves), _payloadHash(winner)]);
}

final class RpsV1Observation {
  RpsV1Observation({
    Iterable<RpsV1Move?>? commits,
    required this.lastRound,
    required this.round,
    required Iterable<int> wins,
    this.yourMove,
  }) : commits = commits == null ? null : List.unmodifiable(commits),
       wins = List.unmodifiable(wins);

  factory RpsV1Observation.fromJson(Map<String, dynamic> json) {
    const path = "RpsV1Observation";
    _payloadObjectBounds(
      json,
      path,
      const <String>{"commits", "lastRound", "round", "wins", "yourMove"},
      true,
      null,
      null,
    );
    return RpsV1Observation(
      commits: json.containsKey("commits")
          ? _payloadListBounds(
              _payloadList(json["commits"], "$path.commits"),
              "$path.commits",
              2,
              2,
              false,
            ).indexed.map((entry) {
              final index = entry.$1;
              final item = entry.$2;
              return item == null
                  ? null
                  : RpsV1Move.fromJson(item, "$path.commits[$index]");
            }).toList()
          : null,
      lastRound: _payloadRequired(json, "lastRound", "$path.lastRound") == null
          ? null
          : RpsV1Round.fromJson(
              _payloadMap(
                _payloadRequired(json, "lastRound", "$path.lastRound"),
                "$path.lastRound",
              ),
            ),
      round: _payloadNumberBounds(
        _payloadInt(
          _payloadRequired(json, "round", "$path.round"),
          "$path.round",
        ),
        "$path.round",
        1,
        9007199254740991,
        null,
        null,
      ),
      wins:
          _payloadListBounds(
            _payloadList(
              _payloadRequired(json, "wins", "$path.wins"),
              "$path.wins",
            ),
            "$path.wins",
            2,
            2,
            false,
          ).indexed.map((entry) {
            final index = entry.$1;
            final item = entry.$2;
            return _payloadNumberBounds(
              _payloadInt(item, "$path.wins[$index]"),
              "$path.wins[$index]",
              0,
              9007199254740991,
              null,
              null,
            );
          }).toList(),
      yourMove: json.containsKey("yourMove")
          ? json["yourMove"] == null
                ? null
                : RpsV1Move.fromJson(json["yourMove"], "$path.yourMove")
          : null,
    );
  }

  final List<RpsV1Move?>? commits;

  final RpsV1Round? lastRound;

  final int round;

  final List<int> wins;

  final RpsV1Move? yourMove;

  Map<String, dynamic> toJson() => {
    if (commits != null)
      "commits": commits!
          .map((item) => item == null ? null : item!.toJson())
          .toList(),
    "lastRound": lastRound == null ? null : lastRound!.toJson(),
    "round": round,
    "wins": wins.map((item) => item).toList(),
    if (yourMove != null) "yourMove": yourMove!.toJson(),
  };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RpsV1Observation &&
          _payloadEquals(commits, other.commits) &&
          _payloadEquals(lastRound, other.lastRound) &&
          _payloadEquals(round, other.round) &&
          _payloadEquals(wins, other.wins) &&
          _payloadEquals(yourMove, other.yourMove);

  @override
  int get hashCode => Object.hashAll([
    _payloadHash(commits),
    _payloadHash(lastRound),
    _payloadHash(round),
    _payloadHash(wins),
    _payloadHash(yourMove),
  ]);
}

final class RpsV1Action {
  RpsV1Action({required this.move});

  factory RpsV1Action.fromJson(Map<String, dynamic> json) {
    const path = "RpsV1Action";
    _payloadObjectBounds(json, path, const <String>{"move"}, true, null, null);
    return RpsV1Action(
      move: RpsV1Move.fromJson(
        _payloadRequired(json, "move", "$path.move"),
        "$path.move",
      ),
    );
  }

  final RpsV1Move move;

  Map<String, dynamic> toJson() => {"move": move.toJson()};

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RpsV1Action && _payloadEquals(move, other.move);

  @override
  int get hashCode => Object.hashAll([_payloadHash(move)]);
}

final class RpsV1Config {
  RpsV1Config({required this.targetWins});

  factory RpsV1Config.fromJson(Map<String, dynamic> json) {
    const path = "RpsV1Config";
    _payloadObjectBounds(
      json,
      path,
      const <String>{"targetWins"},
      true,
      null,
      null,
    );
    return RpsV1Config(
      targetWins: _payloadNumberBounds(
        _payloadInt(
          _payloadRequired(json, "targetWins", "$path.targetWins"),
          "$path.targetWins",
        ),
        "$path.targetWins",
        1,
        10,
        null,
        null,
      ),
    );
  }

  final int targetWins;

  Map<String, dynamic> toJson() => {"targetWins": targetWins};

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RpsV1Config && _payloadEquals(targetWins, other.targetWins);

  @override
  int get hashCode => Object.hashAll([_payloadHash(targetWins)]);
}

abstract class RpsV1RulesBase
    extends GameRules<RpsV1Observation, RpsV1Action, RpsV1Config> {
  const RpsV1RulesBase();

  @override
  RpsV1Config parseConfig(Map<String, dynamic> json) =>
      RpsV1Config.fromJson(json);

  @override
  RpsV1Observation parseObservation(Map<String, dynamic> json) =>
      RpsV1Observation.fromJson(json);

  @override
  RpsV1Action parseAction(Map<String, dynamic> json) =>
      RpsV1Action.fromJson(json);

  @override
  Map<String, dynamic> serializeAction(RpsV1Action action) => action.toJson();
}
