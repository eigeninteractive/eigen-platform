/// Typed analytics interface. Call sites are unaware of the backing
/// implementation (Firebase or no-op).
abstract interface class AnalyticsService {
  // ── Identity ───────────────────────────────────────────────────────────────

  /// Associates subsequent events with [userId].
  Future<void> identify(String userId);

  /// Clears the current identity (call on sign-out).
  Future<void> reset();

  /// Tags the current user as a guest (anonymous) or registered account, so
  /// every other metric can be segmented by account type. Call whenever the
  /// session's account type is established or changes.
  Future<void> setAccountType({required bool isGuest});

  // ── Events ─────────────────────────────────────────────────────────────────

  /// A guest converted their anonymous session into a permanent account. The
  /// key conversion-funnel metric for guest auth.
  Future<void> guestUpgraded();

  Future<void> gameCreated({
    required String gameId,
    required String access,
    required String timingMode,
    required bool rated,
  });

  Future<void> gameStarted({required String gameId, required int playerCount});

  Future<void> gameFinished({required String gameId});

  Future<void> forfeit();

  Future<void> joinByCode();

  Future<void> friendRequestSent();

  Future<void> friendAccepted();

  /// A generated enum decoded a value this build does not understand.
  Future<void> wireEnumFallback({
    required String enumType,
    required String surface,
  });
}

/// Analytics adapter used when an embedding app has not enabled telemetry.
final class NoopAnalyticsService implements AnalyticsService {
  const NoopAnalyticsService();

  @override
  Future<void> identify(String userId) async {}

  @override
  Future<void> reset() async {}

  @override
  Future<void> setAccountType({required bool isGuest}) async {}

  @override
  Future<void> guestUpgraded() async {}

  @override
  Future<void> gameCreated({
    required String gameId,
    required String access,
    required String timingMode,
    required bool rated,
  }) async {}

  @override
  Future<void> gameStarted({
    required String gameId,
    required int playerCount,
  }) async {}

  @override
  Future<void> gameFinished({required String gameId}) async {}

  @override
  Future<void> forfeit() async {}

  @override
  Future<void> joinByCode() async {}

  @override
  Future<void> friendRequestSent() async {}

  @override
  Future<void> friendAccepted() async {}

  @override
  Future<void> wireEnumFallback({
    required String enumType,
    required String surface,
  }) async {}
}
