---
sidebar_position: 9
title: Monetization
description: Add one-time products, subscriptions, cosmetics, shared variants, AI, analysis, or optional commercial limits without putting provider state in game rules.
---

# Monetization

Commerce is an optional deployment feature. A game can sell only cosmetics,
combine a permanent supporter product with a subscription, impose a free-tier
creation allowance, or have no commercial gameplay limits at all. The same
engine routes handle each model.

The authority chain is:

```text
offer -> provider-verified transaction -> entitlement -> effective access -> route check
```

The game declares the product policy. Eigen owns the repeatable parts: provider
boundaries, transaction deduplication, entitlement projection, restoration,
webhook ingestion, scheduled reconciliation, limit accounting, standard route
checks, and typed client access. A game rule never receives a purchase, an
entitlement, or a user account.

## The three layers

Use each layer for one job:

| Layer | Question it answers | Examples |
|---|---|---|
| Offer | What can the player buy? | Supporter, Pro monthly |
| Entitlement | What durable benefit did they acquire? | `supporter`, `pro` |
| Access grant | What may this account do or own right now? | private creation, a board theme, 100 analyses |

Do not name an entitlement after a route and do not invent a game permission
such as `allow_misere_chess`. Entitlements are product concepts. Routes enforce
Eigen's closed capability vocabulary, while game-specific nouns are registered
content resources such as `chess_variant/misere`.

## Configure the Worker

Pass a `commerce` block to `createEngine`. This example has unrestricted human
play, a permanent cosmetic/variant product, and a subscription for analysis:

```ts
import {
  createEngine,
  type CommerceProvider,
} from "@eigeninteractive/server";

const provider: CommerceProvider<Env> = {
  key: "my_store",

  async products(env, providerReferences) {
    // Ask the storefront for localized display prices.
    return loadProducts(env, providerReferences);
  },

  async verifyClaim(env, input) {
    // Verify input.evidence with the provider. Return provider truth only.
    return verifyPurchase(env, input);
  },

  async verifyWebhook(env, request) {
    // Authenticate the raw request, then resolve current provider state.
    return verifyNotification(env, request);
  },

  async reconcile(env, transactions) {
    // Refresh the bounded set of nonterminal provider transactions.
    return refreshTransactions(env, transactions);
  },
};

export default createEngine({
  // The ordinary game, D1, Durable Object, and identity configuration.
  gameModule,
  d1: (env: Env) => env.DB,
  gameDO: (env: Env) => env.GAME_DO,

  commerce: {
    providers: [provider],
    catalog: {
      free: {
        permissions: [
          { kind: "game.create", access: "public" },
          { kind: "game.create", access: "friends" },
          { kind: "game.create", access: "private" },
          { kind: "game.join", access: "public" },
          { kind: "game.join", access: "friends" },
          { kind: "game.join", access: "private" },
          { kind: "game.create.rated" },
          { kind: "replay.read" },
        ],
      },
      entitlements: [
        {
          key: "supporter",
          content: [
            { collection: "board_theme", id: "supporter_gold" },
            { collection: "chess_variant", id: "misere" },
          ],
        },
        {
          key: "pro",
          permissions: [
            { kind: "bot.use", tier: "advanced" },
            { kind: "analysis.use" },
          ],
          limits: [{
            metric: "analysis.run.success",
            maximum: 100,
            period: { kind: "subscriptionPeriod" },
          }],
        },
      ],
      offers: [
        {
          key: "supporter",
          name: "Supporter",
          description: "Permanent themes and variants.",
          kind: "oneTime",
          entitlements: ["supporter"],
          providerReferences: { my_store: "supporter_once" },
        },
        {
          key: "pro_monthly",
          name: "Pro",
          description: "AI and analysis services.",
          kind: "subscription",
          entitlements: ["pro"],
          providerReferences: { my_store: "pro_monthly" },
        },
      ],
      content: {
        board_theme: {
          supporter_gold: { classification: "cosmetic" },
        },
        chess_variant: {
          misere: { classification: "sharedRuleset" },
        },
      },
      botTiers: {
        // Use the stable id of the registered bot, not its display name.
        "bot-stockfish": "advanced",
      },
    },
  },
});
```

Provider product identifiers are public catalog configuration and may be
committed. API keys, webhook secrets, service credentials, and raw purchase
evidence are secrets and must stay in Worker secret bindings. The server derives
the expected product identifier from the selected offer; it never trusts a
client-supplied price or arbitrary product ID.

If `commerce` is absent, the routes are absent and ordinary game behavior is
unchanged. No billing SDK or merchant credential becomes a transitive engine
requirement.

When `commerce` is present, its free profile is explicit policy. Grant every
core operation that should remain free; omitting create, join, or bot
permissions denies that operation unless an active entitlement supplies it.

## Fixed capabilities

The initial engine-owned capabilities are:

