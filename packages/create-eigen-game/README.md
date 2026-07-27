# create-eigen-game

Creates one repository containing an Eigen Cloudflare Worker and Flutter app:

```sh
pnpm create eigen-game my-game
# or
npm create eigen-game@latest my-game
```

The command detects npm or pnpm from the invoking package manager. Pass
`--package-manager npm|pnpm` to override it and `--org games.example` to set
the Flutter organization. The destination basename is the one required
lowercase kebab-case slug. The CLI derives the display name (`My Game`), Dart
package name (`my_game`), and type prefix (`MyGame`) from `my-game`; there is no
separate name or prefix input.

The generated project has two application-owned halves:

```text
my-game/
├── server/   # authoritative TypeScript rules and Cloudflare Worker
└── app/      # generated Dart payloads and handwritten Flutter presentation
```

The scaffolder installs both halves, emits `server/game-contract.json`, and
generates the initial Dart payload types and typed rules base. Engine
repositories remain ordinary npm/pub.dev dependencies and are not cloned.
It also supplies a starter v1 twin fixture, a Vitest runner, a Flutter fixture
runner, watch-mode rules tests, and generated-contract drift checks. At the
generated repository root, `pnpm run contract` (or `npm run contract`) emits
the TypeScript contract and regenerates the Dart payloads in one command;
`contract:check` checks both artifacts without rewriting them.

## Template architecture

`templates/worker` is a valid standalone Cloudflare C3-style Worker template:
it contains its own `package.json`, `wrangler.jsonc`, TypeScript entry point,
generated Wrangler types, and game module. The combined Eigen CLI renders that
same template under `server/`; it does not maintain a second Worker skeleton.

`templates/app-overlay` is applied after `flutter create --empty`. The CLI then
uses `flutter pub add` and the public `eigen_flutter:generate_payloads`
executable instead of editing Flutter's generated YAML by hand.

The public CLI intentionally has no server-only or app-only modes.

The Worker directly depends on both `@eigeninteractive/rules` and
`@eigeninteractive/server`. Rules is the pure contract the game implements and
the shared peer identity used by server/kernel/testkit; server is the
Cloudflare runtime. Server deliberately does not re-export the rules surface.
