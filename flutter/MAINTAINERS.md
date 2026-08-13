# Maintaining eigen_flutter

Registry configuration, namespaced tags, release operations, approval points,
verification, and failure recovery are owned once for the monorepo in
[`../docs/operations/releases.md`](../docs/operations/releases.md).

Flutter changes continue to accumulate consumer-facing notes in
[`CHANGELOG.md`](CHANGELOG.md). Start a release through the root
`version-eigen-flutter.yml` workflow; do not hand-edit the package version or
publish directly except as an explicitly documented recovery operation.
