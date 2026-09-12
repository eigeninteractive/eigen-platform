// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_game_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Where this device keeps the games it played offline.

@ProviderFor(localGameStore)
final localGameStoreProvider = LocalGameStoreProvider._();

/// Where this device keeps the games it played offline.

final class LocalGameStoreProvider
    extends
        $FunctionalProvider<
          AsyncValue<LocalGameStore>,
          LocalGameStore,
          FutureOr<LocalGameStore>
        >
    with $FutureModifier<LocalGameStore>, $FutureProvider<LocalGameStore> {
  /// Where this device keeps the games it played offline.
  LocalGameStoreProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'localGameStoreProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$localGameStoreHash();

  @$internal
  @override
  $FutureProviderElement<LocalGameStore> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<LocalGameStore> create(Ref ref) {
    return localGameStore(ref);
  }
}

String _$localGameStoreHash() => r'7717419fd93bbcf8f173d66a5cf537892a8eb6f5';

/// Where a bot's brain runs: an isolate on native, the main thread on the web.

@ProviderFor(botRunner)
final botRunnerProvider = BotRunnerProvider._();

/// Where a bot's brain runs: an isolate on native, the main thread on the web.

final class BotRunnerProvider
    extends $FunctionalProvider<BotRunner, BotRunner, BotRunner>
    with $Provider<BotRunner> {
  /// Where a bot's brain runs: an isolate on native, the main thread on the web.
  BotRunnerProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'botRunnerProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$botRunnerHash();

  @$internal
  @override
  $ProviderElement<BotRunner> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  BotRunner create(Ref ref) {
    return botRunner(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(BotRunner value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<BotRunner>(value),
    );
  }
}

String _$botRunnerHash() => r'ce0a279236f6da45efb064d1f5b690738f235bf0';

/// Every local game the signed-in user holds on this device.
///
/// Records are keyed by their creator, so signing out and back in finds them
/// again and a second account never sees another's games.

@ProviderFor(localGames)
final localGamesProvider = LocalGamesProvider._();

/// Every local game the signed-in user holds on this device.
///
/// Records are keyed by their creator, so signing out and back in finds them
/// again and a second account never sees another's games.

final class LocalGamesProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<LocalGameRecord>>,
          List<LocalGameRecord>,
          FutureOr<List<LocalGameRecord>>
        >
    with
        $FutureModifier<List<LocalGameRecord>>,
        $FutureProvider<List<LocalGameRecord>> {
  /// Every local game the signed-in user holds on this device.
  ///
  /// Records are keyed by their creator, so signing out and back in finds them
  /// again and a second account never sees another's games.
  LocalGamesProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'localGamesProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$localGamesHash();

  @$internal
  @override
  $FutureProviderElement<List<LocalGameRecord>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<List<LocalGameRecord>> create(Ref ref) {
    return localGames(ref);
  }
}

String _$localGamesHash() => r'71360b39b761b89aa08a1e117b78daa4f1fd243b';

/// One local game's record, or null when this device holds none under that id
/// (an ordinary server game, or one another device played).

@ProviderFor(localGameRecord)
final localGameRecordProvider = LocalGameRecordFamily._();

/// One local game's record, or null when this device holds none under that id
/// (an ordinary server game, or one another device played).

final class LocalGameRecordProvider
    extends
        $FunctionalProvider<
          AsyncValue<LocalGameRecord?>,
          LocalGameRecord?,
          FutureOr<LocalGameRecord?>
        >
    with $FutureModifier<LocalGameRecord?>, $FutureProvider<LocalGameRecord?> {
  /// One local game's record, or null when this device holds none under that id
  /// (an ordinary server game, or one another device played).
  LocalGameRecordProvider._({
    required LocalGameRecordFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'localGameRecordProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$localGameRecordHash();

  @override
  String toString() {
    return r'localGameRecordProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<LocalGameRecord?> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<LocalGameRecord?> create(Ref ref) {
    final argument = this.argument as String;
    return localGameRecord(ref, gameId: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is LocalGameRecordProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$localGameRecordHash() => r'33619e24e4c8b7aefd31800bfddf9ff240fa2b2f';

/// One local game's record, or null when this device holds none under that id
/// (an ordinary server game, or one another device played).

final class LocalGameRecordFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<LocalGameRecord?>, String> {
  LocalGameRecordFamily._()
    : super(
        retry: null,
        name: r'localGameRecordProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// One local game's record, or null when this device holds none under that id
  /// (an ordinary server game, or one another device played).

  LocalGameRecordProvider call({required String gameId}) =>
      LocalGameRecordProvider._(argument: gameId, from: this);

  @override
  String toString() => r'localGameRecordProvider';
}

/// The engine driving one local game, or null when the game is not local.
///
/// Keyed by game id and kept alive, so leaving the screen and returning resumes
/// the same serialized queue rather than replaying the record through a second
/// engine. A local game whose version this build no longer ships a local unit
/// for fails here, exactly as a server game with an unsupported schema does.

@ProviderFor(localGameEngine)
final localGameEngineProvider = LocalGameEngineFamily._();

/// The engine driving one local game, or null when the game is not local.
///
/// Keyed by game id and kept alive, so leaving the screen and returning resumes
/// the same serialized queue rather than replaying the record through a second
/// engine. A local game whose version this build no longer ships a local unit
/// for fails here, exactly as a server game with an unsupported schema does.

final class LocalGameEngineProvider
    extends
        $FunctionalProvider<
          AsyncValue<LocalGameEngine?>,
          LocalGameEngine?,
          FutureOr<LocalGameEngine?>
        >
    with $FutureModifier<LocalGameEngine?>, $FutureProvider<LocalGameEngine?> {
  /// The engine driving one local game, or null when the game is not local.
  ///
  /// Keyed by game id and kept alive, so leaving the screen and returning resumes
  /// the same serialized queue rather than replaying the record through a second
  /// engine. A local game whose version this build no longer ships a local unit
  /// for fails here, exactly as a server game with an unsupported schema does.
  LocalGameEngineProvider._({
    required LocalGameEngineFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'localGameEngineProvider',
         isAutoDispose: false,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$localGameEngineHash();

  @override
  String toString() {
    return r'localGameEngineProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<LocalGameEngine?> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<LocalGameEngine?> create(Ref ref) {
    final argument = this.argument as String;
    return localGameEngine(ref, gameId: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is LocalGameEngineProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$localGameEngineHash() => r'e956d38ba66b7e5b0e8db3cd0b0fc0c67b605209';

/// The engine driving one local game, or null when the game is not local.
///
/// Keyed by game id and kept alive, so leaving the screen and returning resumes
/// the same serialized queue rather than replaying the record through a second
/// engine. A local game whose version this build no longer ships a local unit
/// for fails here, exactly as a server game with an unsupported schema does.

final class LocalGameEngineFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<LocalGameEngine?>, String> {
  LocalGameEngineFamily._()
    : super(
        retry: null,
        name: r'localGameEngineProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: false,
      );

  /// The engine driving one local game, or null when the game is not local.
  ///
  /// Keyed by game id and kept alive, so leaving the screen and returning resumes
  /// the same serialized queue rather than replaying the record through a second
  /// engine. A local game whose version this build no longer ships a local unit
  /// for fails here, exactly as a server game with an unsupported schema does.

  LocalGameEngineProvider call({required String gameId}) =>
      LocalGameEngineProvider._(argument: gameId, from: this);

  @override
  String toString() => r'localGameEngineProvider';
}

/// Brings a local game this device does not hold onto this device.
///
/// The second half of resume (decision 0012): a game played on a phone is
/// visible from a tablet once it has synchronized, and this is what makes it
/// playable there. It reads the record the server kept, re-derives every seat's
/// frame through this build's own rules, and saves it, after which
/// [localGameRecordProvider] finds it and the session switches to the engine.
///
/// Driven by the session rather than by the store, which is what keeps it off
/// the hot path: an ordinary server game is recognised from the snapshot the
/// socket already delivered, and costs no request at all. It is also what
/// breaks the cycle, since the engine reads the record and the record must not
/// read the engine.
///
/// Also how a diverged record recovers: the local copy is dropped and the
/// server's is pulled in its place, which is the only reconciliation there is
/// once the two have committed different moves at the same version.
///
/// Four things are checked before anything is pulled, because a record this
/// build cannot play is worse than no record: the game must be local-origin,
/// the caller must be its creator, this build must ship a local unit for its
/// version, and it must ship a brain for every bot on the roster. A bot added
/// in a later release is the realistic case, and it leaves the game readable
/// here rather than stuck waiting for a move that can never come.

@ProviderFor(localGameCatchUp)
final localGameCatchUpProvider = LocalGameCatchUpFamily._();

/// Brings a local game this device does not hold onto this device.
///
/// The second half of resume (decision 0012): a game played on a phone is
/// visible from a tablet once it has synchronized, and this is what makes it
/// playable there. It reads the record the server kept, re-derives every seat's
/// frame through this build's own rules, and saves it, after which
/// [localGameRecordProvider] finds it and the session switches to the engine.
///
/// Driven by the session rather than by the store, which is what keeps it off
/// the hot path: an ordinary server game is recognised from the snapshot the
/// socket already delivered, and costs no request at all. It is also what
/// breaks the cycle, since the engine reads the record and the record must not
/// read the engine.
///
/// Also how a diverged record recovers: the local copy is dropped and the
/// server's is pulled in its place, which is the only reconciliation there is
/// once the two have committed different moves at the same version.
///
/// Four things are checked before anything is pulled, because a record this
/// build cannot play is worse than no record: the game must be local-origin,
/// the caller must be its creator, this build must ship a local unit for its
/// version, and it must ship a brain for every bot on the roster. A bot added
/// in a later release is the realistic case, and it leaves the game readable
/// here rather than stuck waiting for a move that can never come.

final class LocalGameCatchUpProvider
    extends
        $FunctionalProvider<
          AsyncValue<LocalGameRecord?>,
          LocalGameRecord?,
          FutureOr<LocalGameRecord?>
        >
    with $FutureModifier<LocalGameRecord?>, $FutureProvider<LocalGameRecord?> {
  /// Brings a local game this device does not hold onto this device.
  ///
  /// The second half of resume (decision 0012): a game played on a phone is
  /// visible from a tablet once it has synchronized, and this is what makes it
  /// playable there. It reads the record the server kept, re-derives every seat's
  /// frame through this build's own rules, and saves it, after which
  /// [localGameRecordProvider] finds it and the session switches to the engine.
  ///
  /// Driven by the session rather than by the store, which is what keeps it off
  /// the hot path: an ordinary server game is recognised from the snapshot the
  /// socket already delivered, and costs no request at all. It is also what
  /// breaks the cycle, since the engine reads the record and the record must not
  /// read the engine.
  ///
  /// Also how a diverged record recovers: the local copy is dropped and the
  /// server's is pulled in its place, which is the only reconciliation there is
  /// once the two have committed different moves at the same version.
  ///
  /// Four things are checked before anything is pulled, because a record this
  /// build cannot play is worse than no record: the game must be local-origin,
  /// the caller must be its creator, this build must ship a local unit for its
  /// version, and it must ship a brain for every bot on the roster. A bot added
  /// in a later release is the realistic case, and it leaves the game readable
  /// here rather than stuck waiting for a move that can never come.
  LocalGameCatchUpProvider._({
    required LocalGameCatchUpFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'localGameCatchUpProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$localGameCatchUpHash();

  @override
  String toString() {
    return r'localGameCatchUpProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<LocalGameRecord?> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<LocalGameRecord?> create(Ref ref) {
    final argument = this.argument as String;
    return localGameCatchUp(ref, gameId: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is LocalGameCatchUpProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$localGameCatchUpHash() => r'e5c949836ce6b853dc68096c461c27d36af04503';

/// Brings a local game this device does not hold onto this device.
///
/// The second half of resume (decision 0012): a game played on a phone is
/// visible from a tablet once it has synchronized, and this is what makes it
/// playable there. It reads the record the server kept, re-derives every seat's
/// frame through this build's own rules, and saves it, after which
/// [localGameRecordProvider] finds it and the session switches to the engine.
///
/// Driven by the session rather than by the store, which is what keeps it off
/// the hot path: an ordinary server game is recognised from the snapshot the
/// socket already delivered, and costs no request at all. It is also what
/// breaks the cycle, since the engine reads the record and the record must not
/// read the engine.
///
/// Also how a diverged record recovers: the local copy is dropped and the
/// server's is pulled in its place, which is the only reconciliation there is
/// once the two have committed different moves at the same version.
///
/// Four things are checked before anything is pulled, because a record this
/// build cannot play is worse than no record: the game must be local-origin,
/// the caller must be its creator, this build must ship a local unit for its
/// version, and it must ship a brain for every bot on the roster. A bot added
/// in a later release is the realistic case, and it leaves the game readable
/// here rather than stuck waiting for a move that can never come.

final class LocalGameCatchUpFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<LocalGameRecord?>, String> {
  LocalGameCatchUpFamily._()
    : super(
        retry: null,
        name: r'localGameCatchUpProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// Brings a local game this device does not hold onto this device.
  ///
  /// The second half of resume (decision 0012): a game played on a phone is
  /// visible from a tablet once it has synchronized, and this is what makes it
  /// playable there. It reads the record the server kept, re-derives every seat's
  /// frame through this build's own rules, and saves it, after which
  /// [localGameRecordProvider] finds it and the session switches to the engine.
  ///
  /// Driven by the session rather than by the store, which is what keeps it off
  /// the hot path: an ordinary server game is recognised from the snapshot the
  /// socket already delivered, and costs no request at all. It is also what
  /// breaks the cycle, since the engine reads the record and the record must not
  /// read the engine.
  ///
  /// Also how a diverged record recovers: the local copy is dropped and the
  /// server's is pulled in its place, which is the only reconciliation there is
  /// once the two have committed different moves at the same version.
  ///
  /// Four things are checked before anything is pulled, because a record this
  /// build cannot play is worse than no record: the game must be local-origin,
  /// the caller must be its creator, this build must ship a local unit for its
  /// version, and it must ship a brain for every bot on the roster. A bot added
  /// in a later release is the realistic case, and it leaves the game readable
  /// here rather than stuck waiting for a move that can never come.

  LocalGameCatchUpProvider call({required String gameId}) =>
      LocalGameCatchUpProvider._(argument: gameId, from: this);

  @override
  String toString() => r'localGameCatchUpProvider';
}

/// Whether [gameId] is a game this device played offline.

@ProviderFor(isLocalGame)
final isLocalGameProvider = IsLocalGameFamily._();

/// Whether [gameId] is a game this device played offline.

final class IsLocalGameProvider
    extends $FunctionalProvider<AsyncValue<bool>, bool, FutureOr<bool>>
    with $FutureModifier<bool>, $FutureProvider<bool> {
  /// Whether [gameId] is a game this device played offline.
  IsLocalGameProvider._({
    required IsLocalGameFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'isLocalGameProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$isLocalGameHash();

  @override
  String toString() {
    return r'isLocalGameProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<bool> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<bool> create(Ref ref) {
    final argument = this.argument as String;
    return isLocalGame(ref, gameId: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is IsLocalGameProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$isLocalGameHash() => r'39f0160e51beaadca3162884e975b0a95422ef8f';

/// Whether [gameId] is a game this device played offline.

final class IsLocalGameFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<bool>, String> {
  IsLocalGameFamily._()
    : super(
        retry: null,
        name: r'isLocalGameProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// Whether [gameId] is a game this device played offline.

  IsLocalGameProvider call({required String gameId}) =>
      IsLocalGameProvider._(argument: gameId, from: this);

  @override
  String toString() => r'isLocalGameProvider';
}

/// Local games still playable, newest first.

@ProviderFor(localActiveGames)
final localActiveGamesProvider = LocalActiveGamesProvider._();

/// Local games still playable, newest first.

final class LocalActiveGamesProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<GameSummary>>,
          List<GameSummary>,
          FutureOr<List<GameSummary>>
        >
    with
        $FutureModifier<List<GameSummary>>,
        $FutureProvider<List<GameSummary>> {
  /// Local games still playable, newest first.
  LocalActiveGamesProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'localActiveGamesProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$localActiveGamesHash();

  @$internal
  @override
  $FutureProviderElement<List<GameSummary>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<List<GameSummary>> create(Ref ref) {
    return localActiveGames(ref);
  }
}

String _$localActiveGamesHash() => r'6da91393b23287f38d4a06af44e2373ea100edf5';

/// Local games that have ended, newest finish first.

@ProviderFor(localFinishedGames)
final localFinishedGamesProvider = LocalFinishedGamesProvider._();

/// Local games that have ended, newest finish first.

final class LocalFinishedGamesProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<GameSummary>>,
          List<GameSummary>,
          FutureOr<List<GameSummary>>
        >
    with
        $FutureModifier<List<GameSummary>>,
        $FutureProvider<List<GameSummary>> {
  /// Local games that have ended, newest finish first.
  LocalFinishedGamesProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'localFinishedGamesProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$localFinishedGamesHash();

  @$internal
  @override
  $FutureProviderElement<List<GameSummary>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<List<GameSummary>> create(Ref ref) {
    return localFinishedGames(ref);
  }
}

String _$localFinishedGamesHash() =>
    r'fecc3935ce4ab249515e98e539ee621e5511f553';

/// Whether this build can play any game on the device at all: the local arm of
/// the solo picker's availability.

@ProviderFor(localPlayAvailable)
final localPlayAvailableProvider = LocalPlayAvailableProvider._();

/// Whether this build can play any game on the device at all: the local arm of
/// the solo picker's availability.

final class LocalPlayAvailableProvider
    extends $FunctionalProvider<bool, bool, bool>
    with $Provider<bool> {
  /// Whether this build can play any game on the device at all: the local arm of
  /// the solo picker's availability.
  LocalPlayAvailableProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'localPlayAvailableProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$localPlayAvailableHash();

  @$internal
  @override
  $ProviderElement<bool> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  bool create(Ref ref) {
    return localPlayAvailable(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(bool value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<bool>(value),
    );
  }
}

String _$localPlayAvailableHash() =>
    r'24a793352c370946ef9ed742654cdb8d3346f1e1';

/// Creates and starts a game on the device, and answers with its id.
///
/// No network is involved, which is the whole point: the id, the seed and the
/// opening board are all minted here.

@ProviderFor(createLocalGame)
final createLocalGameProvider = CreateLocalGameProvider._();

/// Creates and starts a game on the device, and answers with its id.
///
/// No network is involved, which is the whole point: the id, the seed and the
/// opening board are all minted here.

final class CreateLocalGameProvider
    extends
        $FunctionalProvider<
          Future<String> Function({
            required List<String> botIds,
            required Map<String, dynamic> config,
          }),
          Future<String> Function({
            required List<String> botIds,
            required Map<String, dynamic> config,
          }),
          Future<String> Function({
            required List<String> botIds,
            required Map<String, dynamic> config,
          })
        >
    with
        $Provider<
          Future<String> Function({
            required List<String> botIds,
            required Map<String, dynamic> config,
          })
        > {
  /// Creates and starts a game on the device, and answers with its id.
  ///
  /// No network is involved, which is the whole point: the id, the seed and the
  /// opening board are all minted here.
  CreateLocalGameProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'createLocalGameProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$createLocalGameHash();

  @$internal
  @override
  $ProviderElement<
    Future<String> Function({
      required List<String> botIds,
      required Map<String, dynamic> config,
    })
  >
  $createElement($ProviderPointer pointer) => $ProviderElement(pointer);

  @override
  Future<String> Function({
    required List<String> botIds,
    required Map<String, dynamic> config,
  })
  create(Ref ref) {
    return createLocalGame(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(
    Future<String> Function({
      required List<String> botIds,
      required Map<String, dynamic> config,
    })
    value,
  ) {
    return $ProviderOverride(
      origin: this,
      providerOverride:
          $SyncValueProvider<
            Future<String> Function({
              required List<String> botIds,
              required Map<String, dynamic> config,
            })
          >(value),
    );
  }
}

String _$createLocalGameHash() => r'6e82013e272a0917a27580645bf7beaf7d2d5e43';

/// Carries this device's local games to the server, or null when nobody is
/// signed in.

@ProviderFor(localGameSync)
final localGameSyncProvider = LocalGameSyncProvider._();

/// Carries this device's local games to the server, or null when nobody is
/// signed in.

final class LocalGameSyncProvider
    extends
        $FunctionalProvider<
          AsyncValue<LocalGameSync?>,
          LocalGameSync?,
          FutureOr<LocalGameSync?>
        >
    with $FutureModifier<LocalGameSync?>, $FutureProvider<LocalGameSync?> {
  /// Carries this device's local games to the server, or null when nobody is
  /// signed in.
  LocalGameSyncProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'localGameSyncProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$localGameSyncHash();

  @$internal
  @override
  $FutureProviderElement<LocalGameSync?> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<LocalGameSync?> create(Ref ref) {
    return localGameSync(ref);
  }
}

String _$localGameSyncHash() => r'a03cbecf6d7663d5e7628c496be7542c339a9e1f';

/// Runs synchronization when there is reason to, and holds what the last pass
/// found.
///
/// Three reasons, and they are the three moments a pass can newly succeed:
/// somebody signs in, the device regains connectivity, and a local game
/// finishes. Nothing here blocks play: the coordinator's own state is the
/// report, and a failed pass simply leaves work for the next one.

@ProviderFor(LocalSyncCoordinator)
final localSyncCoordinatorProvider = LocalSyncCoordinatorProvider._();

/// Runs synchronization when there is reason to, and holds what the last pass
/// found.
///
/// Three reasons, and they are the three moments a pass can newly succeed:
/// somebody signs in, the device regains connectivity, and a local game
/// finishes. Nothing here blocks play: the coordinator's own state is the
/// report, and a failed pass simply leaves work for the next one.
final class LocalSyncCoordinatorProvider
    extends $NotifierProvider<LocalSyncCoordinator, LocalSyncReport?> {
  /// Runs synchronization when there is reason to, and holds what the last pass
  /// found.
  ///
  /// Three reasons, and they are the three moments a pass can newly succeed:
  /// somebody signs in, the device regains connectivity, and a local game
  /// finishes. Nothing here blocks play: the coordinator's own state is the
  /// report, and a failed pass simply leaves work for the next one.
  LocalSyncCoordinatorProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'localSyncCoordinatorProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$localSyncCoordinatorHash();

  @$internal
  @override
  LocalSyncCoordinator create() => LocalSyncCoordinator();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(LocalSyncReport? value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<LocalSyncReport?>(value),
    );
  }
}

String _$localSyncCoordinatorHash() =>
    r'6784310a9f411ee3195b7eb5da149eca7d299cf9';

/// Runs synchronization when there is reason to, and holds what the last pass
/// found.
///
/// Three reasons, and they are the three moments a pass can newly succeed:
/// somebody signs in, the device regains connectivity, and a local game
/// finishes. Nothing here blocks play: the coordinator's own state is the
/// report, and a failed pass simply leaves work for the next one.

abstract class _$LocalSyncCoordinator extends $Notifier<LocalSyncReport?> {
  LocalSyncReport? build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<LocalSyncReport?, LocalSyncReport?>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<LocalSyncReport?, LocalSyncReport?>,
              LocalSyncReport?,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}

/// How to command one game, resolved once from where it is played.

@ProviderFor(gameCommands)
final gameCommandsProvider = GameCommandsFamily._();

/// How to command one game, resolved once from where it is played.

final class GameCommandsProvider
    extends
        $FunctionalProvider<
          AsyncValue<GameCommands>,
          GameCommands,
          FutureOr<GameCommands>
        >
    with $FutureModifier<GameCommands>, $FutureProvider<GameCommands> {
  /// How to command one game, resolved once from where it is played.
  GameCommandsProvider._({
    required GameCommandsFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'gameCommandsProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$gameCommandsHash();

  @override
  String toString() {
    return r'gameCommandsProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<GameCommands> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<GameCommands> create(Ref ref) {
    final argument = this.argument as String;
    return gameCommands(ref, gameId: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is GameCommandsProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$gameCommandsHash() => r'053be1aa57777159dd2515eb36ce6ea3d62abb54';

/// How to command one game, resolved once from where it is played.

final class GameCommandsFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<GameCommands>, String> {
  GameCommandsFamily._()
    : super(
        retry: null,
        name: r'gameCommandsProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// How to command one game, resolved once from where it is played.

  GameCommandsProvider call({required String gameId}) =>
      GameCommandsProvider._(argument: gameId, from: this);

  @override
  String toString() => r'gameCommandsProvider';
}
