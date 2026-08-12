import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Supplies one route-aware browser/window title above the entire router.
///
/// Stateful shell branches stay mounted while they are offstage. A [Title]
/// inside each branch therefore does not rebuild when an existing branch is
/// reselected. Listening to the router's route-information provider here keeps
/// browser tabs and Android's app switcher in sync for branch changes, pushes,
/// pops, and browser Back/Forward navigation.
class AppRouteTitle extends StatelessWidget {
  /// Creates a title that follows [router]'s current URI.
  const AppRouteTitle({
    super.key,
    required this.router,
    required this.appName,
    required this.child,
  });

  final GoRouter router;
  final String appName;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: router.routeInformationProvider,
      builder: (context, _) {
        final pageName = appPageNameForUri(
          router.routeInformationProvider.value.uri,
        );
        return Title(
          key: const ValueKey('app-route-title'),
          title: '$pageName · $appName',
          color: Theme.of(context).colorScheme.primary,
          child: child,
        );
      },
    );
  }
}

/// The stable, user-facing page name for a routed [uri].
@visibleForTesting
String appPageNameForUri(Uri uri) {
  final path = uri.path;
  if (path.endsWith('/replay') && path.startsWith('/game/')) return 'Replay';
  if (path.startsWith('/game/')) return 'Game';
  if (path.startsWith('/join/')) return 'Join game';
  if (path == '/settings/profile') return 'Profile';
  return switch (path) {
    '/' || '/home' => 'Home',
    '/login' => 'Sign in',
    '/lobby' => 'Lobby',
    '/history' => 'History',
    '/social' => 'Social',
    '/about' => 'About',
    '/settings' => 'Settings',
    _ => 'Page not found',
  };
}
