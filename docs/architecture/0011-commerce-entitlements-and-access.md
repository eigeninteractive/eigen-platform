# 0011: commerce, entitlements, and access capabilities

- Status: accepted
- Date: 2026-09-11
- Amends: the ambiguous-creation exception in
  [0009](0009-compatibility-simplifications.md). Game creation gains
  operation-specific identity; this does not restore generic command receipts.
- Amended: 2026-09-15. Replaying a game played offline is not priced, and the
  bot catalog publishes the tier each bot is sold under. See _Offline play_ and
  _Composed operations_.

## Context

EigenInteractive games may be free, paid once, subscription-funded, or combine
those models. A chess deployment might let everyone play human opponents, sell
a permanent supporter pack with higher limits and cosmetics, and separately
sell a subscription for server-hosted AI and analysis. Another game may impose
no commercial gameplay limits and sell only cosmetic content.

The repeated engineering problem is not checkout alone. Purchases may be
pending, duplicated, delivered out of order, renewed, restored, refunded, or
revoked. The same logical product may be sold through different storefronts,
and access must remain correct when a client disappears after payment. Every
game reimplementing that lifecycle would be both wasteful and unsafe.

At the same time, Eigen is a toolkit for independently owned applications, not
a shared marketplace. Each deployment owns its domain, users, data, merchant
accounts, commercial policy, and customer relationship. Commerce therefore
must be an optional application capability rather than a central Eigen service.

This record uses _access capability_ to mean a commercial authorization fact.
It is unrelated to protocol-version negotiation described in earlier records.

## Decision

Eigen supplies an optional, provider-neutral commerce runtime built around this
chain:

```text
offer -> verified transaction -> entitlement -> access grants -> route decision
```

The boundaries are:

- the game publisher owns merchant accounts, prices, taxes, refunds, store
  configuration, product design, legal terms, and customer support;
- the payment provider owns checkout, payment instruments, localized prices,
  and its source transaction lifecycle;
- Eigen owns verification adapters, idempotent event ingestion, normalized
  transaction state, entitlement projection, restoration, reconciliation,
  access evaluation, standard enforcement points, and reusable client UI;
- the game declares its offers, entitlements, free grants, content resources,
  and the mapping from validated game configuration to selected resources; and
- the game Durable Object remains the sole authority for live game state.

Eigen is not the merchant of record, does not take a revenue share, and does not
centralize commerce or identity across independently deployed games.

Commerce is opt-in. When absent, commerce routes are not mounted, billing SDKs
are not initialized, no merchant credentials are required, and local play
continues to work.

## Product principles

### Core play and commercial freedom

The engine supports both commercially limited and commercially unlimited game
creation. It does not prescribe whether a publisher sells capacity.

A recommended game keeps human multiplayer creation and joining in the free
profile, then monetizes capacity, shared variants, cosmetics, or services with
ongoing cost. That recommendation is product guidance, not a runtime
restriction. A paid application may instead use `app.access`, and a publisher
may assign the fixed creation permissions differently.

No commercial grant may improve one participant's competitive position inside
a human-versus-human game. Supported paid value is limited to:

- shared rulesets or content applied symmetrically to the whole game;
- cosmetic presentation that authoritative rules cannot read; and
- services outside the human match, such as AI opponents or post-game
  analysis.

Paid extra actions, stronger pieces or cards, additional clock time, hints in a
competitive game, outcome modifiers, and similar advantages are outside the
supported model.

### No advertising

Eigen provides no advertising adapters, ad placement surfaces, ad-removal
capability, advertising-funded grants, or rewarded-ad path. Advertising is
outside the product and documentation scope.

The platform is MIT-licensed, so this is a boundary of the official engine,
shell, scaffolder, documentation, showcase, and Eigen brand rather than a claim
that an independent licensee is technically or legally unable to modify their
own application.

### Safety controls are not products

Abuse rate limits, request bounds, and hard infrastructure ceilings apply to
every account and MUST NOT be raised or removed by a purchase. Commercial
limits are separately configured, user-visible product policy.

`noCommercialLimit` means that an account has no plan-based restriction. It
never means unbounded infrastructure usage.

## Domain model

### Offers

An offer is something the publisher sells. It has a stable logical key,
presentation metadata, provider product mappings, and one or more entitlement
grants.

