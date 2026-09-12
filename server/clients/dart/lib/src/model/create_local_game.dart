//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'create_local_game.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateLocalGame {
  /// Returns a new [CreateLocalGame] instance.
  CreateLocalGame({
    required this.gameId,

    required this.schemaVersion,

    required this.config,

    this.minPlayers,

    this.maxPlayers,

    required this.botIds,

    required this.seed,

    required this.createdAt,
  });

  @JsonKey(name: r'gameId', required: true, includeIfNull: false)
  final String gameId;

  /// The schemaVersion the device played at. Any version this deployment ships is accepted; a newer one answers 409 serverUpdateRequired.
  @JsonKey(name: r'schemaVersion', required: true, includeIfNull: false)
  final int schemaVersion;

  @JsonKey(name: r'config', required: true, includeIfNull: false)
  final Object config;

  // minimum: 1
  @JsonKey(name: r'minPlayers', required: false, includeIfNull: false)
  final int? minPlayers;

  // minimum: 1
  @JsonKey(name: r'maxPlayers', required: false, includeIfNull: false)
  final int? maxPlayers;

  @JsonKey(name: r'botIds', required: true, includeIfNull: false)
  final List<String> botIds;

  @JsonKey(name: r'seed', required: true, includeIfNull: false)
  final String seed;

  /// Epoch milliseconds, as the device recorded it. Stored as min(claimed, server now).
  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final int createdAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CreateLocalGame &&
          other.gameId == gameId &&
          other.schemaVersion == schemaVersion &&
          other.config == config &&
          other.minPlayers == minPlayers &&
          other.maxPlayers == maxPlayers &&
          other.botIds == botIds &&
          other.seed == seed &&
          other.createdAt == createdAt;

  @override
  int get hashCode =>
      gameId.hashCode +
      schemaVersion.hashCode +
      config.hashCode +
      minPlayers.hashCode +
      maxPlayers.hashCode +
      botIds.hashCode +
      seed.hashCode +
      createdAt.hashCode;

  factory CreateLocalGame.fromJson(Map<String, dynamic> json) =>
      _$CreateLocalGameFromJson(json);

  Map<String, dynamic> toJson() => _$CreateLocalGameToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
