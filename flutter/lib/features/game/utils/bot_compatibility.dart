import 'package:eigen_api/eigen_api.dart';

/// Capability checks shared by every bot picker.
extension BotCompatibility on Bot {
  /// Whether this bot can play a game using [gameSchemaVersion].
  ///
  /// A bot's [Bot.schemaVersion] is the highest game schema it supports, so an
  /// equal or older game is compatible and a newer game is not.
  bool supportsGameSchema(int gameSchemaVersion) =>
      gameSchemaVersion <= schemaVersion;
}