```ts
interface Offer {
  key: string;
  name: string;
  description: string;
  kind: "oneTime" | "subscription";
  entitlements: readonly string[];
  providerReferences: Readonly<Record<string, string>>;
}
```

The catalog MUST NOT hard-code a user-visible price. Storefront adapters return
the current localized price and purchase terms. A client MUST NOT be allowed to
select an arbitrary provider product or price; the server resolves the provider
identifier from the registered offer.

### Entitlements

An entitlement is a named commercial benefit such as `supporter` or `pro`. It
is independent of how it was acquired. Monthly, annual, lifetime, promotional,
and operator-issued sources may grant the same entitlement.

An effective entitlement has a start, optional expiry, source, and revocation
state. A provider transaction creates or changes a grant; it does not directly
toggle one mutable `isPremium` field. Multiple valid grants may sustain one
entitlement, so revoking one source does not remove access supplied by another.

Entitlement definitions grant three kinds of access:

1. fixed engine permissions;
2. ownership of registered game content; and
3. commercial limits or allowances.

The public client reads a resolved entitlement and access snapshot. Provider
tokens, event history, and source-reconciliation state remain server-private.

### Free access profile

Every deployment declares a free access profile. It is evaluated as a permanent
base grant, not represented as a fake purchase. An account's effective access
is the free profile plus every currently valid entitlement grant, less expired
or revoked sources.

The free profile may contain permissions, content, and limits. It may omit a
commercial limit entirely.

## Closed access-capability vocabulary

Games MUST NOT invent permissions such as `allow_misere_chess`. Eigen owns a
closed, structurally typed set of authorization verbs. Games provide only the
resource identifiers consumed by those verbs.

The initial set is:

```ts
type EngineAccessCapability =
  | { kind: "app.access" }
  | {
      kind: "game.create";
      access: "public" | "friends" | "private";
    }
  | {
      kind: "game.join";
      access: "public" | "friends" | "private";
    }
  | { kind: "game.create.rated" }
  | { kind: "bot.use"; tier?: string }
  | {
      kind: "content.use";
      collection: string;
      id: string;
    }
  | { kind: "replay.read" }
  | { kind: "analysis.use"; analysisType?: string };
```

Canonical log and error names may render the structured creation permissions as
`game.create.public`, `game.create.friends`, and `game.create.private`, but
application code does not parse those strings.

The access modes exactly match the engine's `GameAccess` contract. There is no
ambiguous unparameterized `game.create` grant meaning "all creation" or "all
non-private creation".

There is no `custom` escape hatch. A genuinely new commercial operation
requires an intentional engine capability with server enforcement, typed API
surface, standard errors, client behavior, tests, and documentation.

Resource parameters such as a bot tier, analysis type, content collection, and
content item are declared by the game in a validated catalog. They are nouns
under fixed engine-owned verbs, not new permissions.

### Composed operations

A convenience route does not automatically create another capability. The
current solo route means:

```text
game.create.private + bot.use(selected tier)
```

It creates a private game, seats bots, and starts it. The ordinary add-bot route
checks the same `bot.use` capability. This keeps route compositions from causing
an ever-growing permission vocabulary.

Requirements may compose with `allOf` and `anyOf`. The engine evaluates them
and returns one normalized access decision; game code never loads entitlement
rows or decides whether an account satisfies a requirement.

A `bot.use` tier is meaningful only for a bot this engine runs or calls: a
server brain, or an externally hosted one. A brain that ships inside the
application binary is not gateable, for the reason given under _Offline play_.

It follows that a deployment SHOULD NOT tier a bot whose brain it also ships in
the application. A `local` bot is never seated by the server, so the engine
resolves no tier for it whatever the catalog says. An `engine` bot with a Dart
twin in the local unit is seatable both ways: its offline games are free and its
server-seated ones would be paid, which prices the timed version of something the
player can already play untimed. Nothing server-side can see a client bundle, so
that half is guidance for the game author rather than a check.

`GET /bots` publishes each bot's tier, so a picker can mark an opponent the
account's access does not include before it is chosen. The tier is resolved by
the same function the seating routes enforce with, so the published tier and the
enforced one cannot diverge. It is presentation only: seating still decides.