```ts
type EngineAccessCapability =
  | { kind: "app.access" }
  | { kind: "game.create"; access: "public" | "friends" | "private" }
  | { kind: "game.join"; access: "public" | "friends" | "private" }
  | { kind: "game.create.rated" }
  | { kind: "bot.use"; tier?: string }
  | { kind: "content.use"; collection: string; id: string }
  | { kind: "replay.read" }
  | { kind: "analysis.use"; analysisType?: string };
```

The structured create and join capabilities are deliberately explicit. A grant
for public creation does not imply friends or private creation. Canonical logs
and denial messages render these as `game.create.public`,
`game.create.friends`, and `game.create.private`.

`app.access` can make the whole authenticated game a paid application. Commerce
self-service remains reachable so a signed-in player can read the catalog,
claim or restore a purchase, and recover access. Guests may play when the free
profile allows it, but they cannot purchase or restore durable value.

Solo creation composes existing checks rather than introducing another verb:

```text
game.create.private + bot.use(selected tier)
```

Every selected bot needs `bot.use`. `botTiers` maps registered bot IDs to a
named tier; a bot omitted from that map requires the unparameterized base
capability. Grant that base capability in `free.permissions` when all ordinary
bots should remain free.

## Select game-owned content

The server cannot infer that `config.variant === "misere"` names a paid
resource. Declare that connection in the authoritative TypeScript rules:

```ts
contentForCreate: ({ config }) => {
  if (config.variant !== "misere") return [];
  return [{
    collection: "chess_variant",
    id: "misere",
    ownership: "creator",
  }];
},
```

The hook runs only on validated configuration and has no access to accounts or
commerce storage. Eigen checks the returned resource against the catalog and
snapshots it with the game.

Choose ownership deliberately:

- `creator` checks before creation. This is the normal choice for a shared
  variant or map: one owner invites anyone, and the rules apply symmetrically.
- `eachParticipant` checks before every human joins. Use it for personal
  non-advantageous content, not gameplay power.
- `viewer` checks when a finished replay is opened.

`sharedRuleset` content may affect authoritative rules for everyone equally.
`cosmetic` content is presentation-only and authoritative rules must not read
it. Paid extra actions, stronger pieces, extra clock time, in-match hints, and
outcome modifiers are not supported commercial value.

## Choose whether creation is limited

Omitting a metric means there is no commercial limit. That is the simplest
cosmetics-only game:

```ts
free: {
  permissions: [
    { kind: "game.create", access: "public" },
    { kind: "game.join", access: "public" },
  ],
  // No game.create.success or games.openCreated entry.
}
```

For a visible free-tier allowance, add a limit to the free profile and let an
entitlement provide a larger or unlimited value:

```ts
free: {
  permissions: [/* creation and joining permissions */],
  limits: [{
    metric: "game.create.success",
    maximum: 5,
    period: { kind: "calendarMonth", timezone: "UTC" },
  }],
},
entitlements: [{
  key: "supporter",
  limits: [{
    metric: "game.create.success",
    maximum: "noCommercialLimit",
  }],
}],
```

UTC calendar months are useful when the product copy says “per month”: reset
dates are predictable and independent of when an account first played. A
subscription-period allowance instead follows the provider-verified paid
period; it is valid only on an entitlement sold by a subscription offer.

The supported metrics are:

| Metric | Meaning | Compatible period |
|---|---|---|
| `game.create.success` | Successfully created games across all access modes | calendar month, subscription period, lifetime |
| `games.openCreated` | Games this account created that remain waiting, ready, or active | concurrent |
| `bot.game.success` | Successfully created games containing bots | calendar month, subscription period, lifetime |
| `analysis.run.success` | Successfully completed analysis operations | calendar month, subscription period, lifetime |

`analysis.use` and `analysis.run.success` are reserved parts of the closed
engine vocabulary, but the current core does not yet expose a game-agnostic
analysis execution route. Declaring them exposes access state; it does not make
a custom game route enforce or meter itself. Keep paid analysis behind an
engine-owned integration that checks the capability and records successful
usage atomically before shipping it.

For the same metric, permissions and content are unioned, numeric maxima use the
greatest active value, and `noCommercialLimit` wins while its grant is active.
It means no plan-level restriction, never no abuse protection. Engine request
rate limits and infrastructure ceilings remain separate and cannot be bought
away.

Game creation is operation-specifically idempotent because a duplicated create
must not consume two allowances. Mint one `creationId`, reuse it after an
ambiguous transport failure, and mint another only when the player begins a new
creation intent. The Dart repository requires this explicitly; the standard
shell preserves it while retrying.

## Connect the client

The pure Dart client exposes `CommerceRepository` for:

- `getCatalog()` and `getAccess()`;
- server-verified `claim()` and `restore()`;
- provider-hosted `createCheckout()`; and
- provider-hosted `createManagement()`.

`eigen_flutter` adds two storefront boundaries, because a store SDK and a
hosted page are not the same shape. A `PurchaseGateway` supplies localized
products, launches the SDK purchase/restore flow, emits normalized updates with
provider evidence, and settles provider delivery only after verification. A
`HostedStorefront` opens a checkout URL the Worker created and reports what
came back through the return URL; it settles nothing, because the provider
already took the money.

