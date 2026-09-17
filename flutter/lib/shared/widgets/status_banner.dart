import 'dart:ui' show SemanticsRole;

import 'package:flutter/material.dart';

/// A full-width slim banner for surfacing system-level status (e.g. offline,
/// reconnecting). Sits outside [SafeArea] so it bleeds edge-to-edge.
class StatusBanner extends StatelessWidget {
  const StatusBanner({
    super.key,
    required this.leading,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
    this.trailing,
  });

  final Widget leading;
  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  /// An action the banner offers, at its end. A banner that only reports
  /// something has none.
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      role: SemanticsRole.status,
      label: label,
      excludeSemantics: true,
      child: Container(
        width: double.infinity,
        color: backgroundColor,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            leading,
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: foregroundColor),
              ),
            ),
            if (trailing case final action?) ...[
              const SizedBox(width: 8),
              action,
            ],
          ],
        ),
      ),
    );
  }
}