## Offline play

[0012](0012-offline-play.md) lets a device play a whole game against brains the
application binary ships, with no server involved, and register it afterwards
through `POST /games/local`. That operation is deliberately outside the
commercial layer: it acquires no capability, checks no content ownership, and
consumes no metered allowance. `app.access` and the abuse limits still apply,
because they are not products.

This is a consequence of where the code runs, not a concession:

- **The play cannot be gated.** The game was created and finished on the device
  while the server knew nothing about it. By the time a request arrives the
  history already exists, so a check here could only refuse to accept it, and
  the player would keep a game on their phone that the server denies. This
  record already holds the principle: expiry affects new protected operations,
  never committed game history.
- **What ships in the binary cannot be withheld.** Only bots whose brains are in
  the application can play offline — an externally hosted bot is refused outright
  — so a paid bot tier is available offline to everyone who has the build,
  permanently. A `sharedRuleset` variant compiled into the client is the same.
  Selling either as offline capability would be selling something no server can
  withhold.
- **A denied import would charge twice.** Counting an imported game against
  `game.create.success` or `games.openCreated` would spend allowance on a game
  this engine never hosted, for a player who may never create a server game at
  all.

The engine still records the content a local game selected, through the same
`contentForCreate` hook, so replay and a later device read the same immutable
snapshot an online game would. Snapshotting is for replay integrity; it is not
an ownership assertion, and it is not re-checked as though the creator had
bought it.

What remains sellable around offline play is the part a server actually
performs: hosting the imported game and carrying it to a second device. Metering
retention or sync would be a new engine capability with a real enforcement
point, and needs its own accepted decision rather than an extension of
`game.create` — whose access modes are exactly `GameAccess`, and which would
misdescribe an operation whose creation happened elsewhere.

This list originally also named serving the imported game's replay, under
`replay.read`. The 2026-09-15 amendment removes it. A local game is private and
has one human seat, so the only account that can open its replay is its creator,
and `GET /games/{gameId}/local` already hands that same account the whole
transcript with no capability. A `replay.read` check on the frames route would
refuse through one route what the other serves, and protect nothing. The frames
route therefore exempts the local origin from `replay.read` and from viewer-owned
content alike; a price on keeping offline games belongs to the retention decision
above.

## Game-owned content resources

The game declares content collections and their items. For chess, the resource
is `chess_variant/misere`, not `allow_misere_chess`:

```ts
content: {
  chess_variant: {
    misere: { classification: "sharedRuleset" },
  },
  board_theme: {
    supporter_gold: { classification: "cosmetic" },
  },
}
```

Free content ownership belongs in the free access grant. The content registry
only classifies known resources; it does not duplicate entitlement policy.

Content has one of two commercial classifications:

- `sharedRuleset`: a game-wide option applied symmetrically to all seats and
  allowed to influence authoritative rules; or
- `cosmetic`: a per-account or snapshotted presentation choice that
  authoritative game rules MUST NOT read.

External services such as AI and analysis use their fixed capabilities rather
than pretending to be content.

### Extracting selected content

Game configuration is arbitrary typed JSON, so an Eigen route cannot infer that
`config.variant` selects a commercial resource. Each versioned TypeScript rules
unit MAY expose a pure, typed extraction hook:

```ts
contentForCreate({ config }) {
  return [{
    collection: "chess_variant",
    id: config.variant,
    ownership: "creator",
  }];
}
```

The hook receives only already-validated creation inputs. It returns resource
references and ownership scope; it MUST NOT receive account entitlements,
provider state, or storage access.

The engine verifies that every returned collection and item exists and has a
compatible classification. An unknown result is a game bug. Shared fixtures
SHOULD cover every creation option that can produce a commercial resource.

Typed extraction is preferred to string JSON paths: it preserves the config
type, handles computed and nested choices, and stays co-located with the rules
version that understands the config. Provider identifiers and prices do not
belong in `game-contract.json` and do not require a game schema-version bump.

### Ownership scopes

A selected resource declares one engine-owned scope:

```ts
type OwnershipScope = "creator" | "eachParticipant" | "viewer";
```

- `creator`: checked before creation; invited participants may join without
  owning the resource. This is the recommended default for shared variants and
  maps because it preserves multiplayer network effects.
