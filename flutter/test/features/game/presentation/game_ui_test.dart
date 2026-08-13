import 'package:checks/checks.dart';
import 'package:eigen_api/eigen_api.dart';
import 'package:eigen_flutter/core/theme/app_semantic_colors.dart';
import 'package:eigen_flutter/features/game/presentation/extensions/game_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final colorScheme = ColorScheme.fromSeed(seedColor: Colors.purple);
  final semanticColors = AppSemanticColors.forBrightness(Brightness.light);

  test('game statuses use semantic roles instead of brand roles', () {
    check(
      GameStatus.waiting.color(colorScheme, semanticColors: semanticColors),
    ).equals(semanticColors.warning);
    check(
      GameStatus.ready.color(colorScheme, semanticColors: semanticColors),
    ).equals(semanticColors.info);
    check(
      GameStatus.active.color(colorScheme, semanticColors: semanticColors),
    ).equals(semanticColors.success);
    check(
      GameStatus.aborted.color(colorScheme, semanticColors: semanticColors),
    ).equals(colorScheme.error);
    check(
      GameStatus.finished.color(colorScheme, semanticColors: semanticColors),
    ).equals(colorScheme.onSurfaceVariant);
  });

  test('game status containers return their paired foregrounds', () {
    check(
      GameStatus.waiting.containerColor(
        colorScheme,
        semanticColors: semanticColors,
      ),
    ).equals(semanticColors.warningContainer);
    check(
      GameStatus.waiting.onContainerColor(
        colorScheme,
        semanticColors: semanticColors,
      ),
    ).equals(semanticColors.onWarningContainer);
    check(
      GameStatus.aborted.containerColor(
        colorScheme,
        semanticColors: semanticColors,
      ),
    ).equals(colorScheme.errorContainer);
    check(
      GameStatus.aborted.onContainerColor(
        colorScheme,
        semanticColors: semanticColors,
      ),
    ).equals(colorScheme.onErrorContainer);
  });

  test('outcomes use success, info, error, and neutral roles', () {
    check(
      OutcomeResultEnum.win.color(colorScheme, semanticColors: semanticColors),
    ).equals(semanticColors.success);
    check(
      OutcomeResultEnum.draw.color(colorScheme, semanticColors: semanticColors),
    ).equals(semanticColors.info);
    check(
      OutcomeResultEnum.loss.color(colorScheme, semanticColors: semanticColors),
    ).equals(colorScheme.error);

    final OutcomeResultEnum? aborted = null;
    check(
      aborted.color(colorScheme, semanticColors: semanticColors),
    ).equals(colorScheme.onSurfaceVariant);
    check(
      aborted.containerColor(colorScheme, semanticColors: semanticColors),
    ).equals(colorScheme.surfaceContainerHighest);
  });
}
