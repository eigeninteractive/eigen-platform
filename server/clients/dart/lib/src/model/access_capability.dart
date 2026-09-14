//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'access_capability.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AccessCapability {
  /// Returns a new [AccessCapability] instance.
  AccessCapability({
    required this.kind,

    this.access,

    this.tier,

    this.collection,

    this.id,

    this.analysisType,
  });

  @JsonKey(
    name: r'kind',
    required: true,
    includeIfNull: false,
    unknownEnumValue: AccessCapabilityKindEnum.unknownDefaultOpenApi,
  )
  final AccessCapabilityKindEnum kind;

  @JsonKey(
    name: r'access',
    required: false,
    includeIfNull: false,
    unknownEnumValue: AccessCapabilityAccessEnum.unknownDefaultOpenApi,
  )
  final AccessCapabilityAccessEnum? access;

  @JsonKey(name: r'tier', required: false, includeIfNull: false)
  final String? tier;

  @JsonKey(name: r'collection', required: false, includeIfNull: false)
  final String? collection;

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'analysisType', required: false, includeIfNull: false)
  final String? analysisType;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AccessCapability &&
          other.kind == kind &&
          other.access == access &&
          other.tier == tier &&
          other.collection == collection &&
          other.id == id &&
          other.analysisType == analysisType;

  @override
  int get hashCode =>
      kind.hashCode +
      access.hashCode +
      tier.hashCode +
      collection.hashCode +
      id.hashCode +
      analysisType.hashCode;

  factory AccessCapability.fromJson(Map<String, dynamic> json) =>
      _$AccessCapabilityFromJson(json);

  Map<String, dynamic> toJson() => _$AccessCapabilityToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum AccessCapabilityKindEnum {
  @JsonValue(r'app.access')
  appPeriodAccess(r'app.access'),
  @JsonValue(r'game.create')
  gamePeriodCreate(r'game.create'),
  @JsonValue(r'game.join')
  gamePeriodJoin(r'game.join'),
  @JsonValue(r'game.create.rated')
  gamePeriodCreatePeriodRated(r'game.create.rated'),
  @JsonValue(r'bot.use')
  botPeriodUse(r'bot.use'),
  @JsonValue(r'content.use')
  contentPeriodUse(r'content.use'),
  @JsonValue(r'replay.read')
  replayPeriodRead(r'replay.read'),
  @JsonValue(r'analysis.use')
  analysisPeriodUse(r'analysis.use'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const AccessCapabilityKindEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum AccessCapabilityAccessEnum {
  @JsonValue(r'public')
  public(r'public'),
  @JsonValue(r'private')
  private(r'private'),
  @JsonValue(r'friends')
  friends(r'friends'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const AccessCapabilityAccessEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
