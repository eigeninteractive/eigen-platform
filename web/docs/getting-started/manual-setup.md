---
sidebar_position: 4
title: Set up without the scaffolder
description: Create the Worker and Flutter halves by hand, in one repository or two, using only the published EigenInteractive packages and game-contract.json.
---

# Set up without the scaffolder

`create-eigen-game` is a convenience, not a framework requirement. A game is
valid when its Worker and app satisfy the two public package contracts and
share one generated `game-contract.json`; the directories may live together or
in separate repositories.

Use this path when you are adding EigenInteractive to an existing app, need
independent
Worker and app release cycles, or want to own the project layout yourself.

## Create the Worker

Start a TypeScript Cloudflare Worker and add the runtime, rules contract, schema
library, and test tooling:

```bash
mkdir server && cd server
npm init -y
npm install @eigeninteractive/server @eigeninteractive/rules zod
npm install --save-dev @eigeninteractive/testkit wrangler typescript vitest @types/node
```

pnpm works equally well. Keep `@eigeninteractive/rules` as a direct dependency:
`server` and `testkit` consume it as a peer so the process has one rules
contract instance.

Use this minimum application-owned layout:

```text
server/
├── src/
│   ├── index.ts
│   └── module/
│       ├── index.ts              # default export: GameModule
│       ├── v1.ts                 # one GameRules unit
│       └── fixtures/v1/*.json
├── test/twin.spec.ts
├── package.json
├── tsconfig.json
├── vitest.config.mts
└── wrangler.jsonc
```

`vitest.config.mts` exists for one option. The fixture runner reads its JSON with
`readFileSync`, so those files are not in Vite's module graph, and `test:watch`
would otherwise ignore a fixture-only edit:

```ts
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    forceRerunTriggers: [...configDefaults.forceRerunTriggers, "**/src/module/fixtures/**/*.json"],
  },
});
```

Spread the defaults rather than replacing them; that merge is shallow.

Default-export the module from `src/module/index.ts`:

```ts
import type { GameModule } from "@eigeninteractive/rules";
import { rulesV1 } from "./v1.js";

export default { versions: { 1: rulesV1 } } satisfies GameModule;
```

The Worker entry point only composes your module with engine-owned runtime:

```ts
import { BaseGameDO, createEngine } from "@eigeninteractive/server";
import gameModule from "./module/index.js";

export class GameDO extends BaseGameDO<Env> {
  protected readonly gameModule = gameModule;
  protected d1(env: Env) => env.GAME_DB;
}

export default createEngine({
  gameModule,
  appName: "My Game",
  d1: (env: Env) => env.GAME_DB,
  gameDO: (env: Env) => env.GAME_DO,
});
```

Add the game name and contract commands to `package.json`:

```json
{
  "type": "module",
  "eigen": { "game": "My Game" },
  "scripts": {
    "contract": "eigen-contract",
    "contract:check": "eigen-contract --check",
    "dev": "wrangler dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "wrangler types && tsc --noEmit"
  }
}
```

The `eigen.game` value is the source of generated Dart type names. See
[The contract](../build-a-game/the-contract.md) for the rules unit and
[Deploy the Worker](../ship-it/deploy-the-worker.md) for the required D1,
Durable Object, cron, and migration configuration.

## Create the Flutter app

Create a normal Flutter app, then add the presentation package, optional
Firebase adapter, and Firebase Core used by the generated options file:

```bash
flutter create --empty --platforms android,web --org com.example my_game
cd my_game
flutter pub add eigen_flutter eigen_shell eigen_firebase firebase_core
```

`flutter_local_notifications`, used by the Firebase adapter for foreground delivery,
requires core-library desugaring in the Android application module. The
scaffolder configures this automatically; for a hand-created app, append the
following to `android/app/build.gradle.kts`:

```kotlin
android {
    compileOptions {
        isCoreLibraryDesugaringEnabled = true
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
```

The standard Firebase app imports the presentation and adapter barrels:

```dart
import 'package:eigen_flutter/eigen_flutter.dart';
import 'package:eigen_shell/eigen_shell.dart';
import 'package:eigen_firebase/eigen_firebase.dart';
```

Create `lib/game/module.dart`, register the same version keys as the TypeScript
module, and call `runEigenShell` with an `initializeEigenFirebase` initializer
from `lib/main.dart`. The
[Creation UI](../build-a-game/creation-ui.md) and
[Rendering](../build-a-game/rendering.md) pages contain the two handwritten
Dart pieces.

Create `app-config.json` beside `pubspec.yaml` with `API_BASE_URL`,
`GOOGLE_WEB_CLIENT_ID`, the optional `APP_HOST` and `AUTH_DOMAIN`, and the
public `FIREBASE_VAPID_KEY`. Read them once with `const String.fromEnvironment` in
`main.dart`. Pass `API_BASE_URL` and `APP_HOST` into `EngineConfig`; pass the
three Firebase values into `FirebaseAdapterConfig`. Use
`--dart-define-from-file=app-config.json` for both Android and web commands.
The complete shape and validation rules are in
[Configuration](../ship-it/configure.md#the-app).

After installing and authenticating the Firebase and FlutterFire CLIs, run the
engine's setup executable from the Flutter repository root:

```bash
dart run eigen_firebase:configure_firebase
```

It generates FlutterFire's platform files and
`web/firebase-config.js` for the messaging worker from the same selected Web
app. Keep the scaffold's `firebase-messaging-sw.js` and
`flutter_bootstrap.js`; do not duplicate Firebase identifiers by hand.

For web, add the Firebase Messaging service worker and register it from a custom
`web/flutter_bootstrap.js`; configure a fixed local origin in the Worker and
Firebase. The scaffold supplies those files automatically. Manual projects can
copy the small setup from [Deploy the web app](../ship-it/deploy-the-web-app.md).
Pass the project's public VAPID key into `FirebaseAdapterConfig`; the web app
treats a missing key as deployment misconfiguration rather than disabling
notifications.

On the Worker, set `FIREBASE_PROJECT_ID` and store that project's
`FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` as secrets. Those Admin
credentials are required for both FCM and complete account deletion; player
permission and individual push delivery remain optional at runtime.

## Connect the halves

Emit the contract from the Worker:

```bash
cd server
npm run contract
```

Transfer that exact `game-contract.json` to the app repository, then generate
the Dart payloads and copied fixtures:

```bash
cd app
flutter pub add --dev eigen_codegen
dart run eigen_codegen:generate_payloads \
  --contract path/to/game-contract.json \
  --output lib/game/generated/payloads.dart \
  --fixtures-output test/fixtures
flutter test
```

Commit both generated outputs. In CI, run `npm run contract:check` in the
Worker and the Dart generator with `--check` in the app.

For separate repositories, promote the contract as an immutable build artifact
and pin it by checksum. The app does not need Worker source, and the Worker does
not need Flutter source. See
[The cross-repository contract](../reference/cross-repo.md).
