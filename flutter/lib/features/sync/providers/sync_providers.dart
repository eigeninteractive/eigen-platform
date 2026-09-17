import 'dart:async';
import 'dart:developer' as developer;

import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/api/engine_api_providers.dart';
import 'package:eigen_flutter/core/config/app_config.dart';
import 'package:eigen_flutter/core/connectivity/connectivity_provider.dart';
import 'package:eigen_flutter/core/notifications/notification_provider.dart';
import 'package:eigen_flutter/core/replica/replica_providers.dart';
import 'package:eigen_flutter/features/auth/providers/auth_providers.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'sync_providers.g.dart';

/// The signed-in account's sync pass, or null when nobody is signed in.
@Riverpod(keepAlive: true)
Future<SyncPass?> syncPass(Ref ref) async {
  final replica = await ref.watch(accountReplicaProvider.future);
  if (replica == null) return null;
  final host = await ref.watch(replicaHostProvider.future);
  final client = ref.watch(engineClientProvider);
  return SyncPass(
    replica: replica,
    public: await ref.watch(publicReplicaProvider.future),
    account: client.account,
    games: client.games,
    localGames: LocalGameSync(
      storage: await ref.watch(localGameStorageProvider.future),
      games: client.games,
      userId: replica.accountId,
    ),
    // Two tabs of the app in one browser share one database, so their passes
    // take one lock, and a pass one tab ran answers the other's requests too.
    lock: (body) => host.exclusively('eigen-sync', body),
    keptReplays: ref.watch(appConfigProvider).replica.keptReplays,
  );
}

/// Whether a sync pass is running, and what the last one found.
typedef SyncStatus = ({bool running, SyncReport? last});

/// Runs the account's sync pass whenever there is reason to (decision 0013).
///
/// The reasons are events, never a timer: somebody signs in, the device
/// regains connectivity, a push arrives while the app is open, and a local game
/// finishes. An app also calls [run] when the player comes back to it and on
/// pull-to-refresh; coming back is the application's lifecycle to observe,
/// which is why it is not wired here. However many reasons arrive together, the
/// pass itself runs once for them (decision 0014).
///
/// Nothing here blocks a screen: every screen reads the replica, and a pass
/// only changes what it shows.
@Riverpod(keepAlive: true)
class SyncCoordinator extends _$SyncCoordinator {
  @override
  SyncStatus build() {
    ref.listen(currentUserIdProvider, (previous, next) {
      if (next != null && next != previous) unawaited(run());
    }, fireImmediately: true);
    ref.listen(isOfflineProvider, (previous, next) {
      if (previous == true && !next) unawaited(run());
    });
    final pushes = ref
        .watch(notificationServiceProvider)
        .foregroundMessages
        .listen((_) => unawaited(run()));
    ref.onDispose(pushes.cancel);
    return (running: false, last: null);
  }

  /// Requests currently waiting on or running a pass.
  var _requests = 0;

  /// Brings the replica up to date for a reason arising now, and answers with
  /// the report of the pass that ran for it; null when nobody is signed in, when
  /// no pass could start, or when a pass run for an earlier request, here or in
  /// another tab, already covered this one.
  ///
  /// Never throws: every caller is a trigger that has nothing to do with a
  /// failure but try again later, and the replica still holds what the last good
  /// pass wrote.
  Future<SyncReport?> run() async {
    _requests++;
    if (ref.mounted) state = (running: true, last: state.last);
    SyncReport? report;
    try {
      final pass = await ref.read(syncPassProvider.future);
      if (pass == null) return null;
      report = await pass.run();
      if (report?.error case final error?) {
        developer.log('Sync pass could not pull', name: 'sync', error: error);
      }
      return report;
    } on Object catch (error, stackTrace) {
      developer.log(
        'Sync pass could not start',
        name: 'sync',
        error: error,
        stackTrace: stackTrace,
      );
      return null;
    } finally {
      _requests--;
      if (ref.mounted) {
        state = (running: _requests > 0, last: report ?? state.last);
      }
    }
  }

  /// Fetches one page of history older than the replica holds. Answers whether
  /// more remains.
  Future<bool> loadOlderHistory() async {
    final pass = await ref.read(syncPassProvider.future);
    return await pass?.loadOlderHistory() ?? false;
  }
}