Override `storefrontsProvider` at the application composition root with the
storefronts this build carries, in preference order, then use
`CommerceService`. That list is the routing decision: the server holds no
per-platform policy, so which storefront an Android or web build uses is
decided here and changing it is an app release.

Whatever the storefront, a purchased or restored update is not access. The
service submits its evidence to the Worker, commits access, settles at the SDK
if there is one, and only then yields an `AccessSnapshot` — on one stream, so a
store screen listens once.

`CommerceService.getCatalog` names this build's storefronts, so the Worker
consults only those providers' pricing APIs. Calling
`CommerceRepository.getCatalog` without them asks every registered storefront,
which is what an operator wants and what a player's first screen does not.

A hosted return URL must use the Worker origin or a configured trusted client
origin, and it must be `http`/`https` — a custom URI scheme will not do, so on
Android and iOS it is an App Link or Universal Link. It is also not proof of
payment: a browser closed on a slow network returns nothing at all, which a
`HostedStorefront` reports as `PurchaseUpdateState.pending` rather than a
failure. The provider webhook remains authoritative.

Leaving and coming back are separate events, and on the web separate page
loads: opening checkout replaces the page, so the return is an ordinary cold
start that happens to carry a purchase. Call `CommerceService.resumeFrom` with
the URL the app was opened at, and again whenever a deep link arrives.

Two optional packages implement these ports, so a game that sells nothing links
neither their code nor their platform plugins:

| Package | Storefront | Install it to… |
| --- | --- | --- |
| `eigen_commerce_play` | `PurchaseGateway` | sell through Google Play Billing on Android |
| `eigen_commerce_hosted` | `HostedStorefront` | sell through Stripe or Razorpay's hosted pages |

They are separate packages where the server's storefronts are entry points of
one, and the difference is the dependency: an adapter that needs Play Billing
or a URL launcher on the device is not something a game that sells nothing
should link, while the Worker's adapters have no dependencies at all.

A concrete adapter is an entry point of its own rather than part of the barrel,
because it needs a merchant account, credentials and product identifiers the
engine has no business holding. Three ship today, importing none of them is the
normal case, and importing one carries only that one into your bundle:

| Entry point | Storefront | Reference is | Checkout |
| --- | --- | --- | --- |
| [`@eigeninteractive/server/commerce/google-play`](../reference/typescript/server-commerce-google-play.md) | Google Play Billing | the product id | launched on the device by the Billing library |
| [`@eigeninteractive/server/commerce/stripe`](../reference/typescript/server-commerce-stripe.md) | Stripe | a Price id (`price_...`) | hosted Checkout Session |
| [`@eigeninteractive/server/commerce/razorpay`](../reference/typescript/server-commerce-razorpay.md) | Razorpay | a Plan id, or your own key for a one-time sale | hosted Payment Link |

Each reference page carries the adapter's configuration and the details that
are only true of that provider. Three are worth knowing before you choose:

- **Play refunds an unacknowledged purchase after three days.** The engine
  acknowledges only after the entitlement is durable and retries a lost
  acknowledgement on the reconciliation sweep, so this is handled — but it is
  why `sealedProviderState` exists, and why a Play deployment must let the
  scheduled run happen.
- **Play's notifications are not signed.** Google delivers them by Pub/Sub push,
  so the deployment must authenticate that endpoint itself. Stripe and Razorpay
  both sign, and their adapters verify before parsing.
- **Razorpay's `pending` is a grace period**, not an unpaid purchase: an
  auto-charge failed and is being retried. The adapter maps it to `grace` so a
  paying player is not cut off mid-retry.

An adapter you write yourself implements the same `CommerceProvider` port, and
`@eigeninteractive/server/commerce-kit` carries the Workers-side primitives the
three shipped ones use: an HMAC, a constant-time comparison, and a JSON call
that names a failing provider without quoting the credential it failed with.

## Production checklist

- Require a recoverable signed-in account before launching checkout.
- Verify purchase evidence and webhook authenticity inside the provider
  adapter; never accept a client assertion as an entitlement.
- Implement `verifyWebhook` for lifecycle changes and `reconcile` for missed
  notifications. The scheduled Worker run processes a bounded batch.
- Keep raw receipts, tokens, card data, and provider secrets out of responses
  and routine logs.
- Display provider-localized price data rather than hard-coded price strings.
- Explain the exact limit and reset date before purchase.
- Test pending, duplicate, restore, renewal, expiry, refund, revocation, and
  another account's transaction—not just the successful checkout.
- Keep abuse rate limits identical for free and paid accounts.
- Do not add ads or paid competitive advantage.

The architectural rationale and full invariants are in
[ADR 0011](https://github.com/eigeninteractive/eigen-platform/blob/main/docs/architecture/0011-commerce-entitlements-and-access.md).
