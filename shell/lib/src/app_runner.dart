import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/core/navigation/providers/navigation_providers.dart';
import 'package:eigen_shell/core/navigation/widgets/app_route_title.dart';
import 'package:eigen_shell/core/navigation/url_strategy.dart';
import 'package:eigen_shell/core/startup/app_startup.dart';
import 'package:eigen_shell/core/theme/theme_provider.dart';

SemanticsHandle? _webSemanticsHandle;

/// Installs optional platform integrations before the Riverpod root exists.
///
/// An adapter initializes its SDK and returns only the provider overrides that
/// connect it to the provider-neutral Flutter package.
typedef EigenAdapterInitializer = Future<List<Override>> Function();

/// Boots a whitelabel game app on the engine.
///
/// This is the framework's "app as a library" entry point: each game app's
/// `main()` is a call to this with its [module] and [config]. Optional identity,
/// telemetry, and push packages connect through [initializeAdapter], keeping
/// this package independent of any particular provider.
Future<void> runEigenShell({
  required GameModule module,
  required AppConfig config,
  EigenAdapterInitializer? initializeAdapter,
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
    EigenFlutterScope(
      module: module,
      config: config,
      adapterOverrides: [
        ...adapterOverrides,
        activeGameIdResolverProvider.overrideWith(
          (ref) => () {
            final uri = ref
                .read(goRouterProvider)
                .routerDelegate
                .currentConfiguration
                .uri;
            final segments = uri.pathSegments;
            return segments.length == 2 && segments.first == 'game'
                ? segments[1]
                : null;
          },
        ),
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
        child: _ReplicaGate(child: child ?? const SizedBox.shrink()),
      ),
    );
  }
}

/// Stops the app where the browser gives it nowhere to keep its data.
///
/// Another tab of the app may hold the replica in a browser where sharing it
/// between tabs is unsafe, and this tab then opens nothing, says so, and opens
/// once that tab closes. A browser that keeps nothing across a reload runs the
/// app normally, minus local play, and says that too (decisions 0013 and 0014).
/// Native always persists, so this renders its child.
class _ReplicaGate extends ConsumerWidget {
  const _ReplicaGate({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final storage = ref.watch(replicaStorageProvider).value;
    final colorScheme = Theme.of(context).colorScheme;
    return switch (storage) {
      ReplicaStorage.heldElsewhere => Scaffold(
        body: EmptyStateView(
          icon: Icons.tab_outlined,
          title: 'Open in another tab',
          message:
              'This browser can only use the app in one tab at a time. '
              'It opens here as soon as the other tab is closed.',
        ),
      ),
      ReplicaStorage.ephemeral => Column(
        children: [
          SafeArea(
            bottom: false,
            child: StatusBanner(
              leading: Icon(
                Icons.info_outline,
                size: 16,
                color: colorScheme.onSurfaceVariant,
              ),
              label: "This browser isn't saving data, so offline play is off",
              backgroundColor: colorScheme.surfaceContainerHigh,
              foregroundColor: colorScheme.onSurfaceVariant,
            ),
          ),
          Expanded(child: child),
        ],
      ),
      _ => child,
    };
  }
}
