## 0.1.2 - 2026-09-09

- Generate public payload classes from root-local `$defs` when draft 2020-12
  schemas represent the root as a `$ref`.

## 0.1.1

- Format generated payloads against the package's Dart 3.12 language baseline
  instead of the formatter library's moving latest version, keeping generation
  deterministic across newer SDK releases.

## 0.1.0

- Initial package: extract the contract payload generator and CLI from
  `eigen_flutter`.
