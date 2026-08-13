# Contributing to the EigenInteractive platform

The platform is one compatibility unit even though its imported build systems
remain separate for now. A protocol or game-contract change is incomplete until
the server, generated Dart API, Flutter runtime, examples, and documentation all
agree in the same commit.

## Setup

Use Node and Flutter versions from `server/.nvmrc` and `flutter/.fvmrc`, then:

```bash
(cd server && pnpm install --frozen-lockfile)
(cd web && pnpm install --frozen-lockfile)
(cd flutter && flutter pub get && flutter pub get --directory example)
```

The tracked `pubspec_overrides.yaml` files make Flutter consume the generated
Dart API under `server/clients/dart` from this checkout. Published package
constraints remain unchanged.

## Validation

Run the complete baseline before handoff:

```bash
./tool/check.sh all
```

During iteration, `server`, `flutter`, and `web` may be passed instead of
`all`. The complete check additionally builds and tests a freshly scaffolded
game. Generation checks compare both tracked content and the exact file set;
commit generated changes with their source rather than bypassing those checks.

## Scope and history

Read the nested `AGENTS.md` and `CONTRIBUTING.md` before changing a component.
Do not rewrite imported history or mutate the original repository remotes. The
archive refs and import anchors are described in
`docs/architecture/0000-monorepo-import.md`.