- `eachParticipant`: checked before a participant is seated. It is appropriate
  for personal cosmetics or other non-advantageous personal content, not paid
  gameplay power.
- `viewer`: checked when opening a protected replay or analysis surface.

At creation, the engine persists the resolved content references,
classifications, and scopes with the game. Join and replay decisions use that
immutable snapshot rather than rerunning a later catalog policy. The game and
its replay therefore remain understandable after a catalog or entitlement
changes.

## Commercial limits and allowances

Permissions answer whether an operation is available. A limit answers how much
of an engine-owned metric is available. The two are independent.

The initial metric families are:

```ts
type CommercialMetric =
  | "game.create.success"
  | "games.openCreated"
  | "bot.game.success"
  | "analysis.run.success";
```

Metric names are engine-owned. New metered operations require the same deliberate
extension as new capabilities.

A limit is one of:

```ts
type CommercialLimit =
  | {
      metric: CommercialMetric;
      maximum: number;
      period:
        | { kind: "calendarMonth"; timezone: "UTC" }
        | { kind: "subscriptionPeriod" }
        | { kind: "lifetime" }
        | { kind: "concurrent" };
    }
  | {
      metric: CommercialMetric;
      maximum: "noCommercialLimit";
    };
```

Rolling-duration windows are not in the initial model. They are harder to
explain, audit, cache, and support than explicit calendar or subscription
periods.

The absence of a metric means there is no commercial limit for that operation.
It does not require an explicit unlimited grant. This supports a game that
sells cosmetics while leaving creation commercially unrestricted.

Examples:

```text
Game A free profile
  game.create.success = 5 per UTC calendar month

Game A permanent supporter entitlement
  game.create.success = noCommercialLimit
  owns board_theme/supporter_gold

Game A Pro subscription
  game.create.success = noCommercialLimit while active
  bot.use/advanced
  analysis.run.success = 100 per subscription period

Game B free profile
  no game-creation metric

Game B supporter entitlement
  cosmetics only
```

`games.openCreated` counts games created by the account whose lifecycle remains
`waiting`, `ready`, or `active`; finished and cancelled games release capacity.
It does not count games the account merely joined. This keeps accepting an
invitation from unexpectedly consuming the recipient's creator capacity.

`game.create.success` counts successful creation across public, friends, and
private access modes unless a future engine metric deliberately distinguishes
them. Both metrics count games this engine created. A game played offline and
later imported is not one of them; see _Offline play_ below.

### Grant composition

Effective access combines grants with fixed rules:

- permissions are the union of all active grants;
- content ownership is the union of all active grants;
- `noCommercialLimit` dominates a numeric maximum;
- numeric maxima for the same metric and compatible period use the greatest
  active maximum rather than addition; and
- usage already recorded in the active window is never rewritten when an
  entitlement begins or ends.

For example, a free limit of 5 and permanent supporter limit of 20 yields 20,
not 25. If an active subscription supplies `noCommercialLimit`, it dominates
while active. On expiry, the player falls back to the best remaining grant.
Existing usage is compared with that fallback; a player already above it simply
cannot perform another limited operation until usage or concurrent state falls
below the limit.

A catalog MUST NOT assign incompatible period kinds to the same metric unless
the engine later defines explicit cross-period composition. Catalog validation
rejects such ambiguity.

Purchased top-ups such as "ten more creations" are consumable balances, not
limit grants. Consumable currencies, balance transfers, gifting, and per-game
reservation sagas are deferred and are not approximated by additive limits.

## Backend enforcement points

Eigen owns when checks happen. The game supplies registered resources and typed
selection metadata; it does not scatter entitlement reads through routes.

| Engine operation | Access evaluation |
| --- | --- |
| Authenticated application entry | `app.access`, when the game configures it |
| Create game | `game.create(access)`, `game.create.rated` when rated, selected creator-owned content, and configured creation limits |
| Create solo game | private creation requirements plus every selected `bot.use` requirement and creation/bot limits |
| Join or join by code | `game.join(stored access)` plus snapshotted `eachParticipant` content |
| Add bot | `bot.use` for the selected bot/tier |
| Open protected replay | `replay.read` plus snapshotted viewer requirements; neither for a game played offline |
| Run analysis | `analysis.use` plus its configured allowance |
| Equip cosmetic | `content.use(collection, id)` before persisting selection |
| Import a local game | `app.access` and abuse limits only; no capability, content, or limit check |

