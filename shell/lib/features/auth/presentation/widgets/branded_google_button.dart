import 'package:flutter/material.dart';

/// Google's pre-approved Sign in with Google button with Material interaction.
///
/// The visual asset is Google's current Android/Web pill at 2x. Flutter adds a
/// 48dp hit target, keyboard focus, hover/ripple feedback, and an accessible
/// name without recolouring or redrawing the protected Google mark.
class BrandedGoogleButton extends StatelessWidget {
  /// Creates the button.
  const BrandedGoogleButton({
    super.key,
    required this.onPressed,
    this.isLoading = false,
  });

  /// Starts the provider sign-in flow.
  final VoidCallback? onPressed;

  /// Replaces the brand image with progress while preserving its dimensions.
  final bool isLoading;

  static const _lightAsset = 'assets/google/sign_in_with_google_light_2x.png';
  static const _darkAsset = 'assets/google/sign_in_with_google_dark_2x.png';

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final enabled = onPressed != null && !isLoading;

    return Semantics(
      button: true,
      enabled: enabled,
      label: isLoading ? 'Signing in with Google' : 'Sign in with Google',
      onTap: enabled ? onPressed : null,
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: enabled ? onPressed : null,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 180, minHeight: 48),
            child: Center(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: isLoading
                    ? const SizedBox(
                        key: ValueKey('google-sign-in-progress'),
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Ink.image(
                        key: ValueKey(isDark),
                        image: AssetImage(
                          isDark ? _darkAsset : _lightAsset,
                          package: 'eigen_shell',
                        ),
                        width: 180,
                        height: 40,
                        fit: BoxFit.contain,
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
