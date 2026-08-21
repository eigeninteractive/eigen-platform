import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:flutter/material.dart';

/// UI helpers for [GameStatus]: color and icon mappings.
extension GameStatusUI on GameStatus {
  /// Returns the semantic foreground associated with this status.
  ///
  /// Pass the extension from the active theme so high-contrast mode is
  /// preserved.
  Color color(
    ColorScheme colorScheme, {
    required AppSemanticColors semanticColors,
  }) => switch (this) {
    GameStatus.waiting => semanticColors.warning,
    GameStatus.ready => semanticColors.info,
    GameStatus.active => semanticColors.success,
    GameStatus.finished => colorScheme.onSurfaceVariant,
    GameStatus.aborted => colorScheme.error,
    GameStatus.unknownDefaultOpenApi => colorScheme.onSurfaceVariant,
  };

  /// Returns the semantic container associated with this status.
  Color containerColor(
    ColorScheme colorScheme, {
    required AppSemanticColors semanticColors,
  }) => switch (this) {
    GameStatus.waiting => semanticColors.warningContainer,
    GameStatus.ready => semanticColors.infoContainer,
    GameStatus.active => semanticColors.successContainer,
    GameStatus.finished ||
    GameStatus.unknownDefaultOpenApi => colorScheme.surfaceContainerHighest,
    GameStatus.aborted => colorScheme.errorContainer,
  };

  /// Returns the paired foreground for [containerColor].
  Color onContainerColor(
    ColorScheme colorScheme, {
    required AppSemanticColors semanticColors,
  }) => switch (this) {
    GameStatus.waiting => semanticColors.onWarningContainer,
    GameStatus.ready => semanticColors.onInfoContainer,
    GameStatus.active => semanticColors.onSuccessContainer,
    GameStatus.finished ||
    GameStatus.unknownDefaultOpenApi => colorScheme.onSurfaceVariant,
    GameStatus.aborted => colorScheme.onErrorContainer,
  };

  /// Returns the icon associated with this status.
  IconData get icon => switch (this) {
    GameStatus.waiting => Icons.hourglass_empty,
    GameStatus.ready => Icons.play_circle_outline,
    GameStatus.active => Icons.sports_esports,
    GameStatus.finished => Icons.emoji_events,
    GameStatus.aborted => Icons.cancel_outlined,
    GameStatus.unknownDefaultOpenApi => Icons.help_outline,
  };
}

/// UI helpers for [OutcomeResultEnum]: icon, color, and label mappings.
///
/// Defined on the nullable type so the null case (aborted game, no outcome
/// row written) can be handled uniformly alongside real results.
extension OutcomeResultUI on OutcomeResultEnum? {
  /// Returns the icon associated with this result.
  IconData get icon => switch (this) {
    OutcomeResultEnum.win => Icons.emoji_events,
    OutcomeResultEnum.loss => Icons.close,
    OutcomeResultEnum.draw => Icons.handshake_outlined,
    OutcomeResultEnum.eliminated => Icons.remove_circle_outline,
    OutcomeResultEnum.unknownDefaultOpenApi => Icons.help_outline,
    null => Icons.cancel_outlined,
  };

  /// Returns the semantic foreground associated with this result.
  Color color(
    ColorScheme colorScheme, {
    required AppSemanticColors semanticColors,
  }) => switch (this) {
    OutcomeResultEnum.win => semanticColors.success,
    OutcomeResultEnum.loss => colorScheme.error,
    OutcomeResultEnum.draw => semanticColors.info,
    OutcomeResultEnum.eliminated => colorScheme.error,
    OutcomeResultEnum.unknownDefaultOpenApi => colorScheme.onSurfaceVariant,
    null => colorScheme.onSurfaceVariant,
  };

  /// Returns the semantic container associated with this result.
  Color containerColor(
    ColorScheme colorScheme, {
    required AppSemanticColors semanticColors,
  }) => switch (this) {
    OutcomeResultEnum.win => semanticColors.successContainer,
    OutcomeResultEnum.loss ||
    OutcomeResultEnum.eliminated => colorScheme.errorContainer,
    OutcomeResultEnum.draw => semanticColors.infoContainer,
    OutcomeResultEnum.unknownDefaultOpenApi ||
    null => colorScheme.surfaceContainerHighest,
  };

  /// Returns the paired foreground for [containerColor].
  Color onContainerColor(
    ColorScheme colorScheme, {
    required AppSemanticColors semanticColors,
  }) => switch (this) {
    OutcomeResultEnum.win => semanticColors.onSuccessContainer,
    OutcomeResultEnum.loss ||
    OutcomeResultEnum.eliminated => colorScheme.onErrorContainer,
    OutcomeResultEnum.draw => semanticColors.onInfoContainer,
    OutcomeResultEnum.unknownDefaultOpenApi ||
    null => colorScheme.onSurfaceVariant,
  };

  /// Returns the short display label for this result.
  String get label => switch (this) {
    OutcomeResultEnum.win => 'Won',
    OutcomeResultEnum.loss => 'Lost',
    OutcomeResultEnum.draw => 'Draw',
    OutcomeResultEnum.eliminated => 'Eliminated',
    OutcomeResultEnum.unknownDefaultOpenApi => 'Unknown',
    null => 'Aborted',
  };
}