Ordinary game actions, reconnect, finish, forfeit, leave, purchase restoration,
and reading one's own commerce state do not acquire a fresh paid capability.
The game DO never calls Google Play, Stripe, or the commerce ledger while
committing a move.

Authorization loads the locally projected D1 access state. Provider APIs are
not on game-operation hot paths. Signed provider notifications and scheduled
reconciliation update the projection asynchronously.

A denied operation returns a typed error such as:

- `registrationRequired`;
- `capabilityRequired`;
- `contentRequired`;
- `commercialLimitReached`; or
- `purchasePending`.

The response identifies the failed fixed capability or registered resource and
may list registered offers that can satisfy it. It never exposes provider
tokens or internal transaction identifiers.

## Operation-specific game-creation identity

Commercial limits make ambiguous duplicate creation unacceptable. A response
may be lost after a game and one usage entry commit; blindly creating again can
consume a second allowance or occupy a second capacity slot.

Both game-creation routes therefore require a stable client-created
`creationId`. It is part of the creation operation rather than a generic command
protocol. The authority binds:

```text
authenticated creator + creationId + canonical creation fingerprint
```

The same identity and fingerprint return the original game identifiers. Reuse
with a different fingerprint fails without creating or consuming anything.

The D1 transaction atomically records the creation identity, game registry row,
initial participants, and any successful-use entry. A short-code collision may
retry internally under the same identity and consumes nothing until the final
game commits.

For solo creation, retry resolves the same D1 game and then re-pokes the
idempotent start transition in its Durable Object. A failure between D1 creation
and DO start therefore converges without creating or charging for another game.

This specifically supersedes RFC 0009's allowance to resynchronize and create
again after an ambiguous creation result. It does not add identity, receipts, or
durable client queues to ordinary game actions or naturally idempotent lifecycle
operations.

## Purchase and entitlement lifecycle

### Account requirement

An anonymous guest MUST upgrade to a recoverable account before checkout,
purchase claim, restoration, or provider-account association. Guest play may
remain available, but a guest cannot buy durable value that could be lost after
an uninstall, cleared storage, or device loss.

The client receives `registrationRequired` before any provider purchase UI is
launched. The stable authenticated account ID, or its provider-approved
obfuscated derivative, associates the purchase with the correct user.

### One-time products

A permanent product follows this state machine:

1. the client obtains registered, localized product details from its storefront;
2. the provider conducts checkout;
3. the client submits provider evidence to the authenticated Worker;
4. the Worker verifies the evidence directly with the provider;
5. one D1 transaction deduplicates the provider transaction, records the
   normalized purchase, and creates entitlement grants;
6. only after that commit does the client adapter acknowledge or complete
   provider delivery; and
7. retries and restoration converge on the same transaction and grants.

Pending purchases create no active entitlement. Refunds, chargebacks, and
provider revocations invalidate their source grants but do not remove access
still supplied by another valid source.

### Subscriptions

Subscriptions use the same entitlement projection and additionally normalize:

- active and renewed periods;
- pending initial payment;
- provider grace and billing-retry periods;
- cancellation at period end;
- pause or suspension where supported;
- expiry;
- refund or revocation; and
- replacement, upgrade, or downgrade where supported.

Provider status decides whether a grant remains active; client claims never
extend it. Webhooks and real-time developer notifications are hints to fetch or
verify the provider's current object, not trusted entitlement commands.

An account with permanent `supporter` and active subscription `pro` receives
the union of both. When `pro` expires, its AI, analysis, and temporary limit
grants disappear while permanent supporter content and limits remain.

The client SHOULD prevent a new checkout when an equivalent entitlement is
already active and clearly identify the provider that manages a subscription.
The ledger nevertheless handles overlapping valid sources without double
granting or incorrect revocation.

### Expiry behavior

Expiry affects new protected operations, not already committed game history:

- new premium creation, enrollment, AI, or analysis may be denied;
- an already seated player may reconnect and finish;
- existing games are not cancelled or altered;
- snapshotted shared content and cosmetics remain renderable in the game and
  replay;
