import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:eigen_flutter/core/api/retry_policy.dart';
import 'package:eigen_flutter/core/config/app_config.dart';
import 'package:eigen_flutter/core/game/game_module.dart';
import 'package:eigen_flutter/core/licenses/bundled_font_licenses.dart';
import 'package:eigen_flutter/core/navigation/providers/navigation_providers.dart';
import 'package:eigen_flutter/core/navigation/widgets/app_route_title.dart';
import 'package:eigen_flutter/core/navigation/url_strategy.dart';
import 'package:eigen_flutter/core/startup/app_startup.dart';
import 'package:eigen_flutter/core/theme/app_theme.dart';
import 'package:eigen_flutter/core/theme/theme_provider.dart';
import 'package:eigen_flutter/features/game/providers/game_providers.dart';

SemanticsHandle? _webSemanticsHandle;

/// Installs optional platform integrations before the Riverpod root exists.
///
/// An adapter initializes its SDK and returns only the provider overrides that
/// connect it to the provider-neutral Flutter package.
typedef EngineAdapterInitializer = Future<List<Override>> Function();

/// Boots a whitelabel game app on the engine.
///
/// This is the framework's "app as a library" entry point: each game app's
/// `main()` is a call to this with its [module] and [config]. Optional identity,
/// telemetry, and push packages connect through [initializeAdapter], keeping
/// this package independent of any particular provider.
Future<void> runEngineApp({
  required GameModule module,
  required AppConfig config,
  EngineAdapterInitializer? initializeAdapter,
}) async {
  config.engine.validate();

  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  if (kIsWeb) {
    // Flutter web otherwise waits for its invisible opt-in control before
    // exposing the semantics tree. Keep the handle alive for the application
    // lifetime so browser assistive technology works from the first frame.
    _webSemanticsHandle ??= SemanticsBinding.instance.ensureSemantics();
  }
  registerBundledFontLicenses();
  configureUrlStrategy();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);
  late final List<Override> adapterOverrides;
  try {
    adapterOverrides = await initializeAdapter?.call() ?? const <Override>[];
  } catch (_) {
    // Do not leave a preserved native splash pinned over an initialization
    // failure. The zone/platform error surface can now report the real cause.
    FlutterNativeSplash.remove();
    rethrow;
  }

  runApp(
    ProviderScope(
      // Narrows Riverpod's over-eager default retry to transport failures only
      // A server-reported error is never re-run. See [engineProviderRetry].
      retry: engineProviderRetry,
      overrides: [
        currentGameModuleProvider.overrideWithValue(module),
        appConfigProvider.overrideWithValue(config),
        ...adapterOverrides,
      ],
      child: const AppStartup(child: MyApp()),
    ),
  );
}

/// Root application widget shared by every game built on the engine.
///
/// Reads the active [Branding] from [appConfigProvider] so the title and theme
/// follow whichever app registered the config.
class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(goRouterProvider);
    final themeAsync = ref.watch(themeControllerProvider);
    final themeMode = themeAsync.value ?? ThemeMode.system;
    final branding = ref.watch(appConfigProvider).branding;

    return MaterialApp.router(
      title: branding.appName,
      theme: AppTheme.light(
        branding.seedColor,
        display: branding.displayFontFamily,
      ),
      darkTheme: AppTheme.dark(
        branding.seedColor,
        display: branding.displayFontFamily,
      ),
      highContrastTheme: AppTheme.highContrastLight(
        branding.seedColor,
        display: branding.displayFontFamily,
      ),
      highContrastDarkTheme: AppTheme.highContrastDark(
        branding.seedColor,
        display: branding.displayFontFamily,
      ),
      themeMode: themeMode,
      routerConfig: router,
      builder: (context, child) => AppRouteTitle(
        router: router,
        appName: branding.appName,
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
