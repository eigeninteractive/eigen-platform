// Dartdoc selects the two supported package entry points by library name.
// ignore_for_file: unnecessary_library_name

/// EigenInteractive: a whitelabel turn-based multiplayer game engine.
///
/// A game app depends on this package, implements a [GameModule], and boots
/// with [runEngineApp]:
///
/// ```dart
/// import 'package:eigen_flutter/eigen_flutter.dart';
///
/// Future<void> main() => runEngineApp(
///   module: const MyGameModule(),
///   config: appConfig,
/// );
/// ```
///
/// This library is the supported app import. It exposes the entry point,
/// composition-root configuration, game contract, wire vocabulary, and shared
/// game UI without exposing the app shell's repositories or transport.
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

export 'app_runner.dart' show EngineAdapterInitializer, runEngineApp, MyApp;

export 'core/config/app_config.dart'
    show AppConfig, Branding, EngineConfig, appConfigProvider;
export 'core/game/game_module.dart';
export 'features/auth/domain/auth_gateway.dart';
export 'features/auth/domain/auth_user.dart';
export 'features/game/providers/game_providers.dart'
    show currentGameModuleProvider;
export 'features/game/presentation/widgets/timer_builders.dart'
    show PlayerTimerBuilder, TurnTimerBuilder;

/// Shared UI a game composes with. Seat rendering in particular belongs here:
/// avatar URLs may be relative to the API host, and routing every avatar
/// through this widget is what keeps that resolution in one place.
export 'shared/widgets/player_avatar.dart' show PlayerAvatar;
export 'shared/widgets/player_tags.dart';
