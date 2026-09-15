//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/commercial_period_kind.dart';
import 'package:json_annotation/json_annotation.dart';

part 'commercial_limit_access.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CommercialLimitAccess {
  /// Returns a new [CommercialLimitAccess] instance.
  CommercialLimitAccess({
    required this.metric,

    required this.maximum,

    required this.noCommercialLimit,

    required this.period,

    required this.used,

    required this.remaining,

    required this.resetsAt,
  });

  @JsonKey(
    name: r'metric',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CommercialLimitAccessMetricEnum.unknownDefaultOpenApi,
  )
  final CommercialLimitAccessMetricEnum metric;

  // minimum: 0
  @JsonKey(name: r'maximum', required: true, includeIfNull: true)
  final int? maximum;

  @JsonKey(name: r'noCommercialLimit', required: true, includeIfNull: false)
  final bool noCommercialLimit;

  @JsonKey(
    name: r'period',
    required: true,
    includeIfNull: true,
    unknownEnumValue: CommercialPeriodKind.unknownDefaultOpenApi,
  )
  final CommercialPeriodKind? period;

  // minimum: 0
  @JsonKey(name: r'used', required: true, includeIfNull: false)
  final int used;

  // minimum: 0
  @JsonKey(name: r'remaining', required: true, includeIfNull: true)
  final int? remaining;

  @JsonKey(name: r'resetsAt', required: true, includeIfNull: true)
  final int? resetsAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CommercialLimitAccess &&
          other.metric == metric &&
          other.maximum == maximum &&
          other.noCommercialLimit == noCommercialLimit &&
          other.period == period &&
          other.used == used &&
          other.remaining == remaining &&
          other.resetsAt == resetsAt;

  @override
  int get hashCode =>
      metric.hashCode +
      (maximum == null ? 0 : maximum.hashCode) +
      noCommercialLimit.hashCode +
      (period == null ? 0 : period.hashCode) +
      used.hashCode +
      (remaining == null ? 0 : remaining.hashCode) +
      (resetsAt == null ? 0 : resetsAt.hashCode);

  factory CommercialLimitAccess.fromJson(Map<String, dynamic> json) =>
      _$CommercialLimitAccessFromJson(json);

  Map<String, dynamic> toJson() => _$CommercialLimitAccessToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum CommercialLimitAccessMetricEnum {
  @JsonValue(r'game.create.success')
  gamePeriodCreatePeriodSuccess(r'game.create.success'),
  @JsonValue(r'games.openCreated')
  gamesPeriodOpenCreated(r'games.openCreated'),
  @JsonValue(r'bot.game.success')
  botPeriodGamePeriodSuccess(r'bot.game.success'),
  @JsonValue(r'analysis.run.success')
  analysisPeriodRunPeriodSuccess(r'analysis.run.success'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const CommercialLimitAccessMetricEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
