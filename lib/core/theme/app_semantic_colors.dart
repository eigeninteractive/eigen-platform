import 'package:flutter/material.dart';

/// Product-level colors for meanings that Material's [ColorScheme] does not
/// define.
///
/// Material reserves its primary, secondary, and tertiary roles for branding
/// and visual emphasis. They are therefore unsuitable for stable meanings such
/// as success, warning, and information: those meanings would change whenever
/// an app supplies a different seed. This extension keeps those roles semantic
/// while retaining paired foreground and container colors for accessible text
/// and icons.
@immutable
class AppSemanticColors extends ThemeExtension<AppSemanticColors> {
  const AppSemanticColors({
    required this.success,
    required this.onSuccess,
    required this.successContainer,
    required this.onSuccessContainer,
    required this.warning,
    required this.onWarning,
    required this.warningContainer,
    required this.onWarningContainer,
    required this.info,
    required this.onInfo,
    required this.infoContainer,
    required this.onInfoContainer,
  });

  /// Builds the semantic palette for [brightness].
  ///
  /// These values deliberately come from Flutter's named Material swatches,
  /// rather than from the app's brand seed, so their meaning remains stable
  /// across white-label apps. Every role has a corresponding `on` role.
  factory AppSemanticColors.forBrightness(
    Brightness brightness, {
    bool highContrast = false,
  }) {
    if (brightness == Brightness.dark) {
      return highContrast
          ? AppSemanticColors._highContrastDark()
          : AppSemanticColors._dark();
    }
    return highContrast
        ? AppSemanticColors._highContrastLight()
        : AppSemanticColors._light();
  }

  factory AppSemanticColors._light() => AppSemanticColors(
    success: Colors.green.shade800,
    onSuccess: Colors.white,
    successContainer: Colors.green.shade100,
    onSuccessContainer: Colors.green.shade900,
    warning: Colors.deepOrange.shade900,
    onWarning: Colors.white,
    warningContainer: Colors.deepOrange.shade50,
    onWarningContainer: Colors.deepOrange.shade900,
    info: Colors.blue.shade800,
    onInfo: Colors.white,
    infoContainer: Colors.blue.shade100,
    onInfoContainer: Colors.blue.shade900,
  );

  factory AppSemanticColors._dark() => AppSemanticColors(
    success: Colors.green.shade300,
    onSuccess: Colors.black,
    successContainer: Colors.green.shade900,
    onSuccessContainer: Colors.green.shade100,
    warning: Colors.deepOrange.shade300,
    onWarning: Colors.black,
    warningContainer: Colors.deepOrange.shade900,
    onWarningContainer: Colors.deepOrange.shade50,
    info: Colors.blue.shade300,
    onInfo: Colors.black,
    infoContainer: Colors.blue.shade900,
    onInfoContainer: Colors.blue.shade100,
  );

  factory AppSemanticColors._highContrastLight() => AppSemanticColors(
    success: Colors.green.shade900,
    onSuccess: Colors.white,
    successContainer: Colors.green.shade50,
    onSuccessContainer: Colors.black,
    warning: Colors.deepOrange.shade900,
    onWarning: Colors.white,
    warningContainer: Colors.deepOrange.shade50,
    onWarningContainer: Colors.black,
    info: Colors.blue.shade900,
    onInfo: Colors.white,
    infoContainer: Colors.blue.shade50,
    onInfoContainer: Colors.black,
  );

  factory AppSemanticColors._highContrastDark() => AppSemanticColors(
    success: Colors.green.shade100,
    onSuccess: Colors.black,
    successContainer: Colors.green.shade900,
    onSuccessContainer: Colors.white,
    warning: Colors.deepOrange.shade100,
    onWarning: Colors.black,
    warningContainer: Colors.deepOrange.shade900,
    onWarningContainer: Colors.white,
    info: Colors.blue.shade100,
    onInfo: Colors.black,
    infoContainer: Colors.blue.shade900,
    onInfoContainer: Colors.white,
  );

  /// The semantic colors from the nearest [Theme].
  static AppSemanticColors of(BuildContext context) =>
      Theme.of(context).extension<AppSemanticColors>()!;

  final Color success;
  final Color onSuccess;
  final Color successContainer;
  final Color onSuccessContainer;

  final Color warning;
  final Color onWarning;
  final Color warningContainer;
  final Color onWarningContainer;

  final Color info;
  final Color onInfo;
  final Color infoContainer;
  final Color onInfoContainer;

  @override
  AppSemanticColors copyWith({
    Color? success,
    Color? onSuccess,
    Color? successContainer,
    Color? onSuccessContainer,
    Color? warning,
    Color? onWarning,
    Color? warningContainer,
    Color? onWarningContainer,
    Color? info,
    Color? onInfo,
    Color? infoContainer,
    Color? onInfoContainer,
  }) => AppSemanticColors(
    success: success ?? this.success,
    onSuccess: onSuccess ?? this.onSuccess,
    successContainer: successContainer ?? this.successContainer,
    onSuccessContainer: onSuccessContainer ?? this.onSuccessContainer,
    warning: warning ?? this.warning,
    onWarning: onWarning ?? this.onWarning,
    warningContainer: warningContainer ?? this.warningContainer,
    onWarningContainer: onWarningContainer ?? this.onWarningContainer,
    info: info ?? this.info,
    onInfo: onInfo ?? this.onInfo,
    infoContainer: infoContainer ?? this.infoContainer,
    onInfoContainer: onInfoContainer ?? this.onInfoContainer,
  );

  @override
  AppSemanticColors lerp(covariant AppSemanticColors? other, double t) {
    if (other == null) return this;
    return AppSemanticColors(
      success: Color.lerp(success, other.success, t)!,
      onSuccess: Color.lerp(onSuccess, other.onSuccess, t)!,
      successContainer: Color.lerp(
        successContainer,
        other.successContainer,
        t,
      )!,
      onSuccessContainer: Color.lerp(
        onSuccessContainer,
        other.onSuccessContainer,
        t,
      )!,
      warning: Color.lerp(warning, other.warning, t)!,
      onWarning: Color.lerp(onWarning, other.onWarning, t)!,
      warningContainer: Color.lerp(
        warningContainer,
        other.warningContainer,
        t,
      )!,
      onWarningContainer: Color.lerp(
        onWarningContainer,
        other.onWarningContainer,
        t,
      )!,
      info: Color.lerp(info, other.info, t)!,
      onInfo: Color.lerp(onInfo, other.onInfo, t)!,
      infoContainer: Color.lerp(infoContainer, other.infoContainer, t)!,
      onInfoContainer: Color.lerp(onInfoContainer, other.onInfoContainer, t)!,
    );
  }
}
