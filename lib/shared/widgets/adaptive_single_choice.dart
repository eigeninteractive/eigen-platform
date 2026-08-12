import 'package:flutter/material.dart';

/// One labelled value rendered by [AdaptiveSingleChoice].
@immutable
class AdaptiveChoice<T> {
  /// Creates a choice with optional leading [icon].
  const AdaptiveChoice({
    required this.value,
    required this.label,
    this.icon,
    this.enabled = true,
  });

  /// Value reported when this choice is selected.
  final T value;

  /// Short, user-facing label.
  final String label;

  /// Optional icon shared by the segmented and menu presentations.
  final IconData? icon;

  /// Whether this individual choice can be selected.
  final bool enabled;
}

/// Uses segments when they fit and a Material 3 menu when they do not.
///
/// [SegmentedButton] is most effective for two to five short, simultaneously
/// visible choices. A whitelabel game can supply more or longer choices, so the
/// control falls back to [DropdownMenu] before overflowing its available width.
class AdaptiveSingleChoice<T> extends StatelessWidget {
  /// Creates a width-aware, single-selection Material control.
  const AdaptiveSingleChoice({
    super.key,
    required this.choices,
    required this.value,
    required this.onChanged,
    this.enabled = true,
    this.label,
    this.minimumSegmentWidth = 88,
  }) : assert(choices.length > 1);

  /// Available choices in display order.
  final List<AdaptiveChoice<T>> choices;

  /// Currently selected value.
  final T value;

  /// Called when a different enabled choice is selected.
  final ValueChanged<T> onChanged;

  /// Whether the control accepts input.
  final bool enabled;

  /// Optional field label used by the menu presentation.
  final String? label;

  /// Estimated minimum width per segment before switching to a menu.
  final double minimumSegmentWidth;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final availableWidth = constraints.maxWidth;
        final segmentWidth = choices.length * minimumSegmentWidth;
        final segmentsFit =
            choices.length <= 5 &&
            (!availableWidth.isFinite || availableWidth >= segmentWidth);

        if (segmentsFit) {
          return SegmentedButton<T>(
            showSelectedIcon: false,
            segments: [
              for (final choice in choices)
                ButtonSegment<T>(
                  value: choice.value,
                  label: Text(choice.label),
                  icon: choice.icon == null ? null : Icon(choice.icon),
                  enabled: enabled && choice.enabled,
                ),
            ],
            selected: {value},
            onSelectionChanged: enabled
                ? (selection) => onChanged(selection.first)
                : null,
          );
        }

        return DropdownMenu<T>(
          key: ValueKey(value),
          initialSelection: value,
          enabled: enabled,
          expandedInsets: EdgeInsets.zero,
          label: label == null ? null : Text(label!),
          dropdownMenuEntries: [
            for (final choice in choices)
              DropdownMenuEntry<T>(
                value: choice.value,
                label: choice.label,
                enabled: choice.enabled,
                leadingIcon: choice.icon == null ? null : Icon(choice.icon),
              ),
          ],
          onSelected: (selection) {
            if (selection != null) onChanged(selection);
          },
        );
      },
    );
  }
}
