//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// How this bot's moves are produced: `engine` in the server's game rules, `external` by a hosted service, `local` by a brain shipped in the client.
enum BotType {
  /// How this bot's moves are produced: `engine` in the server's game rules, `external` by a hosted service, `local` by a brain shipped in the client.
  @JsonValue(r'engine')
  engine(r'engine'),

  /// How this bot's moves are produced: `engine` in the server's game rules, `external` by a hosted service, `local` by a brain shipped in the client.
  @JsonValue(r'external')
  external_(r'external'),

  /// How this bot's moves are produced: `engine` in the server's game rules, `external` by a hosted service, `local` by a brain shipped in the client.
  @JsonValue(r'local')
  local(r'local'),

  /// How this bot's moves are produced: `engine` in the server's game rules, `external` by a hosted service, `local` by a brain shipped in the client.
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const BotType(this.value);

  final String value;

  @override
  String toString() => value;
}
