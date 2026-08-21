import 'package:eigen_flutter/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'app_config.g.dart';

/// Whitelabel configuration for one game app built on the engine.
///
/// The single composition-root config object, set once via [appConfigProvider]
/// by the application's composition root. It groups the app's configurable concerns by
/// responsibility:
///
/// - [branding]: user-facing identity (name, theme seed).
/// - [engine]: Eigen server and app-host values the framework needs.
///
/// Keeping each concern as its own value object is what stops this from
/// decaying into a junk drawer of unrelated flags. A consuming app reads its
/// public build-time values from Dart compilation environment declarations and
/// passes them in here, so the framework remains independent of how the app is
/// built.
@immutable
class AppConfig {
  const AppConfig({required this.branding, required this.engine});

  /// User-facing identity: app name and theme seed color.
  final Branding branding;

  /// Backend and integration values the framework needs at runtime.
  final EngineConfig engine;
}

/// Runtime configuration the framework needs to talk to its backends.
///
/// These are public deployment values, not secrets. A scaffolded app supplies
/// them with `--dart-define-from-file=app-config.json` and injects them at the
/// composition root.
@immutable
class EngineConfig {
  const EngineConfig({required this.apiBaseUrl, this.appHost});

  /// Origin of the EigenInteractive server, with no trailing slash and no
  /// path, for example `https://api.example.com`.
  ///
  /// Only the origin: every generated route already carries the `/api/engine`
  /// prefix, and the game socket is built from this same origin with the scheme
  /// swapped to `ws`/`wss`.
  final String apiBaseUrl;

  /// The game's public host, e.g. `strategy.eigeninteractive.com` or a
  /// customer's own domain; null disables the features built on it.
  ///
  /// One host serves everything: the app's deep links (`/join/:code`,
  /// `/game/:id`), and, when the worker has `site` configured, the legal
  /// pages and landing page. The App Links intent-filter is scoped to the
  /// deep-link prefixes, so legal URLs on this same host open in the browser
  /// rather than being intercepted.
  final String? appHost;

  /// Validates the deployment values before any engine service starts.
  ///
  /// Invalid values throw one [StateError] listing every problem and the
  /// scaffold's standard configuration command.
  void validate() {
    final errors = <String>[];
    final workerOrigin = Uri.tryParse(apiBaseUrl);
    if (_isUnset(apiBaseUrl)) {
      errors.add('API_BASE_URL is required');
    } else if (workerOrigin == null ||
        !workerOrigin.hasAuthority ||
        !const {'http', 'https'}.contains(workerOrigin.scheme) ||
        workerOrigin.host.isEmpty ||
        workerOrigin.userInfo.isNotEmpty ||
        workerOrigin.path.isNotEmpty ||
        workerOrigin.hasQuery ||
        workerOrigin.hasFragment) {
      errors.add(
        'API_BASE_URL must be an HTTP(S) origin with no path, query, '
        'fragment, credentials, or trailing slash',
      );
    }

    final host = appHost;
    if (host != null && !_isValidHost(host)) {
      errors.add('APP_HOST must be a hostname without a scheme, port, or path');
    }

    if (errors.isEmpty) return;
    throw StateError(
      'Invalid EigenInteractive app configuration:\n'
      '${errors.map((error) => '- $error').join('\n')}\n'
      'Set these public values in app-config.json and run or build with '
      '--dart-define-from-file=app-config.json.',
    );
  }
}

bool _isUnset(String value) =>
    value.trim().isEmpty || value.contains('REPLACE_ME');

bool _isValidHost(String value) {
  if (_isUnset(value) || value != value.trim()) return false;
  final uri = Uri.tryParse('https://$value');
  return uri != null &&
      uri.host == value &&
      uri.path.isEmpty &&
      !uri.hasQuery &&
      !uri.hasFragment;
}

/// User-facing identity for the app shell.
///
/// Everything brandable from Dart: the name shown in the window title, drawer
/// header and login screen, and the Material 3 seed color the entire theme is
/// derived from. (App icon, splash screen and store assets are platform files
/// configured outside Dart.)
@immutable
class Branding {
  const Branding({
    required this.appName,
    this.seedColor = Colors.teal,
    this.displayFontFamily = AppTheme.spaceGrotesk,
    this.madeByCredit = 'Built with EigenInteractive',
  });

  /// User-facing application name (window title, drawer header, login screen).
  final String appName;

  /// Material 3 seed color; the full light/dark [ColorScheme] derives from it.
  ///
  /// Defaults to the EigenInteractive teal, so a game looks deliberate before
  /// anyone has thought about colour. Replace it with one line, and note that
  /// Material 3 treats a seed as a *hue*, not a colour: it pulls whatever you
  /// give it to tone 40 and rebuilds the ramp, so neighbouring greens all
  /// arrive at much the same scheme, and a near-black seed comes back
  /// chromatic rather than neutral.
  final Color seedColor;

  /// Family for the display and headline text roles.
  ///
  /// Defaults to the EigenInteractive display face, Space Grotesk, bundled by
  /// this package. Pass [AppTheme.inter] for a single-face app, or the
  /// package-qualified family of a font your own app bundles.
  final String displayFontFamily;

  /// Credit line shown in the settings and about footers. Defaults to the
  /// EigenInteractive umbrella credit, the same line the game's own website
  /// ends on; override per app if needed.
  ///
  /// Whichever part of the line reads `EigenInteractive` is rendered as a link
  /// to it, and nothing else is, so a replacement that never names the engine
  /// is plain text.
  final String madeByCredit;
}

/// The active [AppConfig].
///
/// `EigenFlutterScope` registers the config for normal apps. Widget tests that
/// construct their own `ProviderScope` can override it directly:
/// ```dart
/// const apiBaseUrl = String.fromEnvironment('API_BASE_URL');
///
/// appConfigProvider.overrideWithValue(
///   AppConfig(
///     branding: const Branding(
///       appName: 'Tic Tac Toe',
///       seedColor: Colors.deepPurple,
///     ),
///     engine: EngineConfig(
///       apiBaseUrl: apiBaseUrl,
///     ),
///   ),
/// )
/// ```
/// Throws [UnimplementedError] at startup if no override is provided.
@Riverpod(keepAlive: true)
AppConfig appConfig(Ref ref) => throw UnimplementedError(
  'No AppConfig registered. '
  'Add appConfigProvider.overrideWithValue(...) to ProviderScope.',
);
