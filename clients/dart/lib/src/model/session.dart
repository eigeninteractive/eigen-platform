//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/frame.dart';
import 'package:eigen_api/src/model/seat.dart';
import 'package:eigen_api/src/model/game_status.dart';
import 'package:eigen_api/src/model/game_access.dart';
import 'package:json_annotation/json_annotation.dart';

part 'session.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Session {
  /// Returns a new [Session] instance.
  Session({
    required this.type,

    required this.seq,

    required this.gameId,

    required this.shortCode,

    required this.access,

    required this.schemaVersion,

    required this.config,

    required this.turnSeconds,

    required this.budgetSeconds,

    required this.incrementSeconds,

    required this.rated,

    required this.ratingPool,

    required this.minPlayers,

    required this.maxPlayers,

    required this.createdBy,

    required this.status,

    required this.players,

    required this.version,

    required this.frame,
  });

  @JsonKey(
    name: r'type',
    required: true,
    includeIfNull: false,
    unknownEnumValue: SessionTypeEnum.unknownDefaultOpenApi,
  )
  final SessionTypeEnum type;

  @JsonKey(name: r'seq', required: true, includeIfNull: false)
  final int seq;

  @JsonKey(name: r'gameId', required: true, includeIfNull: false)
  final String gameId;

  @JsonKey(name: r'shortCode', required: true, includeIfNull: false)
  final String shortCode;

  @JsonKey(
    name: r'access',
    required: true,
    includeIfNull: false,
    unknownEnumValue: GameAccess.unknownDefaultOpenApi,
  )
  final GameAccess access;

  @JsonKey(name: r'schemaVersion', required: true, includeIfNull: false)
  final int schemaVersion;

  @JsonKey(name: r'config', required: true, includeIfNull: false)
  final Object config;

  @JsonKey(name: r'turnSeconds', required: true, includeIfNull: true)
  final int? turnSeconds;

  @JsonKey(name: r'budgetSeconds', required: true, includeIfNull: true)
  final int? budgetSeconds;

  @JsonKey(name: r'incrementSeconds', required: true, includeIfNull: true)
  final int? incrementSeconds;

  @JsonKey(name: r'rated', required: true, includeIfNull: false)
  final bool rated;

  @JsonKey(name: r'ratingPool', required: true, includeIfNull: true)
  final String? ratingPool;

  @JsonKey(name: r'minPlayers', required: true, includeIfNull: false)
  final int minPlayers;

  @JsonKey(name: r'maxPlayers', required: true, includeIfNull: false)
  final int maxPlayers;

  @JsonKey(name: r'createdBy', required: true, includeIfNull: true)
  final String? createdBy;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: GameStatus.unknownDefaultOpenApi,
  )
  final GameStatus status;

  @JsonKey(name: r'players', required: true, includeIfNull: false)
  final List<Seat> players;

  @JsonKey(name: r'version', required: true, includeIfNull: true)
  final int? version;

  @JsonKey(name: r'frame', required: true, includeIfNull: true)
  final Frame? frame;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Session &&
          other.type == type &&
          other.seq == seq &&
          other.gameId == gameId &&
          other.shortCode == shortCode &&
          other.access == access &&
          other.schemaVersion == schemaVersion &&
          other.config == config &&
          other.turnSeconds == turnSeconds &&
          other.budgetSeconds == budgetSeconds &&
          other.incrementSeconds == incrementSeconds &&
          other.rated == rated &&
          other.ratingPool == ratingPool &&
          other.minPlayers == minPlayers &&
          other.maxPlayers == maxPlayers &&
          other.createdBy == createdBy &&
          other.status == status &&
          other.players == players &&
          other.version == version &&
          other.frame == frame;

  @override
  int get hashCode =>
      type.hashCode +
      seq.hashCode +
      gameId.hashCode +
      shortCode.hashCode +
      access.hashCode +
      schemaVersion.hashCode +
      config.hashCode +
      (turnSeconds == null ? 0 : turnSeconds.hashCode) +
      (budgetSeconds == null ? 0 : budgetSeconds.hashCode) +
      (incrementSeconds == null ? 0 : incrementSeconds.hashCode) +
      rated.hashCode +
      (ratingPool == null ? 0 : ratingPool.hashCode) +
      minPlayers.hashCode +
      maxPlayers.hashCode +
      (createdBy == null ? 0 : createdBy.hashCode) +
      status.hashCode +
      players.hashCode +
      (version == null ? 0 : version.hashCode) +
      (frame == null ? 0 : frame.hashCode);

  factory Session.fromJson(Map<String, dynamic> json) =>
      _$SessionFromJson(json);

  Map<String, dynamic> toJson() => _$SessionToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum SessionTypeEnum {
  @JsonValue(r'session')
  session(r'session'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const SessionTypeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
