import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/api/engine_api_providers.dart';
import 'package:eigen_flutter/features/commerce/data/commerce_service.dart';
import 'package:eigen_flutter/features/commerce/data/drift_purchase_delivery_store.dart';
import 'package:eigen_flutter/features/commerce/domain/purchase_gateway.dart';
import 'package:eigen_flutter/core/storage/storage_provider.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'commerce_providers.g.dart';

/// Platform billing boundary. Commerce applications override this provider.
@Riverpod(keepAlive: true)
PurchaseGateway purchaseGateway(Ref ref) => const UnavailablePurchaseGateway();

/// Pure-Dart access to the Worker's commerce API.
@Riverpod(keepAlive: true)
CommerceRepository commerceRepository(Ref ref) =>
    CommerceRepository(ref.watch(engineDioProvider));

/// Provider-neutral coordinator joining SDK updates to server verification.
@Riverpod(keepAlive: true)
CommerceService commerceService(Ref ref) => CommerceService(
  ref.watch(commerceRepositoryProvider),
  ref.watch(purchaseGatewayProvider),
  DriftPurchaseDeliveryStore(ref.watch(localDatabaseProvider.future)),
);
