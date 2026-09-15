import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/api/engine_api_providers.dart';
import 'package:eigen_flutter/features/commerce/data/commerce_service.dart';
import 'package:eigen_flutter/features/commerce/data/drift_purchase_delivery_store.dart';
import 'package:eigen_flutter/features/commerce/domain/purchase_gateway.dart';
import 'package:eigen_flutter/core/storage/storage_provider.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'commerce_providers.g.dart';

/// The storefronts this build can buy through, in preference order.
///
/// Empty by default: a game that sells nothing overrides nothing. A commerce
/// application overrides this at its composition root with the storefronts its
/// platform allows — typically a [PurchaseGateway] for the store SDK on
/// Android, and a [HostedStorefront] per merchant account on the web. There is
/// no server-side routing policy, so this list is the decision, and changing
/// it is an app release.
@Riverpod(keepAlive: true)
List<Storefront> storefronts(Ref ref) => const [];

/// Pure-Dart access to the Worker's commerce API.
@Riverpod(keepAlive: true)
CommerceRepository commerceRepository(Ref ref) =>
    CommerceRepository(ref.watch(engineDioProvider));

/// Provider-neutral coordinator joining storefront updates to server
/// verification.
@Riverpod(keepAlive: true)
CommerceService commerceService(Ref ref) {
  final service = CommerceService(
    ref.watch(commerceRepositoryProvider),
    ref.watch(storefrontsProvider),
    DriftPurchaseDeliveryStore(ref.watch(localDatabaseProvider.future)),
  );
  ref.onDispose(service.dispose);
  return service;
}
