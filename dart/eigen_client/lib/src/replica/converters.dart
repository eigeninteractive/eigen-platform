import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:eigen_api/eigen_api.dart';

/// A JSON object column: a game config, an observation, a raw local state.
final class JsonObjectConverter
    extends TypeConverter<Map<String, dynamic>, String> {
  const JsonObjectConverter();

  @override
  Map<String, dynamic> fromSql(String fromDb) =>
      (jsonDecode(fromDb) as Map).cast<String, dynamic>();

  @override
  String toSql(Map<String, dynamic> value) => jsonEncode(value);
}

/// A column holding a list of seat indexes or clock readings.
final class IntListConverter extends TypeConverter<List<int>, String> {
  const IntListConverter();

  @override
  List<int> fromSql(String fromDb) => (jsonDecode(fromDb) as List).cast<int>();

  @override
  String toSql(List<int> value) => jsonEncode(value);
}

/// A column holding generated wire models, stored as their own JSON so the
/// replica and the wire can never describe the same value two ways.
final class WireListConverter<T> extends TypeConverter<List<T>, String> {
  const WireListConverter(this._fromJson, this._toJson);

  final T Function(Map<String, dynamic>) _fromJson;
  final Map<String, dynamic> Function(T) _toJson;

  @override
  List<T> fromSql(String fromDb) => [
    for (final item in jsonDecode(fromDb) as List)
      _fromJson((item as Map).cast<String, dynamic>()),
  ];

  @override
  String toSql(List<T> value) =>
      jsonEncode([for (final item in value) _toJson(item)]);
}

/// Outcomes, as the summary and the finishing frame carry them.
const outcomesConverter = WireListConverter<Outcome>(
  Outcome.fromJson,
  _outcomeToJson,
);

/// Rating changes, as a finished rated game's frame carries them.
const ratingDeltasConverter = WireListConverter<RatingDelta>(
  RatingDelta.fromJson,
  _ratingDeltaToJson,
);

Map<String, dynamic> _outcomeToJson(Outcome outcome) => outcome.toJson();
Map<String, dynamic> _ratingDeltaToJson(RatingDelta delta) => delta.toJson();

/// A generated wire enum stored as its wire value.
///
/// An unrecognised stored value reads back as the enum's
/// `unknownDefaultOpenApi` member, exactly as an unrecognised wire value
/// decodes, so a row written by a newer build degrades the same way a newer
/// server's payload does.
final class WireEnumConverter<T extends Enum> extends TypeConverter<T, String> {
  const WireEnumConverter(this._values, this._valueOf, this._unknown);

  final List<T> _values;
  final String Function(T) _valueOf;
  final T _unknown;

  @override
  T fromSql(String fromDb) => _values.firstWhere(
    (value) => _valueOf(value) == fromDb,
    orElse: () => _unknown,
  );

  @override
  String toSql(T value) => _valueOf(value);
}

const gameStatusConverter = WireEnumConverter<GameStatus>(
  GameStatus.values,
  _gameStatusValue,
  GameStatus.unknownDefaultOpenApi,
);
const gameAccessConverter = WireEnumConverter<GameAccess>(
  GameAccess.values,
  _gameAccessValue,
  GameAccess.unknownDefaultOpenApi,
);
const gameOriginConverter = WireEnumConverter<GameOrigin>(
  GameOrigin.values,
  _gameOriginValue,
  GameOrigin.unknownDefaultOpenApi,
);
const seatTypeConverter = WireEnumConverter<SeatTypeEnum>(
  SeatTypeEnum.values,
  _seatTypeValue,
  SeatTypeEnum.unknownDefaultOpenApi,
);
const botTypeConverter = WireEnumConverter<BotType>(
  BotType.values,
  _botTypeValue,
  BotType.unknownDefaultOpenApi,
);
const requestDirectionConverter = WireEnumConverter<FriendRequestDirectionEnum>(
  FriendRequestDirectionEnum.values,
  _directionValue,
  FriendRequestDirectionEnum.unknownDefaultOpenApi,
);

String _gameStatusValue(GameStatus value) => value.value;
String _gameAccessValue(GameAccess value) => value.value;
String _gameOriginValue(GameOrigin value) => value.value;
String _seatTypeValue(SeatTypeEnum value) => value.value;
String _botTypeValue(BotType value) => value.value;
String _directionValue(FriendRequestDirectionEnum value) => value.value;
