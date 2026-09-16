// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_game_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
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

/// The engine driving one local game, or null when this device does not decide
/// the game.
///
/// Keyed by game id and kept alive, so leaving the screen and returning resumes
/// the same serialized queue rather than opening a second engine over the same
/// rows. A local game whose version this build no longer ships a local unit for
/// fails here, exactly as a server game with an unsupported schema does.

@ProviderFor(localGameEngine)
final localGameEngineProvider = LocalGameEngineFamily._();

/// The engine driving one local game, or null when this device does not decide
/// the game.
///
/// Keyed by game id and kept alive, so leaving the screen and returning resumes
/// the same serialized queue rather than opening a second engine over the same
/// rows. A local game whose version this build no longer ships a local unit for
/// fails here, exactly as a server game with an unsupported schema does.

final class LocalGameEngineProvider
    extends
        $FunctionalProvider<
          AsyncValue<LocalGameEngine?>,
          LocalGameEngine?,
          FutureOr<LocalGameEngine?>
        >
    with $FutureModifier<LocalGameEngine?>, $FutureProvider<LocalGameEngine?> {
  /// The engine driving one local game, or null when this device does not decide
  /// the game.
  ///
  /// Keyed by game id and kept alive, so leaving the screen and returning resumes
  /// the same serialized queue rather than opening a second engine over the same
  /// rows. A local game whose version this build no longer ships a local unit for
  /// fails here, exactly as a server game with an unsupported schema does.
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

String _$localGameEngineHash() => r'51cc55c64dc769695007d2b726893a5b13e778fd';

/// The engine driving one local game, or null when this device does not decide
/// the game.
///
/// Keyed by game id and kept alive, so leaving the screen and returning resumes
/// the same serialized queue rather than opening a second engine over the same
/// rows. A local game whose version this build no longer ships a local unit for
/// fails here, exactly as a server game with an unsupported schema does.

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

  /// The engine driving one local game, or null when this device does not decide
  /// the game.
  ///
  /// Keyed by game id and kept alive, so leaving the screen and returning resumes
  /// the same serialized queue rather than opening a second engine over the same
  /// rows. A local game whose version this build no longer ships a local unit for
  /// fails here, exactly as a server game with an unsupported schema does.

  LocalGameEngineProvider call({required String gameId}) =>
      LocalGameEngineProvider._(argument: gameId, from: this);

  @override
  String toString() => r'localGameEngineProvider';
}

/// Brings a local game this device does not hold onto this device.
///
/// The second half of resume (decision 0012): a game played on a phone is
/// visible from a tablet once it has synchronized, and this is what makes it
/// playable there. It reads the log the server kept, re-derives the human's
/// frames through this build's own rules, and writes it to the replica, after
/// which [localGameEngineProvider] finds it and the session switches to the
/// engine.
///
/// Driven by the session rather than by the replica, which is what keeps it off
/// the hot path: an ordinary server game is recognised from the snapshot the
/// session already delivered, and costs no request at all. It is also what
/// breaks the cycle, since the engine reads the replica and the replica must not
/// read the engine.
///
/// Also how a diverged game recovers: the local copy is dropped and the server's
/// is pulled in its place, which is the only reconciliation there is once the
/// two have committed different moves at the same version.
///
/// Four things are checked before anything is pulled, because a game this build
/// cannot play is worse than no game: the game must be local-origin, the caller
/// must be its creator, this build must ship a local unit for its version, and
/// it must ship a brain for every bot on the roster. A bot added in a later
/// release is the realistic case, and it leaves the game readable here rather
/// than stuck waiting for a move that can never come.

@ProviderFor(localGameCatchUp)
final localGameCatchUpProvider = LocalGameCatchUpFamily._();

/// Brings a local game this device does not hold onto this device.
///
/// The second half of resume (decision 0012): a game played on a phone is
/// visible from a tablet once it has synchronized, and this is what makes it
/// playable there. It reads the log the server kept, re-derives the human's
/// frames through this build's own rules, and writes it to the replica, after
/// which [localGameEngineProvider] finds it and the session switches to the
/// engine.
///
/// Driven by the session rather than by the replica, which is what keeps it off
/// the hot path: an ordinary server game is recognised from the snapshot the
/// session already delivered, and costs no request at all. It is also what
/// breaks the cycle, since the engine reads the replica and the replica must not
/// read the engine.
///
/// Also how a diverged game recovers: the local copy is dropped and the server's
/// is pulled in its place, which is the only reconciliation there is once the
/// two have committed different moves at the same version.
///
/// Four things are checked before anything is pulled, because a game this build
/// cannot play is worse than no game: the game must be local-origin, the caller
/// must be its creator, this build must ship a local unit for its version, and
/// it must ship a brain for every bot on the roster. A bot added in a later
/// release is the realistic case, and it leaves the game readable here rather
/// than stuck waiting for a move that can never come.

