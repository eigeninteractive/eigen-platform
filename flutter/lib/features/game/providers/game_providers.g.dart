// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'game_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Provider for GameRepository instance.

@ProviderFor(gameRepository)
final gameRepositoryProvider = GameRepositoryProvider._();

/// Provider for GameRepository instance.

final class GameRepositoryProvider
    extends $FunctionalProvider<GameRepository, GameRepository, GameRepository>
    with $Provider<GameRepository> {
  /// Provider for GameRepository instance.
  GameRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'gameRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$gameRepositoryHash();

  @$internal
  @override
  $ProviderElement<GameRepository> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  GameRepository create(Ref ref) {
    return gameRepository(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(GameRepository value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<GameRepository>(value),
    );
  }
}

String _$gameRepositoryHash() => r'e2d90e8cf3258a0fdb078e4a86f16b31d51e5487';

/// The active [GameModule].
///
/// `EigenFlutterScope` registers the game module for normal apps. Widget tests that
/// construct their own `ProviderScope` can override it directly:
/// ```dart
/// currentGameModuleProvider.overrideWithValue(const TicTacToeModule())
/// ```
/// Throws [UnimplementedError] at startup if no override is provided.

@ProviderFor(currentGameModule)
final currentGameModuleProvider = CurrentGameModuleProvider._();

/// The active [GameModule].
///
/// `EigenFlutterScope` registers the game module for normal apps. Widget tests that
/// construct their own `ProviderScope` can override it directly:
/// ```dart
/// currentGameModuleProvider.overrideWithValue(const TicTacToeModule())
/// ```
/// Throws [UnimplementedError] at startup if no override is provided.

final class CurrentGameModuleProvider
    extends $FunctionalProvider<GameModule, GameModule, GameModule>
    with $Provider<GameModule> {
  /// The active [GameModule].
  ///
  /// `EigenFlutterScope` registers the game module for normal apps. Widget tests that
  /// construct their own `ProviderScope` can override it directly:
  /// ```dart
  /// currentGameModuleProvider.overrideWithValue(const TicTacToeModule())
  /// ```
  /// Throws [UnimplementedError] at startup if no override is provided.
  CurrentGameModuleProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'currentGameModuleProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$currentGameModuleHash();

  @$internal
  @override
  $ProviderElement<GameModule> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  GameModule create(Ref ref) {
    return currentGameModule(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(GameModule value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<GameModule>(value),
    );
  }
}

String _$currentGameModuleHash() => r'261bd79bd7189c66d74b3bb73e5877a5c1db946b';

/// The bot catalog for this deployment - the pickers' source of truth.
///
/// Read from the replica, which the sync pass keeps current, so a picker opens
/// with no request and an offline device can still name the opponents of a game
/// it is already playing. The catalog is deployment-global public reference
/// data, shared by every account on the device.

@ProviderFor(availableBots)
final availableBotsProvider = AvailableBotsProvider._();

/// The bot catalog for this deployment - the pickers' source of truth.
///
/// Read from the replica, which the sync pass keeps current, so a picker opens
/// with no request and an offline device can still name the opponents of a game
/// it is already playing. The catalog is deployment-global public reference
/// data, shared by every account on the device.

final class AvailableBotsProvider
    extends
        $FunctionalProvider<AsyncValue<List<Bot>>, List<Bot>, Stream<List<Bot>>>
    with $FutureModifier<List<Bot>>, $StreamProvider<List<Bot>> {
  /// The bot catalog for this deployment - the pickers' source of truth.
  ///
  /// Read from the replica, which the sync pass keeps current, so a picker opens
  /// with no request and an offline device can still name the opponents of a game
  /// it is already playing. The catalog is deployment-global public reference
  /// data, shared by every account on the device.
  AvailableBotsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'availableBotsProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$availableBotsHash();

  @$internal
  @override
  $StreamProviderElement<List<Bot>> $createElement($ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<List<Bot>> create(Ref ref) {
    return availableBots(ref);
  }
}

String _$availableBotsHash() => r'da06e862e3d9648f4b66369a538856d6877f7d6c';

/// The bot catalog indexed by id, for O(1) capability lookups.

@ProviderFor(botCatalogById)
final botCatalogByIdProvider = BotCatalogByIdProvider._();

/// The bot catalog indexed by id, for O(1) capability lookups.

final class BotCatalogByIdProvider
    extends
        $FunctionalProvider<
          AsyncValue<Map<String, Bot>>,
          Map<String, Bot>,
          FutureOr<Map<String, Bot>>
        >
    with $FutureModifier<Map<String, Bot>>, $FutureProvider<Map<String, Bot>> {
  /// The bot catalog indexed by id, for O(1) capability lookups.
  BotCatalogByIdProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'botCatalogByIdProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$botCatalogByIdHash();

  @$internal
  @override
  $FutureProviderElement<Map<String, Bot>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<Map<String, Bot>> create(Ref ref) {
    return botCatalogById(ref);
  }
}

String _$botCatalogByIdHash() => r'2b2144eb85fffe5224794b1078a7d6e8476cd860';

/// Whether the solo-play entry should be offered for this deployment.
///
/// Solo play has two arms, and either one is enough to open the picker:
///
/// 1. **Server-seated.** A bot this build's rules can play, in a *timed* mode.
///    Dispatch is single-attempt, so if a bot's turn is never delivered the only
///    thing that resolves the game is the turn deadline firing the server's
///    alarm. Untimed would mean no deadline, no alarm, and a game wedged
///    forever, which is why the server refuses it on the seating path.
/// 2. **On the device.** An untimed mode whose bots this build runs itself. No
///    dispatch can fail here, so no deadline is needed, which is exactly why the
///    two arms partition by timing. See [localPlayAvailable].
///
/// Both conditions are enforced server-side as well; this only avoids offering
/// an entry that would open a dead-end picker.
///
/// Guests are deliberately *not* gated out: solo-vs-bot is a guest's first-run
/// experience, and the server accepts it - the game simply comes out unrated,
/// since rating requires a registered account.

@ProviderFor(soloPlayAvailable)
final soloPlayAvailableProvider = SoloPlayAvailableProvider._();

/// Whether the solo-play entry should be offered for this deployment.
///
/// Solo play has two arms, and either one is enough to open the picker:
///
/// 1. **Server-seated.** A bot this build's rules can play, in a *timed* mode.
///    Dispatch is single-attempt, so if a bot's turn is never delivered the only
///    thing that resolves the game is the turn deadline firing the server's
///    alarm. Untimed would mean no deadline, no alarm, and a game wedged
///    forever, which is why the server refuses it on the seating path.
/// 2. **On the device.** An untimed mode whose bots this build runs itself. No
///    dispatch can fail here, so no deadline is needed, which is exactly why the
///    two arms partition by timing. See [localPlayAvailable].
///
/// Both conditions are enforced server-side as well; this only avoids offering
/// an entry that would open a dead-end picker.
///
/// Guests are deliberately *not* gated out: solo-vs-bot is a guest's first-run
/// experience, and the server accepts it - the game simply comes out unrated,
/// since rating requires a registered account.

final class SoloPlayAvailableProvider
    extends $FunctionalProvider<bool, bool, bool>
    with $Provider<bool> {
  /// Whether the solo-play entry should be offered for this deployment.
  ///
  /// Solo play has two arms, and either one is enough to open the picker:
  ///
  /// 1. **Server-seated.** A bot this build's rules can play, in a *timed* mode.
  ///    Dispatch is single-attempt, so if a bot's turn is never delivered the only
  ///    thing that resolves the game is the turn deadline firing the server's
  ///    alarm. Untimed would mean no deadline, no alarm, and a game wedged
  ///    forever, which is why the server refuses it on the seating path.
  /// 2. **On the device.** An untimed mode whose bots this build runs itself. No
  ///    dispatch can fail here, so no deadline is needed, which is exactly why the
  ///    two arms partition by timing. See [localPlayAvailable].
  ///
  /// Both conditions are enforced server-side as well; this only avoids offering
  /// an entry that would open a dead-end picker.
  ///
  /// Guests are deliberately *not* gated out: solo-vs-bot is a guest's first-run
  /// experience, and the server accepts it - the game simply comes out unrated,
  /// since rating requires a registered account.
  SoloPlayAvailableProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'soloPlayAvailableProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$soloPlayAvailableHash();

  @$internal
  @override
  $ProviderElement<bool> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  bool create(Ref ref) {
    return soloPlayAvailable(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(bool value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<bool>(value),
    );
  }
}

String _$soloPlayAvailableHash() => r'9270da426e6cbab532b8cc97e4e4a0e5c4acf964';

/// The caller's games still in play, "your turn" first then most recently
/// changed.
///
/// Read from the replica (decision 0013): online and local games are rows in
/// the same table, so nothing merges them, and opening the list costs no
/// request. It re-emits when a writer changes a row it shows: a sync pass, a
/// live session, or the local engine.

@ProviderFor(activeGames)
final activeGamesProvider = ActiveGamesProvider._();

/// The caller's games still in play, "your turn" first then most recently
/// changed.
///
/// Read from the replica (decision 0013): online and local games are rows in
/// the same table, so nothing merges them, and opening the list costs no
/// request. It re-emits when a writer changes a row it shows: a sync pass, a
/// live session, or the local engine.

final class ActiveGamesProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<GameSummary>>,
          List<GameSummary>,
          Stream<List<GameSummary>>
        >
    with
        $FutureModifier<List<GameSummary>>,
        $StreamProvider<List<GameSummary>> {
  /// The caller's games still in play, "your turn" first then most recently
  /// changed.
  ///
  /// Read from the replica (decision 0013): online and local games are rows in
  /// the same table, so nothing merges them, and opening the list costs no
  /// request. It re-emits when a writer changes a row it shows: a sync pass, a
  /// live session, or the local engine.
  ActiveGamesProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'activeGamesProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$activeGamesHash();

  @$internal
  @override
  $StreamProviderElement<List<GameSummary>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<List<GameSummary>> create(Ref ref) {
    return activeGames(ref);
  }
}

String _$activeGamesHash() => r'625cd0c6c0eac325da30cc10e980c947bc1dab6d';

/// The caller's ended games, most recently ended first, up to [limit].
///
/// History grows by raising [limit]. When the replica runs out before the limit
/// and older history remains on the server, the history screen asks the sync
/// coordinator for the next page, and this re-emits as it lands.

@ProviderFor(finishedGames)
final finishedGamesProvider = FinishedGamesFamily._();

/// The caller's ended games, most recently ended first, up to [limit].
///
/// History grows by raising [limit]. When the replica runs out before the limit
/// and older history remains on the server, the history screen asks the sync
/// coordinator for the next page, and this re-emits as it lands.

final class FinishedGamesProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<GameSummary>>,
          List<GameSummary>,
          Stream<List<GameSummary>>
        >
    with
        $FutureModifier<List<GameSummary>>,
        $StreamProvider<List<GameSummary>> {
  /// The caller's ended games, most recently ended first, up to [limit].
  ///
  /// History grows by raising [limit]. When the replica runs out before the limit
  /// and older history remains on the server, the history screen asks the sync
  /// coordinator for the next page, and this re-emits as it lands.
  FinishedGamesProvider._({
    required FinishedGamesFamily super.from,
    required int super.argument,
  }) : super(
         retry: null,
         name: r'finishedGamesProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$finishedGamesHash();

  @override
  String toString() {
    return r'finishedGamesProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $StreamProviderElement<List<GameSummary>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<List<GameSummary>> create(Ref ref) {
    final argument = this.argument as int;
    return finishedGames(ref, limit: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is FinishedGamesProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$finishedGamesHash() => r'aa123040fefcaea20641f0d9c6e32367518781b6';

/// The caller's ended games, most recently ended first, up to [limit].
///
/// History grows by raising [limit]. When the replica runs out before the limit
/// and older history remains on the server, the history screen asks the sync
/// coordinator for the next page, and this re-emits as it lands.

final class FinishedGamesFamily extends $Family
    with $FunctionalFamilyOverride<Stream<List<GameSummary>>, int> {
  FinishedGamesFamily._()
    : super(
        retry: null,
        name: r'finishedGamesProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// The caller's ended games, most recently ended first, up to [limit].
  ///
  /// History grows by raising [limit]. When the replica runs out before the limit
  /// and older history remains on the server, the history screen asks the sync
  /// coordinator for the next page, and this re-emits as it lands.

  FinishedGamesProvider call({required int limit}) =>
      FinishedGamesProvider._(argument: limit, from: this);

  @override
  String toString() => r'finishedGamesProvider';
}

/// One game's live session: the single subscription a game screen needs.
///
/// Every emission is a COMPLETE session, which is what makes `.value` on this
/// sound. The old shape streamed heterogeneous events and had each derived
/// provider type-test the newest one, so a frame arriving after a roster
/// snapshot silently reverted the roster, and nothing on the socket reported a
/// status change at all.
///
/// One socket serves the whole game. Riverpod's automatic retry covers a failure
/// to establish it; drops after that are handled inside the socket, which
/// reconnects and is answered with the current snapshot, so this stream is never
/// torn down to resync.

@ProviderFor(gameSession)
final gameSessionProvider = GameSessionFamily._();

/// One game's live session: the single subscription a game screen needs.
///
/// Every emission is a COMPLETE session, which is what makes `.value` on this
/// sound. The old shape streamed heterogeneous events and had each derived
/// provider type-test the newest one, so a frame arriving after a roster
/// snapshot silently reverted the roster, and nothing on the socket reported a
/// status change at all.
///
/// One socket serves the whole game. Riverpod's automatic retry covers a failure
/// to establish it; drops after that are handled inside the socket, which
/// reconnects and is answered with the current snapshot, so this stream is never
/// torn down to resync.

final class GameSessionProvider
    extends
        $FunctionalProvider<
          AsyncValue<GameSession>,
          GameSession,
          Stream<GameSession>
        >
    with $FutureModifier<GameSession>, $StreamProvider<GameSession> {
  /// One game's live session: the single subscription a game screen needs.
  ///
  /// Every emission is a COMPLETE session, which is what makes `.value` on this
  /// sound. The old shape streamed heterogeneous events and had each derived
  /// provider type-test the newest one, so a frame arriving after a roster
  /// snapshot silently reverted the roster, and nothing on the socket reported a
  /// status change at all.
  ///
  /// One socket serves the whole game. Riverpod's automatic retry covers a failure
  /// to establish it; drops after that are handled inside the socket, which
  /// reconnects and is answered with the current snapshot, so this stream is never
  /// torn down to resync.
  GameSessionProvider._({
    required GameSessionFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'gameSessionProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$gameSessionHash();

  @override
  String toString() {
    return r'gameSessionProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $StreamProviderElement<GameSession> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<GameSession> create(Ref ref) {
    final argument = this.argument as String;
    return gameSession(ref, gameId: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is GameSessionProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$gameSessionHash() => r'314868f42ae9bcc53d6bc98548d3ee6ff810f796';

/// One game's live session: the single subscription a game screen needs.
///
/// Every emission is a COMPLETE session, which is what makes `.value` on this
/// sound. The old shape streamed heterogeneous events and had each derived
/// provider type-test the newest one, so a frame arriving after a roster
/// snapshot silently reverted the roster, and nothing on the socket reported a
/// status change at all.
///
/// One socket serves the whole game. Riverpod's automatic retry covers a failure
/// to establish it; drops after that are handled inside the socket, which
/// reconnects and is answered with the current snapshot, so this stream is never
/// torn down to resync.

final class GameSessionFamily extends $Family
    with $FunctionalFamilyOverride<Stream<GameSession>, String> {
  GameSessionFamily._()
    : super(
        retry: null,
        name: r'gameSessionProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// One game's live session: the single subscription a game screen needs.
  ///
  /// Every emission is a COMPLETE session, which is what makes `.value` on this
  /// sound. The old shape streamed heterogeneous events and had each derived
  /// provider type-test the newest one, so a frame arriving after a roster
  /// snapshot silently reverted the roster, and nothing on the socket reported a
  /// status change at all.
  ///
  /// One socket serves the whole game. Riverpod's automatic retry covers a failure
  /// to establish it; drops after that are handled inside the socket, which
  /// reconnects and is answered with the current snapshot, so this stream is never
  /// torn down to resync.

  GameSessionProvider call({required String gameId}) =>
      GameSessionProvider._(argument: gameId, from: this);

  @override
  String toString() => r'gameSessionProvider';
}

/// The game's status, live.
///
/// A selector, not a fetch. Every screen decision that used to read a summary
/// that nothing refetched reads this instead.

@ProviderFor(gameStatus)
final gameStatusProvider = GameStatusFamily._();

/// The game's status, live.
///
/// A selector, not a fetch. Every screen decision that used to read a summary
/// that nothing refetched reads this instead.

final class GameStatusProvider
    extends $FunctionalProvider<GameStatus?, GameStatus?, GameStatus?>
    with $Provider<GameStatus?> {
  /// The game's status, live.
  ///
  /// A selector, not a fetch. Every screen decision that used to read a summary
  /// that nothing refetched reads this instead.
  GameStatusProvider._({
    required GameStatusFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'gameStatusProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$gameStatusHash();

  @override
  String toString() {
    return r'gameStatusProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $ProviderElement<GameStatus?> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  GameStatus? create(Ref ref) {
    final argument = this.argument as String;
    return gameStatus(ref, gameId: argument);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(GameStatus? value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<GameStatus?>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is GameStatusProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$gameStatusHash() => r'e1bf882010077cb844d003d9f8bfbb120565d922';

/// The game's status, live.
///
/// A selector, not a fetch. Every screen decision that used to read a summary
/// that nothing refetched reads this instead.

final class GameStatusFamily extends $Family
    with $FunctionalFamilyOverride<GameStatus?, String> {
  GameStatusFamily._()
    : super(
        retry: null,
        name: r'gameStatusProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// The game's status, live.
  ///
  /// A selector, not a fetch. Every screen decision that used to read a summary
  /// that nothing refetched reads this instead.

  GameStatusProvider call({required String gameId}) =>
      GameStatusProvider._(argument: gameId, from: this);

  @override
  String toString() => r'gameStatusProvider';
}

/// The seats, live: the roster the server stated with the newest snapshot.

@ProviderFor(gameSeats)
final gameSeatsProvider = GameSeatsFamily._();

/// The seats, live: the roster the server stated with the newest snapshot.

final class GameSeatsProvider
    extends $FunctionalProvider<List<Seat>, List<Seat>, List<Seat>>
    with $Provider<List<Seat>> {
  /// The seats, live: the roster the server stated with the newest snapshot.
  GameSeatsProvider._({
    required GameSeatsFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'gameSeatsProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$gameSeatsHash();

  @override
  String toString() {
    return r'gameSeatsProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $ProviderElement<List<Seat>> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  List<Seat> create(Ref ref) {
    final argument = this.argument as String;
    return gameSeats(ref, gameId: argument);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(List<Seat> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<List<Seat>>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is GameSeatsProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$gameSeatsHash() => r'ea6746154fda7c53de3b4a1ce4e437b1595d1b95';

/// The seats, live: the roster the server stated with the newest snapshot.

final class GameSeatsFamily extends $Family
    with $FunctionalFamilyOverride<List<Seat>, String> {
  GameSeatsFamily._()
    : super(
        retry: null,
        name: r'gameSeatsProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// The seats, live: the roster the server stated with the newest snapshot.

  GameSeatsProvider call({required String gameId}) =>
      GameSeatsProvider._(argument: gameId, from: this);

  @override
  String toString() => r'gameSeatsProvider';
}

/// Compatibility verdict over the live session.
///
/// Status, seat type, and frame type drive gameplay behavior, so guessing would
/// be unsafe. Metadata-only unknowns such as access remain usable with
/// conservative UI. One source now, so there is no second copy of the same field
/// to check.

@ProviderFor(gameWireCompatibility)
final gameWireCompatibilityProvider = GameWireCompatibilityFamily._();

/// Compatibility verdict over the live session.
///
/// Status, seat type, and frame type drive gameplay behavior, so guessing would
/// be unsafe. Metadata-only unknowns such as access remain usable with
/// conservative UI. One source now, so there is no second copy of the same field
/// to check.

final class GameWireCompatibilityProvider
    extends
        $FunctionalProvider<
          GameWireCompatibility,
          GameWireCompatibility,
          GameWireCompatibility
        >
    with $Provider<GameWireCompatibility> {
  /// Compatibility verdict over the live session.
  ///
  /// Status, seat type, and frame type drive gameplay behavior, so guessing would
  /// be unsafe. Metadata-only unknowns such as access remain usable with
  /// conservative UI. One source now, so there is no second copy of the same field
  /// to check.
  GameWireCompatibilityProvider._({
    required GameWireCompatibilityFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'gameWireCompatibilityProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$gameWireCompatibilityHash();

  @override
  String toString() {
    return r'gameWireCompatibilityProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $ProviderElement<GameWireCompatibility> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  GameWireCompatibility create(Ref ref) {
    final argument = this.argument as String;
    return gameWireCompatibility(ref, gameId: argument);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(GameWireCompatibility value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<GameWireCompatibility>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is GameWireCompatibilityProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$gameWireCompatibilityHash() =>
    r'6406981ada9d8417996f056f7ffb88a11244d27b';

/// Compatibility verdict over the live session.
///
/// Status, seat type, and frame type drive gameplay behavior, so guessing would
/// be unsafe. Metadata-only unknowns such as access remain usable with
/// conservative UI. One source now, so there is no second copy of the same field
/// to check.

final class GameWireCompatibilityFamily extends $Family
    with $FunctionalFamilyOverride<GameWireCompatibility, String> {
  GameWireCompatibilityFamily._()
    : super(
        retry: null,
        name: r'gameWireCompatibilityProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// Compatibility verdict over the live session.
  ///
  /// Status, seat type, and frame type drive gameplay behavior, so guessing would
  /// be unsafe. Metadata-only unknowns such as access remain usable with
  /// conservative UI. One source now, so there is no second copy of the same field
  /// to check.

  GameWireCompatibilityProvider call({required String gameId}) =>
      GameWireCompatibilityProvider._(argument: gameId, from: this);

  @override
  String toString() => r'gameWireCompatibilityProvider';
}

/// The game's seats with their identities resolved, plus which one is mine.
///
/// Seats come from the live session, so this re-derives as players join and
/// leave. Identities come from the replica: humans from its players, bots from
/// its catalog.

@ProviderFor(gamePlayers)
final gamePlayersProvider = GamePlayersFamily._();

/// The game's seats with their identities resolved, plus which one is mine.
///
/// Seats come from the live session, so this re-derives as players join and
/// leave. Identities come from the replica: humans from its players, bots from
/// its catalog.

final class GamePlayersProvider
    extends
        $FunctionalProvider<
          AsyncValue<PlayersContext>,
          PlayersContext,
          FutureOr<PlayersContext>
        >
    with $FutureModifier<PlayersContext>, $FutureProvider<PlayersContext> {
  /// The game's seats with their identities resolved, plus which one is mine.
  ///
  /// Seats come from the live session, so this re-derives as players join and
  /// leave. Identities come from the replica: humans from its players, bots from
  /// its catalog.
  GamePlayersProvider._({
    required GamePlayersFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'gamePlayersProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$gamePlayersHash();

  @override
  String toString() {
    return r'gamePlayersProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<PlayersContext> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<PlayersContext> create(Ref ref) {
    final argument = this.argument as String;
    return gamePlayers(ref, gameId: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is GamePlayersProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$gamePlayersHash() => r'1dbcfc8c4276b145fa8cfdb2dc02aaa05eb3b366';

/// The game's seats with their identities resolved, plus which one is mine.
///
/// Seats come from the live session, so this re-derives as players join and
/// leave. Identities come from the replica: humans from its players, bots from
/// its catalog.

final class GamePlayersFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<PlayersContext>, String> {
  GamePlayersFamily._()
    : super(
        retry: null,
        name: r'gamePlayersProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// The game's seats with their identities resolved, plus which one is mine.
  ///
  /// Seats come from the live session, so this re-derives as players join and
  /// leave. Identities come from the replica: humans from its players, bots from
  /// its catalog.

  GamePlayersProvider call({required String gameId}) =>
      GamePlayersProvider._(argument: gameId, from: this);

  @override
  String toString() => r'gamePlayersProvider';
}

/// Joins a game by invite code, answering with the seated session.
///
/// The session carries the game's id, which is the only place a by-code caller
/// learns it. Auto-disposes once the join screen navigates away. The screen uses
/// [ref.listen] to react to the result rather than watching the value directly,
/// so navigation happens exactly once.

@ProviderFor(joinByCode)
final joinByCodeProvider = JoinByCodeFamily._();

/// Joins a game by invite code, answering with the seated session.
///
/// The session carries the game's id, which is the only place a by-code caller
/// learns it. Auto-disposes once the join screen navigates away. The screen uses
/// [ref.listen] to react to the result rather than watching the value directly,
/// so navigation happens exactly once.

final class JoinByCodeProvider
    extends $FunctionalProvider<AsyncValue<Session>, Session, FutureOr<Session>>
    with $FutureModifier<Session>, $FutureProvider<Session> {
  /// Joins a game by invite code, answering with the seated session.
  ///
  /// The session carries the game's id, which is the only place a by-code caller
  /// learns it. Auto-disposes once the join screen navigates away. The screen uses
  /// [ref.listen] to react to the result rather than watching the value directly,
  /// so navigation happens exactly once.
  JoinByCodeProvider._({
    required JoinByCodeFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'joinByCodeProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$joinByCodeHash();

  @override
  String toString() {
    return r'joinByCodeProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<Session> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<Session> create(Ref ref) {
    final argument = this.argument as String;
    return joinByCode(ref, code: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is JoinByCodeProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$joinByCodeHash() => r'4f697b9f5509bdce2c19ba31d656622a3233c319';

/// Joins a game by invite code, answering with the seated session.
///
/// The session carries the game's id, which is the only place a by-code caller
/// learns it. Auto-disposes once the join screen navigates away. The screen uses
/// [ref.listen] to react to the result rather than watching the value directly,
/// so navigation happens exactly once.

final class JoinByCodeFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<Session>, String> {
  JoinByCodeFamily._()
    : super(
        retry: null,
        name: r'joinByCodeProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// Joins a game by invite code, answering with the seated session.
  ///
  /// The session carries the game's id, which is the only place a by-code caller
  /// learns it. Auto-disposes once the join screen navigates away. The screen uses
  /// [ref.listen] to react to the result rather than watching the value directly,
  /// so navigation happens exactly once.

  JoinByCodeProvider call({required String code}) =>
      JoinByCodeProvider._(argument: code, from: this);

  @override
  String toString() => r'joinByCodeProvider';
}

/// A finished game's outcomes.
///
/// A projection of the live session rather than a fetch: they ride the finishing
/// frame, and a cold open of a finished game gets them on whatever its newest
/// frame is. Empty while the game is still running.

@ProviderFor(gameOutcomes)
final gameOutcomesProvider = GameOutcomesFamily._();

/// A finished game's outcomes.
///
/// A projection of the live session rather than a fetch: they ride the finishing
/// frame, and a cold open of a finished game gets them on whatever its newest
/// frame is. Empty while the game is still running.

final class GameOutcomesProvider
    extends $FunctionalProvider<List<Outcome>, List<Outcome>, List<Outcome>>
    with $Provider<List<Outcome>> {
  /// A finished game's outcomes.
  ///
  /// A projection of the live session rather than a fetch: they ride the finishing
  /// frame, and a cold open of a finished game gets them on whatever its newest
  /// frame is. Empty while the game is still running.
  GameOutcomesProvider._({
    required GameOutcomesFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'gameOutcomesProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$gameOutcomesHash();

  @override
  String toString() {
    return r'gameOutcomesProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $ProviderElement<List<Outcome>> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  List<Outcome> create(Ref ref) {
    final argument = this.argument as String;
    return gameOutcomes(ref, gameId: argument);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(List<Outcome> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<List<Outcome>>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is GameOutcomesProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$gameOutcomesHash() => r'bdba89f6c98b2002ac27bb1ad7440ee6b2a5eb9d';

/// A finished game's outcomes.
///
/// A projection of the live session rather than a fetch: they ride the finishing
/// frame, and a cold open of a finished game gets them on whatever its newest
/// frame is. Empty while the game is still running.

final class GameOutcomesFamily extends $Family
    with $FunctionalFamilyOverride<List<Outcome>, String> {
  GameOutcomesFamily._()
    : super(
        retry: null,
        name: r'gameOutcomesProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// A finished game's outcomes.
  ///
  /// A projection of the live session rather than a fetch: they ride the finishing
  /// frame, and a cold open of a finished game gets them on whatever its newest
  /// frame is. Empty while the game is still running.

  GameOutcomesProvider call({required String gameId}) =>
      GameOutcomesProvider._(argument: gameId, from: this);

  @override
  String toString() => r'gameOutcomesProvider';
}

/// A player's most recent finished public games, for the replay list on their
/// profile.
///
/// Works for any player, human or bot. Public and finished only, so it never
/// exposes a game that was not already replayable by anyone holding its id.

@ProviderFor(playerPublicFinishedGames)
final playerPublicFinishedGamesProvider = PlayerPublicFinishedGamesFamily._();

/// A player's most recent finished public games, for the replay list on their
/// profile.
///
/// Works for any player, human or bot. Public and finished only, so it never
/// exposes a game that was not already replayable by anyone holding its id.

final class PlayerPublicFinishedGamesProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<GameSummary>>,
          List<GameSummary>,
          FutureOr<List<GameSummary>>
        >
    with
        $FutureModifier<List<GameSummary>>,
        $FutureProvider<List<GameSummary>> {
  /// A player's most recent finished public games, for the replay list on their
  /// profile.
  ///
  /// Works for any player, human or bot. Public and finished only, so it never
  /// exposes a game that was not already replayable by anyone holding its id.
  PlayerPublicFinishedGamesProvider._({
    required PlayerPublicFinishedGamesFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'playerPublicFinishedGamesProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$playerPublicFinishedGamesHash();

  @override
  String toString() {
    return r'playerPublicFinishedGamesProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<List<GameSummary>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<List<GameSummary>> create(Ref ref) {
    final argument = this.argument as String;
    return playerPublicFinishedGames(ref, playerId: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is PlayerPublicFinishedGamesProvider &&
        other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$playerPublicFinishedGamesHash() =>
    r'4eb0d86534a5f56d0ea7eeaef5d47e668c07d1e5';

/// A player's most recent finished public games, for the replay list on their
/// profile.
///
/// Works for any player, human or bot. Public and finished only, so it never
/// exposes a game that was not already replayable by anyone holding its id.

final class PlayerPublicFinishedGamesFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<List<GameSummary>>, String> {
  PlayerPublicFinishedGamesFamily._()
    : super(
        retry: null,
        name: r'playerPublicFinishedGamesProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// A player's most recent finished public games, for the replay list on their
  /// profile.
  ///
  /// Works for any player, human or bot. Public and finished only, so it never
  /// exposes a game that was not already replayable by anyone holding its id.

  PlayerPublicFinishedGamesProvider call({required String playerId}) =>
      PlayerPublicFinishedGamesProvider._(argument: playerId, from: this);

  @override
  String toString() => r'playerPublicFinishedGamesProvider';
}
