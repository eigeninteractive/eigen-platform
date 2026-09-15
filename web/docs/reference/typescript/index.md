# TypeScript API

This reference is generated from the published package barrels. Start with the
package that owns the task you are doing:

| Package | Open it when you need to… |
|---|---|
| [`@eigeninteractive/rules`](rules.md) | Implement a `GameModule`, payload schemas, hooks, observations, ratings, or bots. This is where most game code lives. |
| [`@eigeninteractive/server`](server.md) | Compose the Cloudflare Worker with `createEngine`, `BaseGameDO`, bindings, deep links, avatars, or the public site. |
| [`@eigeninteractive/testkit`](testkit.md) | Run twin fixtures, emit/check `game-contract.json`, or drive rules through the kernel in tests. |
| [`@eigeninteractive/server/testing`](server-testing.md) | Mint local Firebase-compatible tokens and supply explicit no-op Firebase Admin effects for Worker integration tests. Never use it in production code. |

Selling something is optional. The storefronts ship inside
`@eigeninteractive/server` as separate entry points, so importing one carries
only that one into your Worker and a game that sells nothing carries none:

| Entry point | Open it when you need to… |
|---|---|
| [`@eigeninteractive/server/commerce/google-play`](server-commerce-google-play.md) | Sell through Google Play Billing on Android: purchase verification, the acknowledgement Play refunds you for skipping, and developer notifications. |
| [`@eigeninteractive/server/commerce/stripe`](server-commerce-stripe.md) | Sell on the web through Stripe: hosted Checkout, Billing subscriptions, the customer portal, and signed webhooks. |
| [`@eigeninteractive/server/commerce/razorpay`](server-commerce-razorpay.md) | Sell in India through Razorpay: payment links, subscriptions, and signed webhooks. |
| [`@eigeninteractive/server/commerce-kit`](server-commerce-kit.md) | Write your own provider adapter. The Workers-side primitives the three above share. |

Game Workers depend directly on `rules` and `server`; `testkit` and
`server/testing` are test-only. The [task guides](../../build-a-game/the-contract.md)
show how the TypeScript and Dart halves fit together.

The kernel page is an engine internal. It remains available for debugging and
contributors, but a game should not import it to implement rules or deploy a
Worker. The D1 and Durable Object storage schemas are not documented here at
all: they are private to the engine, and `readGameRow` returns a game row
typed without them.
