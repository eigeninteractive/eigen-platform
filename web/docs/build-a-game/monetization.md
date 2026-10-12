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
import { createEngine } from "@eigeninteractive/server";
import { googlePlayCommerceProvider, googlePlaySubscriptionReference } from "@eigeninteractive/server/commerce/google-play";
import { stripeCommerceProvider } from "@eigeninteractive/server/commerce/stripe";

// A storefront is one factory and the secrets it reads. Import only the ones
// you sell through: a game that sells nothing imports none, and each entry
// point carries only itself into your Worker bundle. "Set up your
// storefronts", below, says where each secret comes from.
const play = googlePlayCommerceProvider<Env>({
  packageName: () => "com.example.game",
  serviceAccountEmail: (env) => env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,
  serviceAccountPrivateKey: (env) => env.GOOGLE_PLAY_PRIVATE_KEY,
});
const stripe = stripeCommerceProvider<Env>({
  secretKey: (env) => env.STRIPE_SECRET_KEY,
  webhookSecret: (env) => env.STRIPE_WEBHOOK_SECRET,
});

export default createEngine({
  // The ordinary game, D1, Durable Object, and identity configuration.
  gameModule,
  d1: (env: Env) => env.DB,
  gameDO: (env: Env) => env.GAME_DO,

  commerce: {
    providers: [play, stripe],
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
          { kind: "bot.use", tier: "standard" },
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
          providerReferences: { google_play: "supporter_once", stripe: "price_1SupporterOnce" },
        },
        {
          key: "pro_monthly",
          name: "Pro",
          description: "AI and analysis services.",
          kind: "subscription",
          entitlements: ["pro"],
          providerReferences: {
            google_play: googlePlaySubscriptionReference("pro", "monthly"),
            stripe: "price_1ProMonthly",
          },
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

An offer names what it is sold as at each storefront that sells it, keyed by the
storefront: `google_play`, `stripe` or `razorpay`. An offer a storefront does
not list is simply not sold there.

Provider product identifiers are public catalog configuration and may be
committed. API keys, webhook secrets, service credentials, and raw purchase
evidence are secrets and must stay in Worker secret bindings. The server derives
the expected product identifier from the selected offer; it never trusts a
client-supplied price or arbitrary product ID.

Each adapter checks the form of its references when the Worker starts: a Play
subscription missing its base plan, a Stripe Product id where a Price belongs,
or a one-time Razorpay offer with no configured amount fails `createEngine`
rather than the first purchase.

A purchase claim names an offer, but the offer recorded is the one the provider
verifies. A store SDK cannot always tell which offer it sold — Play's purchase
names a subscription's product, never its base plan — so the claim's offer only
tells the adapter where to look. Naming an offer the player did not pay for
gains nothing, and a wrong guess never refuses a paying player. The access
snapshot the claim returns is what was actually granted.

### Changing the catalog

What an entitlement grants is resolved from the catalog on every read: change
its permissions, content or limits and every holder gets the change on their
next request. Which entitlements an offer grants is recorded with each
purchase, so changing an offer's list reaches new purchases, and subscriptions
when the store next reports on them, but not one-time purchases already made.
Three things are permanent from the moment anything is sold under them:

- **An entitlement key.** Removing or renaming one silently revokes it for
  everyone who holds it; it stops granting and stops being reported.
- **An offer key.** Every transaction names one, and restoration resolves
  through it.
- **A provider reference, while the store may still report on it.** Renewals
  arrive naming the reference they were bought at. One the catalog no longer
  maps is refused and the transaction shows up on `GET /ops/commerce/stalled`:
  a subscriber's access ends with their paid period while the store keeps
  charging them. Refunds and expiries under a retired reference still apply,
  because they only take access away.

A Stripe subscriber who switches plan in the Billing Portal keeps one
transaction, and it moves to the offer the new plan maps to; whatever only the
old offer granted is revoked. On Play a plan change is a new purchase with a
new token, claimed like any other, that names the token it replaced; the engine
ends the old transaction at once, so a downgrade does not keep what only the
old plan granted. A deferred change serves the old plan from the new token
until renewal, then moves it the same way. A resubscription from the Play Store
after a lapse carries no account id, and is attributed through the token it
replaced.

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
  | { kind: "bot.use"; tier: string }
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

Every selected bot needs `bot.use` for its tier, and every bot has exactly one.
`botTiers` lists the bots priced differently; every bot it does not list is in
`standard`. A grant covers only the tier it names, and there is no `bot.use`
meaning "every bot", so ordinary bots stay free while a paid tier stays paid:

```ts
free: {
  permissions: [{ kind: "bot.use", tier: "standard" }],
},
entitlements: [{
  key: "pro",
  permissions: [
    { kind: "bot.use", tier: "standard" },
    { kind: "bot.use", tier: "advanced" },
  ],
}],
botTiers: {
  "bot-stockfish": "advanced",
},
```

An entitlement that should include every bot names every tier. To make every
bot paid, grant `standard` through an entitlement rather than the free profile.

`GET /bots` publishes each bot's `tier`, so a picker can mark an opponent before
it is chosen; the shell shows a lock on one the account's access does not
include. A `local` bot is always `standard`, whatever `botTiers` says, because
the server never seats it and so never charges for it. The tier is presentation
only: seating is what checks access.

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
| `game.create.success` | Successfully created online games across all access modes | calendar month, subscription period, lifetime |
| `games.openCreated` | Online games this account created that remain waiting, ready, or active | concurrent |
| `bot.game.success` | Successfully created online games containing bots | calendar month, subscription period, lifetime |
| `analysis.run.success` | Successfully completed analysis operations | calendar month, subscription period, lifetime |

Every metric counts online play. A game played offline is outside commerce
entirely; see [Offline play is not priced](#offline-play-is-not-priced).

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

## Offline play is not priced

Commerce authorizes play the **server** provides. A game played on the device
is outside it: no capability is checked, no content ownership is required, and
no metric moves — not when it is played, and not when it is later imported.
Importing one registers a game that already happened.

This is not an exemption the engine chose so much as one it cannot avoid. A bot
brain that ships in the client bundle runs with no network, so there is no
request to refuse; a variant the device already played through cannot be
un-played by a later check. Gating the import would only refuse a history the
player can already see on their phone.

`app.access` is the one capability that still applies, because it gates
reaching the server at all rather than playing. A player without it can still
play offline; they cannot synchronize.

The practical consequence for a paid catalog:

- **Only price a bot the device cannot run.** A tier binds only where the server
  seats the bot, and server seating requires a turn deadline (the only backstop
  for a dispatch that never lands), so untimed play always happens on the
  device. A `local` bot's brain exists only in the app, so the engine keeps it in
  `standard` whatever `botTiers` says. An `engine` bot whose brain you also put in the
  local unit is free in every untimed game, so don't tier that one either: the
  player would be paying for the timed version of something one toggle away.
  Sell tiers on `external` bots, or on `engine` bots you leave out of the local
  unit. Both are timed-only by construction.
- **`contentForCreate` still runs for a local game, and its result is still
  recorded**, so the row says which variant the transcript was produced under.
  It is a record, never a gate.
- **Replaying a local game is free**, including viewer-owned content. The
  device's own record route already hands its creator the whole transcript, so
  gating the projected frames of the same game would be two answers about one
  game.

## Set up your storefronts

Each storefront is an entry point of its own rather than part of the barrel,
because it needs a merchant account, credentials and product identifiers the
engine has no business holding. Three ship today:

| Entry point | Storefront | Reference is | Checkout |
| --- | --- | --- | --- |
| [`@eigeninteractive/server/commerce/google-play`](../reference/typescript/server-commerce-google-play.md) | Google Play Billing | the product id; for a subscription, `productId:basePlanId` | launched on the device by the Billing library |
| [`@eigeninteractive/server/commerce/stripe`](../reference/typescript/server-commerce-stripe.md) | Stripe | a Price id (`price_...`) | hosted Checkout Session |
| [`@eigeninteractive/server/commerce/razorpay`](../reference/typescript/server-commerce-razorpay.md) | Razorpay | a Plan id, or your own key for a one-time sale | hosted Payment Link |

Every storefront posts notifications to the Worker at
`/api/commerce/<storefront>/webhook`, so the URLs below are your Worker's origin
plus `/api/commerce/google_play/webhook`, `/api/commerce/stripe/webhook` or
`/api/commerce/razorpay/webhook`.

### Google Play

Play needs two things from Google Cloud, both done once per game:

- a **service account** — a login for your Worker, not a person — which the
  adapter uses to ask Play whether a purchase is real and to acknowledge it;
- a **Pub/Sub topic**, where Play publishes [Real-time developer
  notifications](https://developer.android.com/google/play/billing/rtdn-reference):
  renewals, cancellations, refunds, and purchases made in the Play Store
  rather than in your game. A push subscription forwards each one to your
  Worker, signed as that same service account.

The Cloud project holds only the account and the topic. In a shell with
`gcloud` signed in:

```sh
PROJECT=your-cloud-project-id
WEBHOOK=https://yourgame.example/api/commerce/google_play/webhook
SERVICE_ACCOUNT="eigen-play@$PROJECT.iam.gserviceaccount.com"

gcloud services enable androidpublisher.googleapis.com pubsub.googleapis.com --project="$PROJECT"

# The account the Worker calls Play as, and its key.
gcloud iam service-accounts create eigen-play --project="$PROJECT"
gcloud iam service-accounts keys create play-key.json --iam-account="$SERVICE_ACCOUNT"

# Let Pub/Sub sign push deliveries as that account.
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT" \
  --member="serviceAccount:service-$PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role=roles/iam.serviceAccountTokenCreator

# The topic Play publishes to, and the push subscription to your Worker.
gcloud pubsub topics create play-notifications --project="$PROJECT"
gcloud pubsub topics add-iam-policy-binding play-notifications --project="$PROJECT" \
  --member=serviceAccount:google-play-developer-notifications@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
gcloud pubsub subscriptions create play-notifications-push --project="$PROJECT" \
  --topic=play-notifications \
  --push-endpoint="$WEBHOOK" \
  --push-auth-service-account="$SERVICE_ACCOUNT"
```

`WEBHOOK` must be exactly the URL your Worker serves: Pub/Sub mints each
delivery's token for it, and the adapter refuses a token minted for anywhere
else. If your Google Cloud organization forbids service account keys, an
administrator has to allow one for this account; the Worker has no other way
to sign in to Google.

Store the key as the two Worker secrets the [Play
factory](#configure-the-worker) reads, then delete the file:

```sh
jq -r .client_email play-key.json | npx wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL
jq -r .private_key play-key.json | npx wrangler secret put GOOGLE_PLAY_PRIVATE_KEY
rm play-key.json
```

Then, in the [Play Console](https://play.google.com/console/):

1. **Users and permissions → Invite new users.** Enter the service account's
   email, and for your app grant *View financial data, orders, and
   cancellation survey responses* and *Manage orders and subscriptions*.
2. Open your app, then **Monetize → Monetization setup**. Under *Real-time
   developer notifications*, check *Enable real-time notifications*, enter the
   topic name `projects/your-cloud-project-id/topics/play-notifications`, and
   choose *Get all notifications for subscriptions and one-time products*.
   One-time notifications are how a refunded unlock is taken back.
3. Save, then **Send test message**. Your Worker answers it with 204 and
   records nothing. Anything else is in the Worker's log: a refused token
   usually means `WEBHOOK` differs from the URL the Worker serves.
4. **Monetize → Products.** Create each one-time product and subscription the
   catalog names. A one-time product's id is its reference; a subscription is
   referenced by product and base plan, `googlePlaySubscriptionReference("pro",
   "monthly")`. Set each subscription's default replacement mode, which decides
   when a player switching plans pays the new price.

To buy, the app must come from Play: upload a build to a testing track (internal
testing is enough) and install it from there. Add your testers under
**Settings → License testing** and they buy with test cards that are never
charged.

### Stripe

Stripe sells a Price, so create a Product in the [Stripe
Dashboard](https://dashboard.stripe.com/) for each offer and give it a one-time
or recurring Price; the `price_...` id is the reference. Then, with your secret
key:

```sh
STRIPE_SECRET_KEY=sk_test_...
WEBHOOK=https://yourgame.example/api/commerce/stripe/webhook

curl https://api.stripe.com/v1/webhook_endpoints -u "$STRIPE_SECRET_KEY:" \
  --data-urlencode "url=$WEBHOOK" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=checkout.session.async_payment_succeeded" \
  -d "enabled_events[]=checkout.session.async_payment_failed" \
  -d "enabled_events[]=checkout.session.expired" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=charge.refunded" \
  -d "enabled_events[]=charge.dispute.closed" \
  | jq -r .secret | npx wrangler secret put STRIPE_WEBHOOK_SECRET
printf %s "$STRIPE_SECRET_KEY" | npx wrangler secret put STRIPE_SECRET_KEY
```

Stripe shows an endpoint's signing secret only when it is created, which is why
it goes straight into the secret. The refund and dispute events are how a
refunded one-time purchase is taken back.

Players manage a Stripe subscription in Stripe's customer portal. Open
**Settings → Billing → Customer portal** and save it once, in test mode and
again in live mode; until then Stripe refuses to open it. To let players switch
plan there, add the subscription Prices you sell to its product list.

Test mode has its own keys, Prices and webhook endpoints, so run the commands
again with a live key for production; a staging Worker keeps the test ones.
Pay with the card `4242 4242 4242 4242`, and use a test clock to fast-forward a
subscription through its renewals.

### Razorpay

Razorpay has no priced product for a one-time sale, so its reference is a key
you choose, and its price is that key's entry in the factory's `amounts`: an
offer with `razorpay: "supporter_once"` sells at the price below. A subscription is
sold through a Plan, created under **Subscriptions → Plans**, and the
`plan_...` id is its reference.

```ts
import { razorpayCommerceProvider } from "@eigeninteractive/server/commerce/razorpay";

const razorpay = razorpayCommerceProvider<Env>({
  keyId: (env) => env.RAZORPAY_KEY_ID,
  keySecret: (env) => env.RAZORPAY_KEY_SECRET,
  webhookSecret: (env) => env.RAZORPAY_WEBHOOK_SECRET,
  // In the minor unit: ₹199.00.
  amounts: { supporter_once: { amount: 19900, currency: "INR" } },
});
```

In the [Razorpay Dashboard](https://dashboard.razorpay.com/):

1. **Account & Settings → API Keys.** Generate a key pair and store it:
   `npx wrangler secret put RAZORPAY_KEY_ID`, then `RAZORPAY_KEY_SECRET`.
2. **Account & Settings → Webhooks → Add New Webhook.** Set the URL to
   `https://yourgame.example/api/commerce/razorpay/webhook`, generate a secret
   with `openssl rand -hex 32` and store it as `RAZORPAY_WEBHOOK_SECRET`, add
   an alert email, and turn on `subscription.*`, `payment.captured`,
   `payment.failed` and `refund.processed`.

Razorpay disables a webhook that has failed for 24 hours, and turning it back on
is manual, so the alert email matters. Test mode keeps its own keys and
webhooks; set both up again there.

### What differs between storefronts

Each reference page carries the adapter's full configuration. These are worth
knowing before you choose:

- **Play refunds an unacknowledged purchase after three days.** The engine
  acknowledges only after the entitlement is durable and retries a lost
  acknowledgement on the reconciliation sweep, so this is handled — but it is
  why `sealedProviderState` exists, and why a Play deployment must let the
  scheduled run happen.
- **Notifications are checked before they are read.** Stripe and Razorpay sign
  the body. Google signs nothing in a Play notification, so the adapter reads
  one only when Pub/Sub delivered it as your service account, with a token
  minted for your endpoint.
- **Every authentic notification is answered 2xx.** One about no purchase —
  a Stripe event beyond the lifecycle ones, a Razorpay payment that names no
  Eigen offer — is accepted with nothing recorded. That matters most on
  Razorpay, which disables a webhook that has failed for 24 hours.
- **Refunds revoke.** A full refund takes back what was bought on all three. A
  lost chargeback does too on Play and Stripe; Razorpay disputes are not read,
  so revoke one by refunding it. A partial refund of a Play purchase of several
  items ends it once nothing is left; a partial Stripe or Razorpay refund keeps
  it.
- **Razorpay's `pending` is a grace period**, not an unpaid purchase: an
  auto-charge failed and is being retried. The adapter maps it to `grace` so a
  paying player is not cut off mid-retry.
- **A Play subscription is sold by base plan.** Reference it as
  `productId:basePlanId` (`googlePlaySubscriptionReference` builds one), so
  monthly and yearly can be two offers. Play's offers — free trials,
  introductory prices, win-back discounts — are prices on a base plan and stay
  out of the reference. Add-on subscriptions, which serve several products
  from one purchase, are not supported and are refused.
- **Play offers launch only when you tag them.** In the Play Console, give an
  offer the tag `eigen-launch` (or the `launchTag` you pass
  `PlayPurchaseGateway`) and the gateway sells the cheapest tagged offer Play
  still returns for the player, showing its introductory price ahead of the
  regular one: "Free for 1 week, then $4.99". Untagged offers never launch.
  Play hides an offer from an ineligible player only when Play decides
  eligibility, as for a new-customer trial; a developer-determined offer
  (win-back, retention, upgrade) reaches every player, so tag one only if
  everyone buying from the store should get it. Tag the offer itself: an offer
  inherits its base plan's tags, so a tag on the base plan launches none.
- **A player switches Play plans in the app.** Buying another base plan of a
  subscription the account already holds replaces the old purchase, as Play
  requires. When the new price is charged is the default replacement mode you
  set for the product in the Play Console. A different subscription product is
  bought alongside, not as a replacement.
- **A Razorpay one-time sale must be paid in full.** Payment notes are written
  by whoever opens Razorpay Checkout, so the adapter accepts a payment only for
  exactly the `amounts` entry of the offer it names, and only for the account
  its notes name. A subscription is likewise accepted only by the account that
  started its checkout.

### Write your own

A provider Eigen does not ship implements the same `CommerceProvider` port,
whose optional members are how an adapter declares what its storefront can
actually do:

```ts
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
    // Authenticate the raw request, then resolve current provider state,
    // with the provider's own event id as providerEventId. Resolve null for
    // an authentic notification about no purchase.
    return verifyNotification(env, request);
  },

  validateReference(providerReference, kind) {
    // Throw at startup for a reference this storefront could never sell.
  },

  async reconcile(env, transactions) {
    // Refresh the bounded set of nonterminal provider transactions.
    return refreshTransactions(env, transactions);
  },

  // Omit `createCheckout` and `management` entirely when the storefront has
  // no such page. The engine answers plainly for a provider that cannot open
  // one, which is better than a stub returning somewhere that does not exist.
};
```

An adapter you write yourself implements the same `CommerceProvider` port, and
`@eigeninteractive/server/commerce-kit` carries the Workers-side primitives the
three shipped ones use: an HMAC, a constant-time comparison, and a JSON call
that names a failing provider without quoting the credential it failed with.
Throw its `ProviderRefusal` when the provider answered and the answer will never
be accepted, such as a purchase of several products at once: a claim then
answers 409 rather than 502, and a notification is accepted and logged instead
of being resent for days.

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
decided here and changing it is an app release. `platformStorefronts` makes it
for you, given the storefronts for each platform:

```dart
runEigenShell(
  module: myGame,
  config: myConfig,
  initializeAdapter: () async => [
    storefrontsProvider.overrideWithValue(
      platformStorefronts(
        android: [PlayPurchaseGateway()],
        web: [
          StripeHostedStorefront(
            returnUrl: Uri.parse('https://yourgame.example/store/return'),
            launcher: const UrlLauncherCheckout(),
          ),
        ],
      ),
    ),
  ],
);
```

An iOS or macOS build carries no storefront, so its store does not appear.
Apple requires its own in-app purchase for digital goods, there is no App
Store storefront yet, and sending an iPhone player to a hosted checkout
instead is grounds for rejecting the app. Windows and Linux builds sell through
the `desktop` storefronts you pass, and none if you pass none.

The shell's store screen, restore, subscription management and upgrade prompts
work from that list alone.

No storefront asks you who is buying. `CommerceService` belongs to the
signed-in account and passes it to the gateway, which binds the purchase to it
at the store — the account the Worker then checks the claim against. A player
who is signed out cannot buy or restore.

Whatever the storefront, a purchased or restored update is not access. The
service submits its evidence to the Worker, commits access, settles at the SDK
if there is one, and only then yields an `AccessSnapshot` — on one stream, so a
store screen listens once.

`CommerceService.getCatalog` names this build's storefronts, so the Worker
consults only those providers' pricing APIs. Calling
`CommerceRepository.getCatalog` without them asks every registered storefront,
which is what an operator wants and what a player's first screen does not.

A hosted return URL must use the Worker's origin or one listed in
`createEngine`'s `clientOrigins`. A web build the Worker serves already has the
Worker's origin, so `https://yourgame.example/store/return` needs nothing more.
It must be `http`/`https` — a custom URI scheme will not do, so on Android it
is an App Link. It is also not proof of payment: a browser closed on a slow network returns nothing at all, which a
`HostedStorefront` reports as `PurchaseUpdateState.pending` rather than a
failure. The provider webhook remains authoritative.

Leaving and coming back are separate events, and on the web separate page
loads: opening checkout replaces the page, so the return is an ordinary cold
start that happens to carry a purchase. The shell hands the URL it was opened
at, and every deep link, to `CommerceService.resumeFrom`. An app without the
shell calls it itself.

Implementations ship where their dependencies belong, which is the same rule
the Worker's storefront entry points follow:

| | Where | Why there |
| --- | --- | --- |
| `StripeHostedStorefront`, `RazorpayHostedStorefront` | `eigen_flutter` | Pure URL construction. No dependency, so nothing is saved by keeping them out. |
| `UrlLauncherCheckout` | `eigen_shell` | Needs `url_launcher`, which the shell already has. |
| `PlayPurchaseGateway` | `eigen_shell` | Links Google Play Billing, native Android code no game should carry unless it ships the shell. |

`CheckoutLauncher` is the seam between the two halves: `eigen_flutter` asks for
one rather than depending on a platform plugin every game would then link
whether or not it sells anything. The shell supplies `UrlLauncherCheckout`, and
an application that wants an in-app browser instead supplies its own — it is a
single `launchUrl` call.

`PlayPurchaseGateway` depends on `in_app_purchase_android` rather than the
`in_app_purchase` umbrella, which would also link StoreKit into every iOS
build. Play Billing is Android-only, and so is this.

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
- Test pending, duplicate, restore, renewal, expiry, refund, revocation, plan
  change, and another account's transaction—not just the successful checkout.
- Finish each storefront's setup under [Set up your
  storefronts](#set-up-your-storefronts), in test mode and again in live mode,
  and send Play's test message.
- On Play, tag the offers the store may launch.
- Keep every subscription's provider reference in the catalog until nobody is
  subscribed under it.
- Keep abuse rate limits identical for free and paid accounts.
- Do not add ads or paid competitive advantage.

The architectural rationale and full invariants are in
[ADR 0011](https://github.com/eigeninteractive/eigen-platform/blob/main/docs/architecture/0011-commerce-entitlements-and-access.md).
