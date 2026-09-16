//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/bot_type.dart';
import 'package:json_annotation/json_annotation.dart';

part 'bot.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Bot {
  /// Returns a new [Bot] instance.
  Bot({
    required this.id,

    required this.username,

    required this.displayName,

    required this.avatarUrl,

    required this.schemaVersion,

    required this.type,

    required this.ratedEligible,

    required this.config,

    required this.tier,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'username', required: true, includeIfNull: false)
  final String username;

  @JsonKey(name: r'displayName', required: true, includeIfNull: false)
  final String displayName;

  @JsonKey(name: r'avatarUrl', required: true, includeIfNull: true)
  final String? avatarUrl;

  @JsonKey(name: r'schemaVersion', required: true, includeIfNull: false)
  final int schemaVersion;

  @JsonKey(
    name: r'type',
    required: true,
    includeIfNull: false,
    unknownEnumValue: BotType.unknownDefaultOpenApi,
  )
  final BotType type;

  @JsonKey(name: r'ratedEligible', required: true, includeIfNull: false)
  final bool ratedEligible;

  @JsonKey(name: r'config', required: true, includeIfNull: false)
  final Object config;

  /// The commercial tier this bot belongs to: its `botTiers` entry, or `standard`. A `local` bot is always `standard`, because the server never seats it. Presentation only: the server checks access when it seats the bot.
  @JsonKey(name: r'tier', required: true, includeIfNull: false)
  final String tier;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Bot &&
          other.id == id &&
          other.username == username &&
          other.displayName == displayName &&
          other.avatarUrl == avatarUrl &&
          other.schemaVersion == schemaVersion &&
          other.type == type &&
          other.ratedEligible == ratedEligible &&
          other.config == config &&
          other.tier == tier;

  @override
  int get hashCode =>
      id.hashCode +
      username.hashCode +
      displayName.hashCode +
      (avatarUrl == null ? 0 : avatarUrl.hashCode) +
      schemaVersion.hashCode +
      type.hashCode +
      ratedEligible.hashCode +
      config.hashCode +
      tier.hashCode;

  factory Bot.fromJson(Map<String, dynamic> json) => _$BotFromJson(json);

  Map<String, dynamic> toJson() => _$BotToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
