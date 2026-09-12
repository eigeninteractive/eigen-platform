# Changelog
## [Unreleased]
### Added
- Generate a State payload type per version, and a per-version local rules base (RpsV1LocalRulesBase for a game named Rps) that a game on-device rules unit extends.

## [0.1.2] - 2026-09-09
- Generate public payload classes from root-local `$defs` when draft 2020-12
schemas represent the root as a `$ref`.

## [0.1.1] - 2026-08-21
- Format generated payloads against the package's Dart 3.12 language baseline
instead of the formatter library's moving latest version, keeping generation
deterministic across newer SDK releases.

## [0.1.0] - 2026-08-21
- Initial package: extract the contract payload generator and CLI from
`eigen_flutter`.

[Unreleased]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_codegen-v0.1.2...HEAD
[0.1.2]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_codegen-v0.1.1...eigen_codegen-v0.1.2
[0.1.1]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_codegen-v0.1.0...eigen_codegen-v0.1.1
[0.1.0]: https://github.com/eigeninteractive/eigen-platform/tree/eigen_codegen-v0.1.0
