import 'package:flutter/material.dart';

/// Material window width classes derived from the space available to a widget.
enum AppWindowClass {
  compact,
  medium,
  expanded,
  large,
  extraLarge;

  /// Classifies a logical-pixel [width] using the Material window breakpoints.
  static AppWindowClass fromWidth(double width) => switch (width) {
    < 600 => compact,
    < 840 => medium,
    < 1200 => expanded,
    < 1600 => large,
    _ => extraLarge,
  };

  bool get isCompact => this == compact;

  bool get isAtLeastMedium => index >= medium.index;

  bool get isAtLeastExpanded => index >= expanded.index;
}

/// Builds from local layout constraints and their Material window width class.
class AdaptiveLayoutBuilder extends StatelessWidget {
  const AdaptiveLayoutBuilder({required this.builder, super.key});

  final Widget Function(
    BuildContext context,
    BoxConstraints constraints,
    AppWindowClass windowClass,
  )
  builder;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => builder(
        context,
        constraints,
        AppWindowClass.fromWidth(constraints.maxWidth),
      ),
    );
  }
}

/// Centers a child and prevents readable content from stretching indefinitely.
///
/// This widget deliberately does not add padding: scrollable children should
/// own their padding so scroll bars and overscroll effects stay at the pane's
/// edge, while fixed content can add padding inside the pane.
class ConstrainedContentPane extends StatelessWidget {
  const ConstrainedContentPane({
    required this.child,
    required this.maxWidth,
    this.alignment = Alignment.topCenter,
    super.key,
  });

  final Widget child;
  final double maxWidth;
  final AlignmentGeometry alignment;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: SizedBox(width: double.infinity, child: child),
      ),
    );
  }
}

/// A max-extent grid delegate that stays single-column below [twoColumnWidth].
///
/// The switch is based on this grid's actual width, not a device or platform.
/// Above the threshold, [maxCrossAxisExtent] lets additional columns appear as
/// the window grows instead of hard-coding a column count.
SliverGridDelegate responsiveCardGridDelegate({
  required double availableWidth,
  required double maxCrossAxisExtent,
  required double mainAxisExtent,
  double twoColumnWidth = 840,
  double spacing = 12,
}) {
  return SliverGridDelegateWithMaxCrossAxisExtent(
    maxCrossAxisExtent: availableWidth < twoColumnWidth
        ? availableWidth
        : maxCrossAxisExtent,
    mainAxisExtent: mainAxisExtent,
    mainAxisSpacing: spacing,
    crossAxisSpacing: spacing,
  );
}

/// Whether fixed-height cards have enough room to use a multi-column grid.
///
/// At larger accessibility text sizes, cards return to an intrinsically sized
/// list so text can reflow vertically without being clipped by a grid extent.
bool shouldUseCardGrid({
  required AppWindowClass windowClass,
  required TextScaler textScaler,
  double maximumTextScale = 1.2,
}) {
  const referenceFontSize = 16.0;
  final effectiveScale =
      textScaler.scale(referenceFontSize) / referenceFontSize;
  return windowClass.isAtLeastExpanded && effectiveScale <= maximumTextScale;
}
