import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/features/commerce/data/url_launcher_checkout.dart';
import 'package:eigen_shell/features/store/providers/store_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// What the account may do, and what it could buy.
///
/// Everything shown here is the Worker's answer, refetched after any purchase
/// completes. The client mirrors access for presentation and never decides it:
/// an offer that looks bought here is still refused by the server until the
/// server says otherwise.
class StoreScreen extends ConsumerWidget {
  const StoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(storeAvailableProvider)) {
      return const _Empty(message: 'There is nothing for sale in this app.');
    }
    final catalog = ref.watch(storeCatalogProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref
          ..invalidate(storeCatalogProvider)
          ..invalidate(storeAccessProvider);
        await ref.read(storeCatalogProvider.future);
      },
      child: ConstrainedContentPane(
        maxWidth: 720,
        child: catalog.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _Empty(message: humanize(error)),
          data: (data) => ListView(
            padding: const EdgeInsets.symmetric(vertical: 8),
            children: [
              const _AccessSection(),
              const _SectionHeader(title: 'Available'),
              if (data.offers.isEmpty)
                const _Empty(message: 'Nothing is for sale right now.')
              else
                for (final offer in data.offers) _OfferTile(offer: offer),
              const SizedBox(height: 16),
              const _AccountActions(),
            ],
          ),
        ),
      ),
    );
  }
}