- a later participant is checked only when the stored ownership scope requires
  that participant to own the resource; and
- an online service such as analysis may stop immediately after its verified
  access period ends.

## Provider adapters

The provider-neutral runtime deals only in normalized offers, transactions,
entitlements, and access grants. Each adapter owns its provider's unavoidable
differences, including checkout launch, evidence verification, pending states,
acknowledgement, restoration, notification authentication, subscription
replacement, and management links.

The intended first optional adapters are Google Play Billing for Android and
Stripe Checkout/Billing for web. StoreKit may use the same boundary when iOS
becomes a supported application target. A concrete provider is deliberately not
part of the core implementation: it requires a consuming game's merchant
account, product identifiers, SDK choice, and credential policy. Neither
provider is a dependency of the pure domain model.

Provider notifications MUST be signature- or identity-verified, deduplicated,
safe under retries, and independent of delivery order. Where a provider
notification contains only a change signal, the adapter fetches current provider
state before changing entitlements. A reconciliation job repairs missed
notifications and stuck acknowledgement work.

No adapter stores or handles card details. Purchase tokens and provider object
references are sensitive: retain only what verification and reconciliation
require, never place them in routine logs or client responses, and redact them
from diagnostics.

## Storage and authority

D1 remains a read model for live games but becomes the authority for this
separate account-scoped commerce domain. A per-game Durable Object does not own
account entitlements, and no cross-store transaction is attempted during a game
transition.

The conceptual D1 model is:

- `commerce_events`: append-only accepted provider events, unique by provider
  event identity and carrying only the minimum auditable metadata;
- `commerce_transactions`: normalized one-time or subscription source state,
  unique by provider and provider transaction/object identity;
- `entitlement_grants`: entitlement, source, validity interval, and revocation;
- `commerce_usage`: successful metered operations, uniquely linked to their
  operation-specific identity; and
- an effective entitlement/access projection for fast authenticated reads.

Exact table shapes and indexes are implementation work, but the following
invariants are normative:

- the same provider transaction cannot grant twice;
- the same provider event can be processed repeatedly without changing the
  result;
- out-of-order events converge through provider-current-state verification;
- one operation identity can consume a metered allowance at most once;
- an entitlement is active while at least one valid source grant sustains it;
- access and usage changes commit atomically where one D1 decision owns both;
  and
- commerce failure cannot partially mutate a game Durable Object.

Account deletion must be extended deliberately. Access grants and the link from
the active game account are removed, while transaction facts that the publisher
must retain for financial, fraud, refund, or legal obligations can be
irreversibly pseudonymized and retained under explicit policy. A deleted
account's purchase MUST NOT silently attach to a different new account; recovery
requires a defined support or restoration flow. Raw payment data is never part
of game export.

## Server and package integration

`createEngine` gains an optional `commerce` configuration block analogous to
other optional capabilities. It supplies the catalog, provider adapters,
binding accessors, and commerce policy. When present, the engine mounts:

- authenticated catalog, entitlement, purchase-claim, restore, checkout, and
  management routes under `/api/engine/commerce`;
- provider-authenticated webhook endpoints outside Firebase middleware;
- required OpenAPI schemas and typed errors; and
- bounded reconciliation in the scheduled surface.

Provider webhooks are separate authentication domains, just as the current bot
webhook is separate from Firebase-authenticated routes. Raw-body signature
verification happens before JSON transformation when the provider requires it.

Logical separation precedes package proliferation. The pure commerce types,
ledger, evaluator, and provider ports may initially live as modules in the
existing server/client packages. Provider SDK adapters SHOULD remain optional
packages so a game that does not enable them does not inherit their dependencies
or configuration.

The server-emitted OpenAPI document remains the normative HTTP contract. The
commerce catalog is runtime data independent of `game-contract.json`; changing
an offer, provider identifier, localized presentation, or entitlement mapping
does not by itself change a game payload schema version. Snapshotted content
requirements preserve existing-game behavior.

## Dart and Flutter integration

The pure `eigen_client` package owns commerce DTOs and a `CommerceRepository`
for catalog reads, entitlement/access snapshots, claims, restoration, and
management links. It does not depend on Flutter or a store SDK.

