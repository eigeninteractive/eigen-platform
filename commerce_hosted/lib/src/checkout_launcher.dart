import 'package:eigen_flutter/adapters.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens a provider's checkout page.
///
/// Separate from the storefronts so a test can watch what would have been
/// opened without a browser, and so an application that wants an in-app web
/// view rather than an external browser can supply one.
abstract interface class CheckoutLauncher {
  /// Opens [checkoutUrl], leaving this app.
  ///
  /// Returns false when the platform refused to open it at all, which is the
  /// one outcome distinguishable from "the player is now on the provider's
  /// page"; everything after that is only knowable from the return URL.
  Future<bool> open(Uri checkoutUrl);
}

/// The default: hand the URL to the platform browser.
///
/// On the web this replaces the current page, so the app is unloaded and the
/// return is an ordinary cold start. On Android and iOS it opens an external
/// browser and the app stays alive until the return URL, an App Link or
/// Universal Link, routes back in.
class UrlLauncherCheckout implements CheckoutLauncher {
  const UrlLauncherCheckout();

  @override
  Future<bool> open(Uri checkoutUrl) => launchUrl(
    checkoutUrl,
    mode: LaunchMode.externalApplication,
    // Replace rather than open a tab: a popup is blocked unless the gesture is
    // recognized as one, and a checkout that silently fails to open is worse
    // than one that takes the page.
    webOnlyWindowName: '_self',
  );
}

/// Shared shape of a storefront whose purchase happens on a provider's page.
///
/// The two below differ only in which query parameters their provider brings
/// back and what the Worker's matching adapter expects as evidence.
abstract base class HostedCheckoutStorefront implements HostedStorefront {
  const HostedCheckoutStorefront({
    required this.returnUrl,
    this.launcher = const UrlLauncherCheckout(),
  });

  @override
  final Uri returnUrl;

  final CheckoutLauncher launcher;

  /// What [uri] reports, given it is a return to this storefront for
  /// [offerKey]. Null when the URL belongs to some other provider.
  PurchaseUpdate? recognize(Uri uri, String offerKey);

  @override
  Future<PurchaseUpdate> present(
    Uri checkoutUrl, {
    required String offerKey,
    required String providerReference,
  }) async {
    final opened = await launcher.open(checkoutUrl);
    // On the web the page is already gone and nothing reads this. Where it is
    // read, `pending` is the truth: the player is on the provider's page, and
    // only the return says what happened there.
    return PurchaseUpdate(
      offerKey: offerKey,
      providerReference: providerReference,
      state: opened ? PurchaseUpdateState.pending : PurchaseUpdateState.failed,
      error: opened ? null : StateError('Could not open $checkoutUrl.'),
    );
  }

  @override
  PurchaseUpdate? resume(Uri uri) {
    if (uri.origin != returnUrl.origin) return null;
    if (uri.path != returnUrl.path) return null;
    final offerKey = uri.queryParameters[hostedOfferQueryParameter];
    // Not a return from a checkout this app started. An app's own deep links
    // arrive here too, and they are not purchases.
    if (offerKey == null) return null;
    return recognize(uri, offerKey);
  }
}
