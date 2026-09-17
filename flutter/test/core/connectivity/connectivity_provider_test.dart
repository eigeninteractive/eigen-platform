import 'dart:async';

import 'package:checks/checks.dart';
import 'package:connectivity_plus_platform_interface/connectivity_plus_platform_interface.dart';
import 'package:eigen_flutter/core/connectivity/connectivity_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

/// A platform that, like a browser, reports changes and never the state it
/// starts in.
final class _ChangesOnlyPlatform extends ConnectivityPlatform
    with MockPlatformInterfaceMixin {
  _ChangesOnlyPlatform(this.current);

  final Future<List<ConnectivityResult>> current;
  final changes = StreamController<List<ConnectivityResult>>.broadcast();

  @override
  Future<List<ConnectivityResult>> checkConnectivity() => current;

  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged => changes.stream;
}

void main() {
  late ConnectivityPlatform original;

  setUp(() => original = ConnectivityPlatform.instance);
  tearDown(() => ConnectivityPlatform.instance = original);

  test('an app opened with no network is offline before any change', () async {
    ConnectivityPlatform.instance = _ChangesOnlyPlatform(
      Future.value(const [ConnectivityResult.none]),
    );
    final container = ProviderContainer.test();
    container.listen(isOfflineProvider, (_, _) {});

    await container.read(connectivityProvider.future);

    check(container.read(isOfflineProvider)).isTrue();
  });

  test('a change that arrives before the current state is read wins', () async {
    final current = Completer<List<ConnectivityResult>>();
    final platform = _ChangesOnlyPlatform(current.future);
    ConnectivityPlatform.instance = platform;
    final container = ProviderContainer.test();
    container.listen(isOfflineProvider, (_, _) {});
    await pumpEventQueue();

    platform.changes.add(const [ConnectivityResult.wifi]);
    current.complete(const [ConnectivityResult.none]);
    await pumpEventQueue();

    check(container.read(isOfflineProvider)).isFalse();
  });
}
