import 'dart:math' as math;

import 'package:checks/checks.dart';
import 'package:eigen_flutter/core/theme/app_semantic_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final variants = <String, AppSemanticColors>{
    'light': AppSemanticColors.forBrightness(Brightness.light),
    'dark': AppSemanticColors.forBrightness(Brightness.dark),
    'high-contrast light': AppSemanticColors.forBrightness(
      Brightness.light,
      highContrast: true,
    ),
    'high-contrast dark': AppSemanticColors.forBrightness(
      Brightness.dark,
      highContrast: true,
    ),
  };

  for (final entry in variants.entries) {
    test('${entry.key} pairs meet normal text contrast', () {
      final colors = entry.value;
      final pairs = <(Color, Color)>[
        (colors.success, colors.onSuccess),
        (colors.successContainer, colors.onSuccessContainer),
        (colors.warning, colors.onWarning),
        (colors.warningContainer, colors.onWarningContainer),
        (colors.info, colors.onInfo),
        (colors.infoContainer, colors.onInfoContainer),
      ];

      for (final (background, foreground) in pairs) {
        check(_contrastRatio(background, foreground)).isGreaterThan(4.49);
      }
    });
  }

  test('high-contrast palettes strengthen the light semantic containers', () {
    final normal = variants['light']!;
    final highContrast = variants['high-contrast light']!;

    check(
      _contrastRatio(
        highContrast.successContainer,
        highContrast.onSuccessContainer,
      ),
    ).isGreaterThan(
      _contrastRatio(normal.successContainer, normal.onSuccessContainer),
    );
    check(
      _contrastRatio(
        highContrast.warningContainer,
        highContrast.onWarningContainer,
      ),
    ).isGreaterThan(
      _contrastRatio(normal.warningContainer, normal.onWarningContainer),
    );
    check(
      _contrastRatio(highContrast.infoContainer, highContrast.onInfoContainer),
    ).isGreaterThan(
      _contrastRatio(normal.infoContainer, normal.onInfoContainer),
    );
  });

  test('copyWith and lerp retain the ThemeExtension contract', () {
    final light = variants['light']!;
    final dark = variants['dark']!;

    check(light.copyWith(success: Colors.pink).success).equals(Colors.pink);
    check(light.lerp(dark, 0).success).equals(light.success);
    check(light.lerp(dark, 1).success).equals(dark.success);
  });
}

double _contrastRatio(Color a, Color b) {
  final aLuminance = a.computeLuminance();
  final bLuminance = b.computeLuminance();
  return (math.max(aLuminance, bLuminance) + 0.05) /
      (math.min(aLuminance, bLuminance) + 0.05);
}
