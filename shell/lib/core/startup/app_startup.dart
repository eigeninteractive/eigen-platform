import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter/material.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/core/navigation/router/app_router.dart';
import 'package:eigen_shell/core/updates/update_notifier.dart';
import 'package:eigen_shell/features/profile/providers/profile_providers.dart';
import 'package:eigen_shell/features/social/providers/social_providers.dart';

/// Keeps the native splash screen visible until the auth state is known,
/// then hands control to [child] (which GoRouter routes normally).
class AppStartup extends ConsumerStatefulWidget {
  const AppStartup({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<AppStartup> createState() => _AppStartupState();
}

class _AppStartupState extends ConsumerState<AppStartup> {
  late final AppLifecycleListener _lifecycleListener;
  late final ProviderSubscription<AsyncValue<AuthStateChange>> _authSub;
  StreamSubscription<String>? _notificationSub;

  @override
  void initState() {
    super.initState();
    _authSub = ref.listenManual(authStateChangesProvider, _onAuthStateChange);
    unawaited(_removeNativeSplashWhenReady());
    unawaited(ref.read(updateProvider.notifier).checkForUpdate());
    _lifecycleListener = AppLifecycleListener(
      onResume: () {
        ref.read(updateProvider.notifier).checkForUpdate();
        // Reconcile permission and FCM registration in case the user changed
        // notification access in system/browser settings while we were away.
        unawaited(_syncNotifications());
        ref.invalidate(notificationPermissionStatusProvider);
        // Coming back from a provider's checkout page is a resume on Android
        // and iOS, and a cold start on the web -- hence both here and below.
        unawaited(_claimHostedCheckoutReturn());
      },
    );
    unawaited(_initNotifications());
    unawaited(_claimHostedCheckoutReturn());
  }

  /// The last URL already offered to the storefronts, so a resume that changed
  /// nothing does not re-claim a purchase already claimed.
  Uri? _lastCheckoutReturn;

  /// Offers the URL the app is sitting at to every hosted storefront.
  ///
  /// A provider-hosted checkout leaves the app and comes back through a return
  /// URL: on the web that unloads the page entirely, so the return is an
  /// ordinary cold start, and on Android and iOS it is an App Link delivered to
  /// the router. Neither is something the purchase call could have awaited, so
  /// this is where a completed hosted purchase is noticed at all.
  ///
  /// Silent for a build that carries no hosted storefront, and deliberately
  /// short-circuited before reading `commerceServiceProvider` at all, so a game
  /// that sells nothing does not open a local database to find that out.
  Future<void> _claimHostedCheckoutReturn() async {
    if (!mounted) return;
    if (ref.read(storefrontsProvider).whereType<HostedStorefront>().isEmpty) {
      return;
    }
    // `Uri.base` is the page on the web; on a device the App Link arrives as a
    // route, so the router knows where a deep link actually put us.
    final router = GoRouter.maybeOf(context);
    final routed = router?.routeInformationProvider.value.uri;
    for (final uri in <Uri?>{Uri.base, routed}) {
      if (uri == null || uri == _lastCheckoutReturn) continue;
      try {
        if (await ref.read(commerceServiceProvider).resumeFrom(uri)) {
          _lastCheckoutReturn = uri;
          return;
        }
      } catch (e, stack) {
        developer.log(
          'Hosted checkout return could not be claimed',
          name: 'app.startup',
          error: e,
          stackTrace: stack,
        );
      }
    }
  }

  Future<void> _syncNotifications() async {
    try {
      await ref
          .read(notificationServiceProvider)
          .syncPermissionAndRegistration();
    } catch (e, stack) {
      developer.log(
        'Notification registration sync failed',
        name: 'app.startup',
        error: e,
        stackTrace: stack,
      );
    }
  }

  /// Registers the navigation listener BEFORE initialize() so that the
  /// initial-message path (terminated-state tap) is never missed.
  Future<void> _initNotifications() async {
    final service = ref.read(notificationServiceProvider);
    _notificationSub = service.navigationStream.listen(
      _onNotificationNavigation,
    );
    try {
      await service.initialize();
    } catch (e, stack) {
      developer.log(
        'Notification service initialization failed',
        name: 'app.startup',
        error: e,
        stackTrace: stack,
      );
    }
  }

  @override
  void dispose() {
    _authSub.close();
    _notificationSub?.cancel();
    _lifecycleListener.dispose();
    super.dispose();
  }

  Future<void> _removeNativeSplashWhenReady() async {
    try {
      final authState = await ref.read(authStateChangesProvider.future);
      // If authenticated, wait for the profile cache to restore before
      // revealing the home screen. Cap at 2 s so this only triggers when
      // there is no local cache AND no network.
      if (authState.user != null) {
        await ref
            .read(currentUserProfileProvider.future)
            .timeout(const Duration(seconds: 2));
      }
    } catch (e, stack) {
      developer.log(
        'Startup initialization failed',
        name: 'app.startup',
        error: e,
        stackTrace: stack,
      );
    } finally {
      FlutterNativeSplash.remove();
    }
  }

  void _onAuthStateChange(
    AsyncValue<AuthStateChange>? _,
    AsyncValue<AuthStateChange> next,
  ) {
    next.whenOrNull(
      data: (authState) {
        final analytics = ref.read(analyticsServiceProvider);
        switch (authState.event) {
          case AuthEvent.signedIn:
            if (authState.user case final user?) {
              unawaited(analytics.identify(user.id));
              // Segment all metrics by guest vs registered. Conversion later
              // re-tags to registered from AuthController.upgradeToGoogle.
              unawaited(analytics.setAccountType(isGuest: user.isAnonymous));
              // Register this install for push under the now-signed-in user.
              // Driven here (not in the service's one-time initialize) so an
              // in-session sign-in or account switch re-registers the new user.
              unawaited(
                ref.read(notificationServiceProvider).registerInstallation(),
              );
              // Fire-and-forget: starts the local cache restore + network
              // fetch before any screen renders. keepAlive ensures the result
              // is reused by all subsequent watchers.
              ref.read(currentUserProfileProvider.future).ignore();
              // Warm the bot catalog the same way. The shell only watches it
              // when the build ships local bots (localBots.isNotEmpty short-
              // circuit), so this is what readies it for the server-bots-only
              // path (the waiting-room "Add bot" picker) before it is opened.
              ref.read(availableBotsProvider.future).ignore();
            }
          case AuthEvent.signedOut:
            unawaited(analytics.reset());
          case AuthEvent.userUpdated:
            break;
        }
      },
    );
  }

  void _onNotificationNavigation(String path) {
    final context = rootNavigatorKey.currentContext;
    if (context == null) return;
    if (path.startsWith('/social')) {
      ref.invalidate(friendsProvider);
    }
    GoRouter.of(context).navigateFromNotification(path);
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
