import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_shell/features/store/presentation/screens/store_screen.dart';
import 'package:eigen_shell/features/store/providers/store_providers.dart';
import 'package:eigen_shell/shared/widgets/refusal_snack_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

CommerceCatalog _catalog() => CommerceCatalog.fromJson({
  'offers': [
    {
      'key': 'supporter',
      'name': 'Supporter',
      'description': 'Permanent cosmetics',
      'kind': 'oneTime',
      'entitlements': ['supporter'],
      'repeatable': false,
      'products': [
        {
          'provider': 'stripe',
          'providerReference': 'price_supporter',
          'displayPrice': r'$4.99',
          'currencyCode': 'USD',
        },
      ],
    },
    {
      'key': 'android_only',
      'name': 'Android only',
      'description': 'Sold elsewhere',
      'kind': 'oneTime',
      'entitlements': ['extra'],
      'repeatable': false,
      'products': <Object>[],
    },
  ],
});

AccessSnapshot _access() => AccessSnapshot.fromJson({
  'entitlements': [
    {'key': 'supporter', 'validFrom': 1000, 'validUntil': null},
  ],
  'permissions': <Object>[],
  'content': <Object>[],
  'limits': [
    {
      'metric': 'game.create.success',
      'maximum': 20,
      'noCommercialLimit': false,
      'period': 'calendarMonth',
      'used': 3,
      'remaining': 17,
      'resetsAt': null,
    },
  ],
});

Future<void> _pump(
  WidgetTester tester, {
  required List<Override> overrides,
  Widget? child,
}) async {
  final router = GoRouter(
    initialLocation: '/store',
    routes: [
      GoRoute(
        path: '/store',
        name: 'store',
        builder: (context, state) =>
            Scaffold(body: child ?? const StoreScreen()),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('says so plainly when the app sells nothing', (tester) async {
    await _pump(tester, overrides: const []);

    expect(find.text('There is nothing for sale in this app.'), findsOneWidget);
  });

  testWidgets('shows what is held, what it costs, and what it is spending', (
    tester,
  ) async {
    await _pump(
      tester,
      overrides: [
        storeAvailableProvider.overrideWithValue(true),
        storeCatalogProvider.overrideWith((ref) async => _catalog()),
        storeAccessProvider.overrideWith((ref) async => _access()),
        storeProductsProvider.overrideWith((ref) async => const {}),
      ],
    );

    // The entitlement is named by the offer that grants it, not by its engine
    // key: that is the name the player saw when they bought it.
    expect(find.text('Supporter'), findsNWidgets(2));
    // The catalog's own price, because a hosted storefront has no SDK to ask.
    expect(find.text(r'$4.99'), findsOneWidget);
    // Engine vocabulary belongs in a policy, not on a screen.
    expect(find.text('Games created'), findsOneWidget);
    expect(find.text('3 of 20 used'), findsOneWidget);
  });

  testWidgets('offers no way to buy what this build cannot sell', (
    tester,
  ) async {
    await _pump(
      tester,
      overrides: [
        storeAvailableProvider.overrideWithValue(true),
        storeCatalogProvider.overrideWith((ref) async => _catalog()),
        storeAccessProvider.overrideWith((ref) async => _access()),
        storeProductsProvider.overrideWith((ref) async => const {}),
      ],
    );

    // Listed, because the offer exists; unbuyable, because no storefront here
    // sells it. Hiding it would leave a player unable to explain the gap.
    expect(find.text('Android only'), findsOneWidget);
    final unavailable = tester.widget<FilledButton>(
      find.ancestor(
        of: find.text('Unavailable'),
        matching: find.byType(FilledButton),
      ),
    );
    expect(unavailable.onPressed, isNull);
  });

  group('the upgrade call to action', () {
    Widget probe(Object error) => Builder(
      builder: (context) => Consumer(
        builder: (context, ref, _) => TextButton(
          onPressed: () => showRefusal(context, ref, error),
          child: const Text('go'),
        ),
      ),
    );

    testWidgets('offers the store for a refusal a purchase can lift', (
      tester,
    ) async {
      await _pump(
        tester,
        overrides: [storeAvailableProvider.overrideWithValue(true)],
        child: probe(
          const EngineException('nope', code: ErrorCode.capabilityRequired),
        ),
      );
      await tester.tap(find.text('go'));
      await tester.pump();

      expect(find.text('See options'), findsOneWidget);
    });

    testWidgets('does not for one it cannot', (tester) async {
      // Already paid, only waiting. Inviting another purchase would be asking
      // someone to pay twice for the same thing.
      await _pump(
        tester,
        overrides: [storeAvailableProvider.overrideWithValue(true)],
        child: probe(
          const EngineException('wait', code: ErrorCode.purchasePending),
        ),
      );
      await tester.tap(find.text('go'));
      await tester.pump();

      expect(find.text('See options'), findsNothing);
    });

    testWidgets('never advertises a store this build does not have', (
      tester,
    ) async {
      await _pump(
        tester,
        overrides: const [],
        child: probe(
          const EngineException('nope', code: ErrorCode.capabilityRequired),
        ),
      );
      await tester.tap(find.text('go'));
      await tester.pump();

      expect(find.text('See options'), findsNothing);
    });
  });
}