final class LocalGameCatchUpProvider
    extends
        $FunctionalProvider<
          AsyncValue<LocalGame?>,
          LocalGame?,
          FutureOr<LocalGame?>
        >
    with $FutureModifier<LocalGame?>, $FutureProvider<LocalGame?> {
  /// Brings a local game this device does not hold onto this device.
  ///
  /// The second half of resume (decision 0012): a game played on a phone is
  /// visible from a tablet once it has synchronized, and this is what makes it
  /// playable there. It reads the log the server kept, re-derives the human's
  /// frames through this build's own rules, and writes it to the replica, after
  /// which [localGameEngineProvider] finds it and the session switches to the
  /// engine.
  ///
  /// Driven by the session rather than by the replica, which is what keeps it off
  /// the hot path: an ordinary server game is recognised from the snapshot the
  /// session already delivered, and costs no request at all. It is also what
  /// breaks the cycle, since the engine reads the replica and the replica must not
  /// read the engine.
  ///
  /// Also how a diverged game recovers: the local copy is dropped and the server's
  /// is pulled in its place, which is the only reconciliation there is once the
  /// two have committed different moves at the same version.
  ///
  /// Four things are checked before anything is pulled, because a game this build
  /// cannot play is worse than no game: the game must be local-origin, the caller
  /// must be its creator, this build must ship a local unit for its version, and
  /// it must ship a brain for every bot on the roster. A bot added in a later
  /// release is the realistic case, and it leaves the game readable here rather
  /// than stuck waiting for a move that can never come.
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
  $FutureProviderElement<LocalGame?> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<LocalGame?> create(Ref ref) {
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

String _$localGameCatchUpHash() => r'6fa448f4c874bae9f5c2c86cebb09fdb10f46f41';

/// Brings a local game this device does not hold onto this device.
///
/// The second half of resume (decision 0012): a game played on a phone is
/// visible from a tablet once it has synchronized, and this is what makes it
/// playable there. It reads the log the server kept, re-derives the human's
/// frames through this build's own rules, and writes it to the replica, after
/// which [localGameEngineProvider] finds it and the session switches to the
/// engine.
///
/// Driven by the session rather than by the replica, which is what keeps it off
/// the hot path: an ordinary server game is recognised from the snapshot the
/// session already delivered, and costs no request at all. It is also what
/// breaks the cycle, since the engine reads the replica and the replica must not
/// read the engine.
///
/// Also how a diverged game recovers: the local copy is dropped and the server's
/// is pulled in its place, which is the only reconciliation there is once the
/// two have committed different moves at the same version.
///
/// Four things are checked before anything is pulled, because a game this build
/// cannot play is worse than no game: the game must be local-origin, the caller
/// must be its creator, this build must ship a local unit for its version, and
/// it must ship a brain for every bot on the roster. A bot added in a later
/// release is the realistic case, and it leaves the game readable here rather
/// than stuck waiting for a move that can never come.

final class LocalGameCatchUpFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<LocalGame?>, String> {
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
  /// playable there. It reads the log the server kept, re-derives the human's
  /// frames through this build's own rules, and writes it to the replica, after
  /// which [localGameEngineProvider] finds it and the session switches to the
  /// engine.
  ///
  /// Driven by the session rather than by the replica, which is what keeps it off
  /// the hot path: an ordinary server game is recognised from the snapshot the
  /// session already delivered, and costs no request at all. It is also what
  /// breaks the cycle, since the engine reads the replica and the replica must not
  /// read the engine.
  ///
  /// Also how a diverged game recovers: the local copy is dropped and the server's
  /// is pulled in its place, which is the only reconciliation there is once the
  /// two have committed different moves at the same version.
  ///
  /// Four things are checked before anything is pulled, because a game this build
  /// cannot play is worse than no game: the game must be local-origin, the caller
  /// must be its creator, this build must ship a local unit for its version, and
  /// it must ship a brain for every bot on the roster. A bot added in a later
  /// release is the realistic case, and it leaves the game readable here rather
  /// than stuck waiting for a move that can never come.

  LocalGameCatchUpProvider call({required String gameId}) =>
      LocalGameCatchUpProvider._(argument: gameId, from: this);

  @override
  String toString() => r'localGameCatchUpProvider';
}

/// Whether [gameId] is a game this device decides.

@ProviderFor(isLocalGame)
final isLocalGameProvider = IsLocalGameFamily._();

/// Whether [gameId] is a game this device decides.

final class IsLocalGameProvider
    extends $FunctionalProvider<AsyncValue<bool>, bool, FutureOr<bool>>
    with $FutureModifier<bool>, $FutureProvider<bool> {
  /// Whether [gameId] is a game this device decides.
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

String _$isLocalGameHash() => r'6451be29e92b1aba3cccea584953ae01f9340502';

/// Whether [gameId] is a game this device decides.

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

  /// Whether [gameId] is a game this device decides.

  IsLocalGameProvider call({required String gameId}) =>
      IsLocalGameProvider._(argument: gameId, from: this);

  @override
  String toString() => r'isLocalGameProvider';
}

/// Whether this build can play any game on the device at all: the local arm of
/// the solo picker's availability.
///
/// False where the device keeps nothing across a restart, which only a browser
/// with no storage at all reports: a game played there would be lost with the
/// page. Storage that has not answered yet is not that, so the picker is
/// offered while it resolves rather than flickering.

@ProviderFor(localPlayAvailable)
final localPlayAvailableProvider = LocalPlayAvailableProvider._();

/// Whether this build can play any game on the device at all: the local arm of
/// the solo picker's availability.
///
/// False where the device keeps nothing across a restart, which only a browser
/// with no storage at all reports: a game played there would be lost with the
/// page. Storage that has not answered yet is not that, so the picker is
/// offered while it resolves rather than flickering.

final class LocalPlayAvailableProvider
    extends $FunctionalProvider<bool, bool, bool>
    with $Provider<bool> {
  /// Whether this build can play any game on the device at all: the local arm of
  /// the solo picker's availability.
  ///
  /// False where the device keeps nothing across a restart, which only a browser
  /// with no storage at all reports: a game played there would be lost with the
  /// page. Storage that has not answered yet is not that, so the picker is
  /// offered while it resolves rather than flickering.
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
    r'd0afbe507b80da04523f656fe6820da176bbf161';

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

String _$createLocalGameHash() => r'19ced586ece86d3af675ca428717baab332f50c4';

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
