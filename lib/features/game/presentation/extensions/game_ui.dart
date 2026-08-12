import 'package:eigen_api/eigen_api.dart';
import 'package:eigen_flutter/core/theme/app_semantic_colors.dart';
import 'package:flutter/material.dart';

/// UI helpers for [GameStatus]: color and icon mappings.
extension GameStatusUI on GameStatus {
  /// Returns the semantic foreground associated with this status.
  ///
  /// Pass the extension from the active theme so high-contrast mode is
  /// preserved. The brightness-derived fallback keeps existing callers
  /// brand-independent while they migrate.
  Color color(ColorScheme colorScheme, {AppSemanticColors? semanticColors}) =>
      switch (this) {
        GameStatus.waiting => _semantic(colorScheme, semanticColors).warning,
        GameStatus.ready => _semantic(colorScheme, semanticColors).info,
        GameStatus.active => _semantic(colorScheme, semanticColors).success,
        GameStatus.finished => colorScheme.onSurfaceVariant,
        GameStatus.aborted => colorScheme.error,
        GameStatus.unknownDefaultOpenApi => colorScheme.onSurfaceVariant,
      };

  /// Returns the semantic container associated with this status.
  Color containerColor(
    ColorScheme colorScheme, {
    AppSemanticColors? semanticColors,
  }) => switch (this) {
    GameStatus.waiting => _semantic(
      colorScheme,
      semanticColors,
    ).warningContainer,
    GameStatus.ready => _semantic(colorScheme, semanticColors).infoContainer,
    GameStatus.active => _semantic(
      colorScheme,
      semanticColors,
    ).successContainer,
    GameStatus.finished ||
    GameStatus.unknownDefaultOpenApi => colorScheme.surfaceContainerHighest,
    GameStatus.aborted => colorScheme.errorContainer,
  };

  /// Returns the paired foreground for [containerColor].
  Color onContainerColor(
    ColorScheme colorScheme, {
    AppSemanticColors? semanticColors,
  }) => switch (this) {
    GameStatus.waiting => _semantic(
      colorScheme,
      semanticColors,
    ).onWarningContainer,
    GameStatus.ready => _semantic(colorScheme, semanticColors).onInfoContainer,
    GameStatus.active => _semantic(
      colorScheme,
      semanticColors,
    ).onSuccessContainer,
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
  Color color(ColorScheme colorScheme, {AppSemanticColors? semanticColors}) =>
      switch (this) {
        OutcomeResultEnum.win => _semantic(colorScheme, semanticColors).success,
        OutcomeResultEnum.loss => colorScheme.error,
        OutcomeResultEnum.draw => _semantic(colorScheme, semanticColors).info,
        OutcomeResultEnum.eliminated => colorScheme.error,
        OutcomeResultEnum.unknownDefaultOpenApi => colorScheme.onSurfaceVariant,
        null => colorScheme.onSurfaceVariant,
      };

  /// Returns the semantic container associated with this result.
  Color containerColor(
    ColorScheme colorScheme, {
    AppSemanticColors? semanticColors,
  }) => switch (this) {
    OutcomeResultEnum.win => _semantic(
      colorScheme,
      semanticColors,
    ).successContainer,
    OutcomeResultEnum.loss ||
    OutcomeResultEnum.eliminated => colorScheme.errorContainer,
    OutcomeResultEnum.draw => _semantic(
      colorScheme,
      semanticColors,
    ).infoContainer,
    OutcomeResultEnum.unknownDefaultOpenApi ||
    null => colorScheme.surfaceContainerHighest,
  };

  /// Returns the paired foreground for [containerColor].
  Color onContainerColor(
    ColorScheme colorScheme, {
    AppSemanticColors? semanticColors,
  }) => switch (this) {
    OutcomeResultEnum.win => _semantic(
      colorScheme,
      semanticColors,
    ).onSuccessContainer,
    OutcomeResultEnum.loss ||
    OutcomeResultEnum.eliminated => colorScheme.onErrorContainer,
    OutcomeResultEnum.draw => _semantic(
      colorScheme,
      semanticColors,
    ).onInfoContainer,
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

AppSemanticColors _semantic(
  ColorScheme colorScheme,
  AppSemanticColors? semanticColors,
) => semanticColors ?? AppSemanticColors.forBrightness(colorScheme.brightness);
