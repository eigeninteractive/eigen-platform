# Example Game

This repository contains the two application-owned halves of an Eigen game.
The engine itself is consumed from npm and pub.dev; its repositories are not
part of this project.

## Worker

```sh
cd server
{{PACKAGE_MANAGER}} install
{{PACKAGE_MANAGER}} run dev
```

The game module is the default export of `server/src/module/index.ts`. Whenever
a payload schema or shared fixture changes, regenerate the contract and Dart
payloads together from the repository root:

```sh
{{PACKAGE_MANAGER}} run contract
```

The scaffold includes a starter fixture and both language runners. Keep the
Worker tests watching while editing rules:

```sh
cd server
{{PACKAGE_MANAGER}} run test:watch
```

After changing a schema or fixture, run `{{PACKAGE_MANAGER}} run contract` from
the repository root, then `flutter test` from `app/`. Use
`{{PACKAGE_MANAGER}} run contract:check` from the root in CI. The server and
app commands remain independently usable if the two halves later move to
separate repositories.

## Flutter app

The initial scaffold already generates Dart payloads from the Worker contract.
Implement the client-side legality, preview and presentation rules under
`app/lib/game/`, then configure Firebase and the Worker origin in
`app/lib/main.dart`.

See `app/lib/game/README.md` for the regeneration command.
