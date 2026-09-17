import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'connectivity_provider.g.dart';

/// The device's connectivity: what it is now, then every change.
///
/// Reflects network interface availability, not internet reachability: a
/// connected Wi-Fi with no route to the internet does not report
/// [ConnectivityResult.none].
///
/// The current state is read explicitly because the change stream does not
/// promise one. A browser reports only `online` and `offline` events, so an app
/// opened with no network would otherwise believe itself online until the
/// network came and went again. A change that arrives before that read answers
/// is newer, and the read is then dropped.
@riverpod
Stream<List<ConnectivityResult>> connectivity(Ref ref) {
  final connectivity = Connectivity();
  final results = StreamController<List<ConnectivityResult>>();
  var changed = false;
  void fail(Object error, StackTrace stackTrace) {
    if (!results.isClosed) results.addError(error, stackTrace);
  }

  final changes = connectivity.onConnectivityChanged.listen((result) {
    changed = true;
    results.add(result);
  }, onError: fail);
  connectivity.checkConnectivity().then((current) {
    if (!changed && !results.isClosed) results.add(current);
  }, onError: fail);
  ref.onDispose(() async {
    await changes.cancel();
    await results.close();
  });
  return results.stream;
}

/// True when every connectivity result is [ConnectivityResult.none].
///
/// Returns false during the brief loading window before the current state is
/// known.
@riverpod
bool isOffline(Ref ref) {
  final results = ref.watch(connectivityProvider).whenOrNull(data: (v) => v);
  if (results == null) return false;
  return results.isNotEmpty &&
      results.every((r) => r == ConnectivityResult.none);
}
