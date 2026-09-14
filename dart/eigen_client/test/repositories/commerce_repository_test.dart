import 'dart:convert';
import 'dart:typed_data';

import 'package:checks/checks.dart';
import 'package:dio/dio.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

Map<String, Object?> _accessJson() => {
  'entitlements': [
    {'key': 'supporter', 'validFrom': 1000, 'validUntil': null},
  ],
  'permissions': [
    {'kind': 'game.create', 'access': 'public'},
  ],
  'content': [
    {'collection': 'board_theme', 'id': 'supporter_gold'},
  ],
  'limits': [
    {
      'metric': 'game.create.success',
      'maximum': 5,
      'noCommercialLimit': false,
      'period': 'calendarMonth',
      'used': 2,
      'remaining': 3,
      'resetsAt': 2000,
    },
  ],
};

class _CommerceAdapter implements HttpClientAdapter {
  RequestOptions? lastRequest;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastRequest = options;
    final Object body = switch (options.path) {
      '/api/engine/commerce/catalog' => {
        'offers': [
          {
            'key': 'supporter',
            'name': 'Supporter',
            'description': 'Permanent cosmetics',
            'kind': 'oneTime',
            'entitlements': ['supporter'],
            'products': [
              {
                'provider': 'google_play',
                'providerReference': 'supporter_once',
                'displayPrice': r'$4.99',
                'currencyCode': 'USD',
              },
            ],
          },
        ],
      },
      '/api/engine/commerce/checkout' => {
        'url': 'https://checkout.example/session',
      },
      '/api/engine/commerce/management' => {
        'url': 'https://billing.example/portal',
      },
      _ => _accessJson(),
    };
    return ResponseBody.fromString(
      jsonEncode(body),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late _CommerceAdapter adapter;
  late CommerceRepository repository;

  setUp(() {
    adapter = _CommerceAdapter();
    final dio = Dio(BaseOptions(baseUrl: 'https://engine.test'))
      ..httpClientAdapter = adapter;
    repository = CommerceRepository(dio);
  });

  test('reads provider-localized catalog data', () async {
    final catalog = await repository.getCatalog();

    check(catalog.offers.single.key).equals('supporter');
    check(catalog.offers.single.kind).equals(CommerceOfferKindEnum.oneTime);
    check(catalog.offers.single.products.single.displayPrice).equals(r'$4.99');
  });

  test('reads typed capabilities, content, and usage', () async {
    final access = await repository.getAccess();

    check(access.entitlements.single.key).equals('supporter');
    check(
      access.permissions.single.kind,
    ).equals(AccessCapabilityKindEnum.gamePeriodCreate);
    check(
      access.permissions.single.access,
    ).equals(AccessCapabilityAccessEnum.public);
    check(access.content.single.id).equals('supporter_gold');
    check(access.limits.single.remaining).equals(3);
    check(
      access.limits.single.period,
    ).equals(CommercialPeriodKind.calendarMonth);
  });

  test(
    'submits opaque evidence and trusts the returned access snapshot',
    () async {
      final access = await repository.claim(
        const CommercePurchaseClaim(
          provider: 'google_play',
          offerKey: 'supporter',
          evidence: {'purchaseToken': 'secret-token'},
        ),
      );

      check(access.entitlements.single.key).equals('supporter');
      final request = jsonDecode(adapter.lastRequest?.data as String) as Map;
      check(request['provider']).equals('google_play');
      check(
        (request['evidence'] as Map)['purchaseToken'],
      ).equals('secret-token');
    },
  );

  test('rejects an empty restoration before making a request', () async {
    check(() => repository.restore(const [])).throws<ArgumentError>();
  });

  test('creates typed hosted checkout and management URLs', () async {
    final checkout = await repository.createCheckout(
      provider: 'stripe',
      offerKey: 'pro_monthly',
      returnUrl: Uri.parse('https://game.example/store'),
    );
    check(checkout).equals(Uri.parse('https://checkout.example/session'));
    final checkoutRequest =
        jsonDecode(adapter.lastRequest?.data as String) as Map;
    check(checkoutRequest['provider']).equals('stripe');
    check(checkoutRequest['offerKey']).equals('pro_monthly');
    check(checkoutRequest['returnUrl']).equals('https://game.example/store');

    final management = await repository.createManagement(
      provider: 'stripe',
      returnUrl: Uri.parse('https://game.example/account'),
    );
    check(management).equals(Uri.parse('https://billing.example/portal'));
    final managementRequest =
        jsonDecode(adapter.lastRequest?.data as String) as Map;
    check(managementRequest['provider']).equals('stripe');
    check(
      managementRequest['returnUrl'],
    ).equals('https://game.example/account');
  });
}
