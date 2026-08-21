import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Route observers contributed by optional integration adapters.
final navigationObserversProvider = Provider<List<NavigatorObserver>>(
  (ref) => const [],
  name: 'navigationObserversProvider',
);

/// Resolves the game currently visible in the application, if any.
///
/// Notification adapters use this to suppress a foreground notification for
/// the game the player is already viewing. The reusable Flutter layer has no
/// router opinion; `eigen_shell` installs its route-aware implementation.
typedef ActiveGameIdResolver = String? Function();

final activeGameIdResolverProvider = Provider<ActiveGameIdResolver>(
  (ref) =>
      () => null,
  name: 'activeGameIdResolverProvider',
);