`eigen_flutter` defines two provider-neutral purchase ports, because the two
kinds of storefront differ in a way no single interface states honestly: an
on-device SDK owns the transaction and must be told to settle it, while a
hosted page hands control to a browser and gets it back through a return URL.

```dart
abstract interface class Storefront {
  String get provider;
}

/// The purchase UI is an on-device billing SDK.
abstract interface class PurchaseGateway implements Storefront {
  Future<List<StoreProduct>> products(Set<String> providerReferences);
  Stream<PurchaseUpdate> get updates;
  Future<void> purchase({
    required String offerKey,
    required StoreProduct product,
  });
  Future<void> restore();
  Future<void> complete(PurchaseUpdate update);
}

/// The purchase UI is a provider-hosted page.
abstract interface class HostedStorefront implements Storefront {
  Uri get returnUrl;
  Future<PurchaseUpdate> present(
    Uri checkoutUrl, {
    required String offerKey,
    required String providerReference,
  });
}
```

Both produce a `PurchaseUpdate`, so `CommerceService` verifies, settles and
publishes them on one stream whatever they came from. `complete` runs only for
an SDK gateway: a hosted page holds no transaction to settle.

Which storefronts a build carries is an application composition decision, made
at the composition root and not by the server. The server holds no routing
policy — jurisdiction and distribution rules change slowly enough that an app
release is an acceptable way to change them, and a policy split between a
deployment and a binary would be worse than one in a single place. A client
tells the catalog route which storefronts it carries so the Worker does not
call payment APIs for prices that client could never render; that is the client
declaring what it is, not the server deciding what it may do.

Purchase updates are evidence to send to the Worker, not permission to unlock
locally.

The optional shell may provide:

- a store and entitlement screen;
- capability/content lock presentation;
- purchase pending, success, cancellation, and failure states;
- restore purchases;
- manage subscription;
- limit-used, remaining, and reset information; and
- upgrade calls to action derived from typed access errors.

The game may replace all presentation while consuming the same client APIs.
The client may mirror access for immediate UX, but the server re-evaluates every
protected operation.

### Erasure outlives the provider

Account deletion removes grants, usage, capacity and open checkouts, and
anonymizes transactions rather than deleting them — a transaction is a record
of money as well as of a person. The provider knows none of this: it keeps the
account identifier it was given at checkout, and a cancellation or a final
renewal may arrive weeks later naming an account that no longer exists.

The ledger therefore refuses to write for an account it cannot find, and a
transaction whose user is already null is read as erased rather than as
belonging to somebody else. The notification is still accepted and recorded as
handled, because a rejection would only have the provider redeliver it for
days against an account that is never coming back.

Local development and tests use an explicit fake provider that can issue,
expire, renew, refund, and revoke deterministic transactions without a merchant
account or network access. A missing production adapter fails only commerce;
it does not prevent unrelated local play.

## Catalog validation

Startup and CI fail for an invalid commerce definition. Validation includes:

- unique offer, entitlement, content, capability-resource, and metric keys;
- every offer grants declared entitlements;
- every entitlement references fixed capabilities and registered resources;
- provider product IDs do not map ambiguously;
- free grants and paid grants use valid capability parameters;
- content extraction returns only declared resources;
- one metric does not combine incompatible period policies;
- subscription-period allowances originate from a subscription entitlement;
- commerce grants and provider state are unavailable to authoritative game-rule
  inputs, while games retain the obligation not to branch rules on cosmetic
  configuration; and
- no advertising or paid-advantage grant type exists.

### What validation cannot see

Startup validation proves the catalog is consistent with itself. It cannot
prove the catalog is consistent with what has already been sold, because the
ledger is data and the catalog is code, and the engine will not read a
deployment's grants to decide whether its own configuration is legal.

That makes two identifiers permanent from the moment anything is sold under
them:

- **An `entitlement` key.** Every grant row names one. Renaming a key does not
  migrate the grants that carry the old name — it silently revokes the
  entitlement for everyone holding it, and the deployment starts cleanly with
  no error anywhere.
- **An `offer` key.** Every transaction row names one, and a claim resolves
  through it. Renaming one orphans that purchase history and breaks
  restoration for anyone who bought it.

