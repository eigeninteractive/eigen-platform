import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:eigen_flutter/core/config/app_config.dart';
import 'package:eigen_flutter/core/adaptive/adaptive_layout.dart';
import 'package:eigen_flutter/core/errors/error_messages.dart';
import 'package:eigen_flutter/core/utils/deep_links.dart';
import 'package:eigen_flutter/features/auth/providers/auth_providers.dart';
import 'package:eigen_flutter/features/auth/presentation/widgets/branded_google_button.dart';
import 'package:url_launcher/link.dart';

/// Login screen with Google Sign-In
class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appName = ref.watch(appConfigProvider).branding.appName;
    final appHost = ref.watch(appConfigProvider).engine.appHost;
    return Scaffold(
      body: SafeArea(
        child: ConstrainedContentPane(
          maxWidth: 480,
          alignment: Alignment.center,
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // App logo/icon
                Icon(
                  Icons.games_outlined,
                  size: 80,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(height: 24),

                // Welcome text
                Text(
                  'Welcome to $appName',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),

                Text(
                  'Sign in to continue',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 48),

                // Google Sign-In Card
                Card(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          'Get Started',
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(
                                color: Theme.of(context).colorScheme.onSurface,
                              ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 24),

                        // Google Sign-In Button
                        const GoogleSignInButton(),
                        const SizedBox(height: 12),
                        const PlayAsGuestButton(),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Terms and privacy are real links when the app host exists.
                Wrap(
                  alignment: WrapAlignment.center,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      'By signing in, you agree to our ',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    _LegalLink(
                      label: 'Terms of Service',
                      uri: legalPageUrl('/terms', appHost: appHost),
                    ),
                    Text(
                      ' and ',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    _LegalLink(
                      label: 'Privacy Policy',
                      uri: legalPageUrl('/privacy', appHost: appHost),
                    ),
                    Text(
                      '.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Google Sign-In button that crossfades to a spinner while signing in.
class GoogleSignInButton extends ConsumerWidget {
  const GoogleSignInButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(authControllerProvider, (_, next) {
      next.whenOrNull(
        error: (error, _) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(humanize(error))));
        },
      );
    });

    final isLoading = ref.watch(
      authControllerProvider.select((state) => state.isLoading),
    );

    return BrandedGoogleButton(
      isLoading: isLoading,
      onPressed: isLoading
          ? null
          : () => ref.read(authControllerProvider.notifier).signInWithGoogle(),
    );
  }
}

/// Lets a visitor try the app without an account by starting an anonymous
/// (guest) session. Disabled while any auth operation is in flight.
class PlayAsGuestButton extends ConsumerWidget {
  const PlayAsGuestButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isLoading = ref.watch(
      authControllerProvider.select((state) => state.isLoading),
    );

    return TextButton(
      onPressed: isLoading
          ? null
          : () => ref.read(authControllerProvider.notifier).signInAnonymously(),
      child: const Text('Play as guest'),
    );
  }
}

class _LegalLink extends StatelessWidget {
  const _LegalLink({required this.label, required this.uri});

  final String label;
  final Uri? uri;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodySmall?.copyWith(
      color: uri == null
          ? Theme.of(context).colorScheme.onSurfaceVariant
          : Theme.of(context).colorScheme.primary,
      decoration: uri == null ? null : TextDecoration.underline,
      decorationColor: Theme.of(context).colorScheme.primary,
    );
    if (uri == null) return Text(label, style: style);

    return Link(
      uri: uri,
      target: LinkTarget.blank,
      builder: (context, followLink) => Semantics(
        link: true,
        linkUrl: uri,
        label: label,
        enabled: followLink != null,
        onTap: followLink,
        excludeSemantics: true,
        child: TextButton(
          onPressed: followLink,
          style: TextButton.styleFrom(
            minimumSize: const Size(48, 48),
            padding: const EdgeInsets.symmetric(horizontal: 2),
          ),
          child: Text(label, style: style),
        ),
      ),
    );
  }
}
