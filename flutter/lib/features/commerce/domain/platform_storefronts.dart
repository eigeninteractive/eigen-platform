import 'package:eigen_flutter/features/commerce/domain/purchase_gateway.dart';
import 'package:flutter/foundation.dart';

/// The storefronts this build carries on the platform it is running on.
///
/// Where an app may take payment depends on who distributes it, so this is
/// the routing decision for the platforms the engine has storefronts for.
/// Give the result to `storefrontsProvider` at the composition root:
///
/// ```dart
/// storefrontsProvider.overrideWithValue(
///   platformStorefronts(
///     android: [PlayPurchaseGateway()],
///     web: [
///       StripeHostedStorefront(
///         returnUrl: Uri.parse('https://yourgame.example/store/return'),
///         launcher: const UrlLauncherCheckout(),
///       ),
///     ],
///   ),
/// )
/// ```
///
/// - [android] is for the Android app. Google Play requires its own billing
///   for digital goods in an app it distributes.
/// - [web] is for the web build on any device: a page in a browser is no app
///   store's to bill.
/// - [desktop] is for Windows and Linux builds.
///
/// iOS and macOS get none, so the store does not appear there. Apple requires
/// its own in-app purchase for digital goods sold in an app it distributes,
/// and there is no App Store storefront yet; a hosted checkout in its place
/// is grounds for rejecting the app.
List<Storefront> platformStorefronts({
  List<Storefront> android = const [],
  List<Storefront> web = const [],
  List<Storefront> desktop = const [],
  @visibleForTesting bool isWeb = kIsWeb,
}) {
  if (isWeb) return web;
  return switch (defaultTargetPlatform) {
    TargetPlatform.android => android,
    TargetPlatform.windows || TargetPlatform.linux => desktop,
    TargetPlatform.iOS ||
    TargetPlatform.macOS ||
    TargetPlatform.fuchsia => const [],
  };
}
