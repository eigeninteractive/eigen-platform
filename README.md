# EigenInteractive platform

[![Platform checks](https://github.com/eigeninteractive/eigen-platform/actions/workflows/checks.yml/badge.svg)](https://github.com/eigeninteractive/eigen-platform/actions/workflows/checks.yml)

EigenInteractive is a platform for building authoritative, turn-based games:
game authors write deterministic TypeScript rules, the server owns sequencing
and persistence, and generated Dart APIs plus the Flutter runtime deliver typed
game sessions to Android and the web.

This repository is the vNext implementation workspace. It is still early-stage
software with no production compatibility promise. The design is intentionally
being simplified before real applications or users depend on it.

## Repository layout

| Path | Responsibility |
| --- | --- |
| [`server/`](server/) | Rules SDK, authoritative kernel, Cloudflare Worker server, testkit, scaffolder, and generated Dart HTTP API |
| [`dart/`](dart/) | Pure Dart client runtime and development-only contract generator |
| [`flutter/`](flutter/) | Embeddable, provider-neutral Flutter integration and example game |
| [`shell/`](shell/) | Complete first-party Flutter application shell and product flows |
| [`firebase/`](firebase/) | Optional Firebase Auth, telemetry, crash reporting, push, and configuration adapter |
| [`web/`](web/) | Game-implementor documentation, generated API reference, and documentation Worker |
| [`docs/architecture/`](docs/architecture/) | Accepted vNext decisions and execution status |
| [`tool/`](tool/) | Platform manifest and whole-repository validation tools |

The three component histories were imported without squashing. Their original
repositories remain readable until the first unified releases and deployment
are verified, after which they can be archived with pointers here.
[`platform.json`](platform.json) records the exact imported commits and package
versions.

## Getting started

Use the Node version in [`server/.nvmrc`](server/.nvmrc), pnpm 11.20.0, the
Flutter version in [`flutter/.fvmrc`](flutter/.fvmrc), and JDK 21. Install each
component's dependencies from its own dependency root:

```bash
(cd server && pnpm install --frozen-lockfile)
(cd web && pnpm install --frozen-lockfile)
(cd dart/eigen_client && dart pub get)
(cd dart/eigen_codegen && dart pub get)
(cd flutter && flutter pub get)
(cd shell && flutter pub get)
(cd firebase && flutter pub get)
(cd flutter/example && flutter pub get)
```

Run the full cross-platform gate before handing off a change:

```bash
./tool/check.sh all
```

For faster iteration, pass `manifest`, `server`, `flutter`, `web`, or
`scaffold` instead of `all`. The full gate also checks generated contracts and
package contents, tests the Flutter package on the Dart VM and Chrome, builds
the imported example and documentation for web, and validates a freshly
scaffolded game with release Android and web builds.

## Architecture and documentation

The accepted vNext design lives in [`docs/architecture/`](docs/architecture/).
A protocol or game-contract change is one platform change: server behavior,
generated Dart types, Flutter runtime behavior, examples, and documentation must
land together and pass the same commit gate.

The currently published game-implementor documentation is available at
[eigeninteractive.com](https://eigeninteractive.com). During vNext development,
the repository's accepted architecture records are normative for new work; the
published site continues to describe the currently released packages until
cutover.

## CI and releases

Pull requests, direct pushes to `main`, and package releases run the same
whole-platform workflow in [`checks.yml`](.github/workflows/checks.yml). Its
contracts, server, Flutter, documentation, and scaffold checks run in parallel,
then report one stable `check` result. During vNext development that result is
advisory on `main`, which accepts direct pushes; it remains a hard gate on every
release and publish. See
[branch protection](docs/operations/branch-protection.md) for the current
posture and how to restore the protected one. Documentation-only pull requests
take a conservative fast lane through contracts and the documentation build;
release runs and any code change always use the complete gate. npm packages use Changesets;
The Dart packages use separate namespaced pub.dev tags. Publishing
uses registry trusted publishing with GitHub OIDC and environment-bound `npm` /
`pub.dev` identities, so no registry token is stored in the repository and
publishing starts automatically after the release checks pass.

The exact registry settings, routine release flow, first-cutover sequence, and
failure recovery are documented in
[`docs/operations/releases.md`](docs/operations/releases.md).

## Contributing and license

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and the nearest `AGENTS.md` before
changing a component. Report vulnerabilities privately as described in
[`SECURITY.md`](SECURITY.md). EigenInteractive platform source is available
under the [MIT License](LICENSE).
