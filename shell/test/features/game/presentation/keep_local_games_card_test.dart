import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/features/game/presentation/widgets/keep_local_games_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// The offer, without a browser: [offered] is what the app decided to ask, and
/// [decision] is what the browser would answer.
class _FakeKeepLocalGames extends KeepLocalGames {
  _FakeKeepLocalGames({
    required this.offered,
    this.decision = StoragePersistence.granted,
  });

  final bool offered;
  final StoragePersistence decision;
  var asked = 0;
  var dismissed = 0;

  @override
  Future<bool> build() async => offered;

  @override
  Future<StoragePersistence> keep() async {
    asked++;
    state = const AsyncData(false);
    return decision;
  }

  @override
  Future<void> dismiss() async {
    dismissed++;
    state = const AsyncData(false);
  }
}

Widget _app(_FakeKeepLocalGames offer) => ProviderScope(
  overrides: [keepLocalGamesProvider.overrideWith(() => offer)],
  child: const MaterialApp(home: Scaffold(body: KeepLocalGamesCard())),
);

void main() {
  testWidgets('explains what it is for before the browser asks', (
    tester,
  ) async {
    await tester.pumpWidget(_app(_FakeKeepLocalGames(offered: true)));
    await tester.pump();

    expect(find.text('Keep your offline games'), findsOneWidget);
    expect(
      find.textContaining('only on this device until it uploads'),
      findsOneWidget,
    );
    expect(find.text('Keep them'), findsOneWidget);
  });

  testWidgets('asks the browser when the player accepts', (tester) async {
    final offer = _FakeKeepLocalGames(offered: true);
    await tester.pumpWidget(_app(offer));
    await tester.pump();

    await tester.tap(find.text('Keep them'));
    await tester.pumpAndSettle();

    expect(offer.asked, 1);
    expect(find.text('Keep them'), findsNothing);
  });

  testWidgets('a browser that refuses says what that means', (tester) async {
    final offer = _FakeKeepLocalGames(
      offered: true,
      decision: StoragePersistence.refused,
    );
    await tester.pumpWidget(_app(offer));
    await tester.pump();

    await tester.tap(find.text('Keep them'));
    await tester.pumpAndSettle();

    expect(find.textContaining("didn't allow it"), findsOneWidget);
  });

  testWidgets('declining asks nothing and leaves the card', (tester) async {
    final offer = _FakeKeepLocalGames(offered: true);
    await tester.pumpWidget(_app(offer));
    await tester.pump();

    await tester.tap(find.text('Not now'));
    await tester.pumpAndSettle();

    expect(offer.dismissed, 1);
    expect(offer.asked, 0);
    expect(find.text('Not now'), findsNothing);
  });

  testWidgets('shows nothing where there is nothing to offer', (tester) async {
    await tester.pumpWidget(_app(_FakeKeepLocalGames(offered: false)));
    await tester.pump();

    expect(find.text('Keep your offline games'), findsNothing);
  });
}
