import 'package:eigen_flutter/shell_support.dart';
import 'package:url_launcher/url_launcher.dart';

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