/// Entitlements the account holds and allowances it is spending.
class _AccessSection extends ConsumerWidget {
  const _AccessSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final access = ref.watch(storeAccessProvider).value;
    if (access == null) return const SizedBox.shrink();
    final catalog = ref.watch(storeCatalogProvider).value;
    final limits = access.limits
        .where((limit) => limit.remaining != null)
        .toList(growable: false);
    if (access.entitlements.isEmpty && limits.isEmpty) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionHeader(title: 'Your access'),
        Card(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Column(
            children: [
              for (final entitlement in access.entitlements)
                ListTile(
                  leading: const Icon(Icons.verified_outlined),
                  title: Text(_entitlementLabel(entitlement.key, catalog)),
                  subtitle: entitlement.validUntil == null
                      ? const Text('Permanent')
                      : Text(
                          'Renews or ends ${_date(entitlement.validUntil!)}',
                        ),
                ),
              for (final limit in limits)
                ListTile(
                  leading: const Icon(Icons.speed_outlined),
                  title: Text(_metricLabel(limit.metric)),
                  // `used of maximum` rather than a bare remaining count: a
                  // player deciding whether to buy needs to see the ceiling.
                  subtitle: Text('${limit.used} of ${limit.maximum} used'),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

/// One purchasable offer.
class _OfferTile extends ConsumerStatefulWidget {
  const _OfferTile({required this.offer});

  final CommerceOffer offer;

  @override
  ConsumerState<_OfferTile> createState() => _OfferTileState();
}

class _OfferTileState extends ConsumerState<_OfferTile> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final offer = widget.offer;
    final products = ref.watch(storeProductsProvider).value ?? const {};
    final price = _priceOf(offer, products);
    // No product for any storefront this build carries: the offer exists and
    // is not purchasable from here, which is worth saying rather than hiding.
    final sellable = offer.products.isNotEmpty;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        title: Text(offer.name),
        subtitle: Text(
          offer.kind == CommerceOfferKindEnum.subscription
              ? '${offer.description}\nSubscription'
              : offer.description,
        ),
        isThreeLine: offer.kind == CommerceOfferKindEnum.subscription,
        trailing: _busy
            ? const SizedBox.square(
                dimension: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : FilledButton(
                onPressed: sellable ? _buy : null,
                child: Text(price ?? (sellable ? 'Buy' : 'Unavailable')),
              ),
      ),
    );
  }

  Future<void> _buy() async {
    setState(() => _busy = true);
    try {
      final products = await ref.read(storeProductsProvider.future);
      await ref.read(commerceServiceProvider).purchase(widget.offer, products);
    } catch (e) {
      if (mounted) _say(context, humanize(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

/// Restore and manage, which are account-level rather than per-offer.
class _AccountActions extends ConsumerStatefulWidget {
  const _AccountActions();

  @override
  ConsumerState<_AccountActions> createState() => _AccountActionsState();
}

class _AccountActionsState extends ConsumerState<_AccountActions> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Column(
        children: [
          ListTile(
            leading: const Icon(Icons.restore),
            title: const Text('Restore purchases'),
            subtitle: const Text(
              'Recover purchases made on another device or before reinstalling.',
            ),
            enabled: !_busy,
            onTap: _busy ? null : _restore,
          ),
          if (_subscribedThrough() != null) ...[
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.manage_accounts_outlined),
              title: const Text('Manage subscription'),
              subtitle: const Text(
                'Change or cancel your subscription with the provider.',
              ),
              enabled: !_busy,
              onTap: _busy ? null : _manage,
            ),
          ],
        ],
      ),
    );
  }

  /// The storefront that sold the subscription this account is holding, or
  /// null when it holds none this build can speak for.
  ///
  /// Managing is the provider's own screen, so the question is not "does the
  /// account subscribe" but "which storefront's portal answers for it".
  Storefront? _subscribedThrough() {
    final catalog = ref.watch(storeCatalogProvider).value;
    final access = ref.watch(storeAccessProvider).value;
    if (catalog == null || access == null) return null;
    final held = access.entitlements.map((e) => e.key).toSet();
    final storefronts = ref.watch(storefrontsProvider);
    for (final offer in catalog.offers) {
      if (offer.kind != CommerceOfferKindEnum.subscription) continue;
      if (!offer.entitlements.any(held.contains)) continue;
      for (final product in offer.products) {
        for (final storefront in storefronts) {
          if (storefront.provider == product.provider) return storefront;
        }
      }
    }
    return null;
  }

  Future<void> _manage() async {
    final storefront = _subscribedThrough();
    if (storefront == null) return;
    setState(() => _busy = true);
    try {
      // A store SDK owns its own subscription centre and has no server-created
      // portal; asking the Worker for one would be asking for a page that does
      // not exist.
      final url = storefront is HostedStorefront
          ? await ref
                .read(commerceRepositoryProvider)
                .createManagement(
                  provider: storefront.provider,
                  returnUrl: storefront.returnUrl,
                )
          : _playSubscriptions;
      if (!await const UrlLauncherCheckout().open(url) && mounted) {
        _say(context, 'Could not open the subscription page.');
      }
    } catch (e) {
      // Razorpay has no billing portal at all, and the Worker answers plainly
      // rather than inventing one. That answer is the right thing to show.
      if (mounted) _say(context, humanize(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _restore() async {
    setState(() => _busy = true);
    try {
      await ref.read(commerceServiceProvider).restore();
      ref.invalidate(storeAccessProvider);
      if (mounted) _say(context, 'Checking for purchases to restore…');
    } catch (e) {
      if (mounted) _say(context, humanize(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
    child: Text(title, style: Theme.of(context).textTheme.titleMedium),
  );
}

class _Empty extends StatelessWidget {
  const _Empty({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Text(message, textAlign: TextAlign.center),
  );
}

/// The price to show for [offer]: what the store SDK said if one answered for
/// it, and otherwise what the server catalog carries.
String? _priceOf(CommerceOffer offer, Map<String, StoreProduct> products) {
  for (final product in offer.products) {
    final sdk = products['${product.provider}:${product.providerReference}'];
    if (sdk != null) return sdk.displayPrice;
    if (product.displayPrice != null) return product.displayPrice;
  }
  return null;
}

/// Play's own subscription centre, which is where a Play subscription is
/// cancelled. There is no server-created portal for it.
final _playSubscriptions = Uri.parse(
  'https://play.google.com/store/account/subscriptions',
);

/// A name a player can read for an entitlement they hold.
///
/// An entitlement key is engine vocabulary and carries no display name of its
/// own; the offer that grants it does, and that is the name the player saw
/// when they bought it. The key is the fallback, for an entitlement granted
/// free or by an offer no longer sold.
String _entitlementLabel(String key, CommerceCatalog? catalog) {
  for (final offer in catalog?.offers ?? const <CommerceOffer>[]) {
    if (offer.entitlements.contains(key)) return offer.name;
  }
  return key;
}

/// A metric name a player can read.
///
/// The wire names are engine vocabulary (`game.create.success`), which is
/// exactly right in a policy and wrong on a screen.
String _metricLabel(CommercialLimitAccessMetricEnum metric) => switch (metric) {
  CommercialLimitAccessMetricEnum.gamePeriodCreatePeriodSuccess =>
    'Games created',
  CommercialLimitAccessMetricEnum.gamesPeriodOpenCreated =>
    'Games open at once',
  CommercialLimitAccessMetricEnum.botPeriodGamePeriodSuccess =>
    'Games against bots',
  CommercialLimitAccessMetricEnum.analysisPeriodRunPeriodSuccess =>
    'Analyses run',
  _ => metric.value,
};

String _date(int epochMillis) {
  final value = DateTime.fromMillisecondsSinceEpoch(epochMillis).toLocal();
  return '${value.year}-${value.month.toString().padLeft(2, '0')}-'
      '${value.day.toString().padLeft(2, '0')}';
}

void _say(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}
