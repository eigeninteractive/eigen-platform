import 'package:eigen_flutter/core/api/retry_policy.dart';
import 'package:eigen_flutter/core/config/app_config.dart';
import 'package:eigen_flutter/core/game/game_module.dart';
import 'package:eigen_flutter/features/game/providers/game_providers.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

/// Installs Eigen's reusable Flutter state beneath an application-owned root.
///
/// This widget deliberately does not create a [WidgetsApp] or `MaterialApp`.
/// Embedding applications retain ownership of routing, localization, theme,
/// and lifecycle policy; the optional `eigen_shell` package supplies the
/// first-party choices for applications that want them.
class EigenFlutterScope extends StatelessWidget {
  const EigenFlutterScope({
    super.key,
    required this.module,
    required this.config,
    required this.child,
    this.adapterOverrides = const [],
  });

  final GameModule module;
  final AppConfig config;
  final Widget child;
  final List<Override> adapterOverrides;

  @override
  Widget build(BuildContext context) {
    config.engine.validate();
    return ProviderScope(
      retry: engineProviderRetry,
      overrides: [
        currentGameModuleProvider.overrideWithValue(module),
        appConfigProvider.overrideWithValue(config),
        ...adapterOverrides,
      ],
      child: child,
    );
  }
}
