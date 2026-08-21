// Dartdoc selects the two supported package entry points by library name.
// ignore_for_file: unnecessary_library_name

/// Reusable Flutter integration for EigenInteractive game applications.
///
/// A game app depends on this package and implements a [GameModule]. It can
/// install [EigenFlutterScope] beneath its own application root or use the
/// opinionated `eigen_shell` package for the complete first-party product.
///
/// ```dart
/// import 'package:eigen_flutter/eigen_flutter.dart';
///
/// EigenFlutterScope(
///   module: const MyGameModule(),
///   config: appConfig,
///   child: const MaterialApp(home: MyHome()),
/// );
/// ```
///
/// This is the supported game-facing import. It exposes the embeddable scope,
/// configuration, game contract, wire vocabulary, and shared game UI without
/// taking ownership of routing or a root application widget.
///
/// Start with the
/// [EigenInteractive quickstart](https://eigeninteractive.com/docs/getting-started/quickstart)
/// and use the
/// [task guides](https://eigeninteractive.com/docs/build-a-game/the-contract)
/// for end-to-end TypeScript and Dart examples.
library eigen_flutter;

/// The pure Dart client and wire vocabulary a game renders from.
///
/// `eigen_client` deliberately exports models and client-domain types without
/// the generated `*Api` classes, so Flutter presentation can expose the useful
/// vocabulary without exposing raw HTTP capabilities.
export 'package:eigen_client/eigen_client.dart';

export 'composition.dart' show EigenFlutterScope;

export 'core/config/app_config.dart'
    show AppConfig, Branding, EngineConfig, appConfigProvider;
export 'core/game/game_module.dart';
export 'features/auth/domain/auth_gateway.dart';
export 'features/auth/domain/auth_user.dart';
export 'features/game/providers/game_providers.dart'
    show currentGameModuleProvider;
export 'features/game/presentation/widgets/timer_builders.dart'
    show PlayerTimerBuilder, TurnTimerBuilder;
export 'core/theme/app_theme.dart' show AppTheme;

/// Shared UI a game composes with. Seat rendering in particular belongs here:
/// avatar URLs may be relative to the API host, and routing every avatar
/// through this widget is what keeps that resolution in one place.
export 'shared/widgets/player_avatar.dart' show PlayerAvatar;
export 'shared/widgets/player_tags.dart';
