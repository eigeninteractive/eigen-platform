# <img src="https://eigeninteractive.com/brand/favicon-32.png" width="16" align="top"> create-eigen-game

Creates one repository containing an EigenInteractive Cloudflare Worker and
Flutter app:

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

The scaffolder creates the Flutter shell explicitly for Android and web,
installs both halves, emits `server/game-contract.json`, and
generates the initial Dart payload types and typed rules base. Engine
repositories remain ordinary npm/pub.dev dependencies and are not cloned.
It also supplies a starter v1 twin fixture, a Vitest runner, a Flutter fixture
runner, watch-mode rules tests, and generated-contract drift checks. At the
generated repository root, `pnpm run contract` (or `npm run contract`) emits
the TypeScript contract and regenerates the Dart payloads in one command;
`contract:check` checks both artifacts without rewriting them.

`pnpm run deploy` (or npm) is similarly whole-project: it builds Flutter web
into the Worker's Static Assets directory, applies D1 migrations, and deploys
one same-origin Worker. The Flutter app lives at `/`; the generated native
install page lives at `/download`. Both Android and web builds read the same
public values from `app/app-config.json` through Flutter's native
`--dart-define-from-file` support.

## Template architecture

`templates/worker` is a valid standalone Cloudflare C3-style Worker template:
it contains its own `package.json`, `wrangler.jsonc`, TypeScript entry point,
generated Wrangler types, and game module. The combined CLI renders that same
template under `server/`; it does not maintain a second Worker skeleton.

`templates/app-overlay` is applied after
`flutter create --empty --platforms android,web`. It supplies the Firebase
Messaging service worker, the narrowly scoped Flutter bootstrap that registers
it before app startup, and one setup command that runs FlutterFire and derives
the worker's public Firebase configuration from the Web app FlutterFire
selected. Implementors never copy those identifiers into JavaScript by hand.
`eigen_flutter` bundles and loads the Cropper.js assets required by
`image_cropper` on web, so generated apps do not carry their own copy or
configure `web/index.html`.
On Android, `eigen_flutter` supplies FID messaging configuration through its
plugin manifest and native dependency graph; the scaffolder does not edit the
application manifest or `gradle.properties`. It adds the application-level core
library desugaring block required by `flutter_local_notifications`, because an
Android library cannot supply that compiler setting transitively. The CLI then
uses `flutter pub add` and the public
`eigen_flutter:generate_payloads` executable instead of editing Flutter's
generated YAML by hand.

The public CLI intentionally has no server-only or app-only modes.

The Worker directly depends on both `@eigeninteractive/rules` and
`@eigeninteractive/server`. Rules is the pure contract the game implements and
the shared peer identity used by server/kernel/testkit; server is the
Cloudflare runtime. Server deliberately does not re-export the rules surface.

## Documentation

- [Quickstart](https://eigeninteractive.com/docs/getting-started/quickstart)
- [Manual setup and split repositories](https://eigeninteractive.com/docs/getting-started/manual-setup)
- [Deploy the web app](https://eigeninteractive.com/docs/ship-it/deploy-the-web-app)
- [The game contract](https://eigeninteractive.com/docs/build-a-game/the-contract)
