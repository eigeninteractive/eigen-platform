//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'create_solo.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateSolo {
  /// Returns a new [CreateSolo] instance.
  CreateSolo({
    required this.schemaVersion,

    required this.config,

    this.minPlayers,

    this.maxPlayers,

    this.rated,

    required this.botIds,

    this.turnSeconds,

    this.budgetSeconds,

    this.incrementSeconds,
  });

  /// The schemaVersion this config was built for. Must be one of the server's creatableSchemaVersions, published by GET /capabilities.
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

  @JsonKey(name: r'rated', required: false, includeIfNull: false)
  final bool? rated;

  @JsonKey(name: r'botIds', required: true, includeIfNull: false)
  final List<String> botIds;

  @JsonKey(name: r'turnSeconds', required: false, includeIfNull: false)
  final int? turnSeconds;

  @JsonKey(name: r'budgetSeconds', required: false, includeIfNull: false)
  final int? budgetSeconds;

  @JsonKey(name: r'incrementSeconds', required: false, includeIfNull: false)
  final int? incrementSeconds;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CreateSolo &&
          other.schemaVersion == schemaVersion &&
          other.config == config &&
          other.minPlayers == minPlayers &&
          other.maxPlayers == maxPlayers &&
          other.rated == rated &&
          other.botIds == botIds &&
          other.turnSeconds == turnSeconds &&
          other.budgetSeconds == budgetSeconds &&
          other.incrementSeconds == incrementSeconds;

  @override
  int get hashCode =>
      schemaVersion.hashCode +
      config.hashCode +
      minPlayers.hashCode +
      maxPlayers.hashCode +
      rated.hashCode +
      botIds.hashCode +
      (turnSeconds == null ? 0 : turnSeconds.hashCode) +
      (budgetSeconds == null ? 0 : budgetSeconds.hashCode) +
      (incrementSeconds == null ? 0 : incrementSeconds.hashCode);

  factory CreateSolo.fromJson(Map<String, dynamic> json) =>
      _$CreateSoloFromJson(json);

  Map<String, dynamic> toJson() => _$CreateSoloToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