Provider product references (a Stripe Price, a Play product id) are the
exception: they may be re-pointed freely, because a transaction records the
reference it was actually bought at and the catalog only maps the current one.

A key that must change is therefore a data migration, not an edit. Treat both
as append-only: introduce the new key, grant it alongside the old one, and
retire the old one only once nothing holds it.

## Observability and operations

Structured logs and metrics identify the request, provider, logical offer,
normalized lifecycle transition, entitlement, result, and reconciliation lag
without logging purchase tokens, raw receipts, personal payment information, or
private game payloads.

Operator diagnostics must distinguish:

- checkout not started;
- provider purchase pending;
- verification failed;
- verified but entitlement commit failed;
- entitlement committed but provider acknowledgement pending;
- webhook rejected or duplicated;
- subscription state stale;
- restoration conflict; and
- commercial denial versus abuse-rate denial.

Reconciliation is bounded, retryable, idempotent, and operator-visible. A
provider outage degrades acquisition and refresh, never silently grants access
or corrupts live games.

## Required proof

Before commerce is called production-ready, automated tests must cover:

- free, permanent, subscription, overlapping, expired, and revoked grants;
- permission union, content union, greatest-limit, and unlimited-dominance
  composition;
- no configured creation limit, calendar-month creation limits, concurrent
  capacity, subscription-period allowances, and hard safety ceilings;
- boundary resets and subscription renewal/grace/expiry;
- creation retry with the same identity, conflict on changed payload, short-code
  collision, and loss before and after the D1 commit;
- solo retry across the D1-to-Durable-Object boundary;
- forged evidence, another account's purchase token, duplicate transactions,
  duplicate and out-of-order provider events, missed notifications, refunds,
  and restoration after reinstall;
- guest rejection before provider checkout;
- creator, participant, and viewer ownership scopes;
- entitlement expiry without cancelling or changing an existing game;
- authoritative rules being unable to read cosmetic grants;
- account deletion and pseudonymized retained transaction policy;
- every concrete Android or web adapter's parity at the normalized API
  boundary: the shape of a verified transaction, refusal of evidence naming no
  purchase, a batch surviving one unreadable row, storefront capabilities
  declared by presence rather than by a stub, a signature that does not verify,
  and no credential quoted in a failure; and
- commerce-disabled local creation with no provider dependency or credential;
  and
- importing a game played offline while the account's creation allowance is
  already exhausted, consuming no allowance and acquiring no capability;
- a purchase failing to raise an abuse ceiling, however generous its
  commercial limit; and
- authoritative rules receiving no entitlement, access decision, or provider
  state, asserted on the arguments the hook is actually handed;
- a provider notification arriving after an account is erased, changing nothing
  and still being accepted rather than left for redelivery; and
- a creation losing an allowance slot to another of the same account's
  creations being retried rather than reported as the allowance being spent.

The testkit supplies provider fakes and reusable lifecycle fixtures. Generated
scaffolds that enable commerce run the same conformance suite.

## Non-goals

This decision does not add:

- advertising or rewarded advertising;
- an Eigen marketplace, merchant-of-record service, revenue share, seller
  onboarding, tax remittance, or payouts;
- real-money wagering, cash-prize tournament compliance, or peer-to-peer
  payments;
- paid competitive advantages;
- consumable currency, gifting, trading, transferable inventory, additive
  top-ups, or cross-authority spend reservations;
- arbitrary game-defined authorization verbs;
- provider calls inside game transitions; or
- a generic idempotency protocol for all mutations.

Those are distinct product and correctness problems. Any future addition needs
its own accepted decision rather than an escape hatch in this model.

## Consequences

Games can choose no commercial limits, UTC calendar-month creation allowances,
concurrent creator capacity, subscription-period service allowances, permanent
limit removal, cosmetics, shared variants, AI, analysis, or combinations of
them without changing engine routes.

The engine takes on meaningful security, storage, reconciliation, client, and
provider-maintenance responsibilities. In return, implementors do not rebuild
the most failure-prone parts of monetization, and access decisions remain
consistent with the platform's existing authority boundaries.

Game creation becomes operation-specifically idempotent. D1 is authoritative
for account commerce while remaining non-authoritative for live game state.
Commercial policy remains independently deployable, but every game snapshots
the paid resources necessary to keep its future play and replay stable.
