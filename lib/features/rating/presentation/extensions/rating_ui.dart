import 'package:eigen_api/eigen_api.dart';
import 'package:eigen_flutter/core/theme/app_semantic_colors.dart';
import 'package:flutter/material.dart';

/// Display helpers for [Rating].
extension RatingUi on Rating {
  /// The pool name capitalised for display, e.g. `rapid` becomes `Rapid`.
  String get poolLabel =>
      pool.isEmpty ? pool : pool[0].toUpperCase() + pool.substring(1);
}

/// Display helpers for a change in a player's rating.
extension RatingDeltaUi on RatingDelta {
  /// The semantic color for a gain, loss, or unchanged rating.
  ///
  /// A gain is a stable success role rather than the app's tertiary brand
  /// color. Loss remains Material's built-in error role and an unchanged value
  /// stays neutral.
  Color color(ColorScheme colorScheme, {AppSemanticColors? semanticColors}) {
    if (displayChange > 0) {
      return (semanticColors ??
              AppSemanticColors.forBrightness(colorScheme.brightness))
          .success;
    }
    if (displayChange < 0) return colorScheme.error;
    return colorScheme.onSurfaceVariant;
  }
}
