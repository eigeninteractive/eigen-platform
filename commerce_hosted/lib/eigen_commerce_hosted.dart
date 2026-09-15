/// Provider-hosted checkout as EigenInteractive storefronts.
///
/// Optional: a game that sells only through a store SDK never depends on this
/// package. Stripe and Razorpay both run the purchase on their own page, so
/// neither needs a payment SDK on the device — a URL and a browser is the whole
/// client integration, and card data never reaches this process.
library;

export 'src/checkout_launcher.dart';
export 'src/razorpay_storefront.dart';
export 'src/stripe_storefront.dart';
