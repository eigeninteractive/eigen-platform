import 'package:checks/checks.dart';
import 'package:eigen_api/eigen_api.dart';
import 'package:eigen_flutter/core/theme/app_semantic_colors.dart';
import 'package:eigen_flutter/features/rating/presentation/extensions/rating_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final colorScheme = ColorScheme.fromSeed(seedColor: Colors.purple);
  final semanticColors = AppSemanticColors.forBrightness(Brightness.light);

  test('rating gains use success while losses and no-change stay standard', () {
    check(
      _delta(12).color(colorScheme, semanticColors: semanticColors),
    ).equals(semanticColors.success);
    check(
      _delta(-12).color(colorScheme, semanticColors: semanticColors),
    ).equals(colorScheme.error);
    check(
      _delta(0).color(colorScheme, semanticColors: semanticColors),
    ).equals(colorScheme.onSurfaceVariant);
  });
}

RatingDelta _delta(int displayChange) => RatingDelta(
  identity: RatingIdentity(userId: 'player', botId: null),
  pool: 'rapid',
  muBefore: 25,
  sigmaBefore: 8,
  displayBefore: 1000,
  muAfter: 26,
  sigmaAfter: 7,
  displayAfter: 1000 + displayChange,
  displayChange: displayChange,
);
