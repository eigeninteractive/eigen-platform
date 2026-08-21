---
"create-eigen-game": patch
---

Scaffold Firebase through the optional `eigen_firebase` adapter package. New
apps keep Eigen server configuration in `EngineConfig`, pass Firebase values to
`FirebaseAdapterConfig`, and opt into release-only telemetry explicitly.
