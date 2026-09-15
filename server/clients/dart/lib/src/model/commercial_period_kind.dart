//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// The commercial accounting window. Calendar months always use UTC.
enum CommercialPeriodKind {
  /// The commercial accounting window. Calendar months always use UTC.
  @JsonValue(r'calendarMonth')
  calendarMonth(r'calendarMonth'),

  /// The commercial accounting window. Calendar months always use UTC.
  @JsonValue(r'subscriptionPeriod')
  subscriptionPeriod(r'subscriptionPeriod'),

  /// The commercial accounting window. Calendar months always use UTC.
  @JsonValue(r'lifetime')
  lifetime(r'lifetime'),

  /// The commercial accounting window. Calendar months always use UTC.
  @JsonValue(r'concurrent')
  concurrent(r'concurrent'),

  /// The commercial accounting window. Calendar months always use UTC.
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const CommercialPeriodKind(this.value);

  final String value;

  @override
  String toString() => value;
}
