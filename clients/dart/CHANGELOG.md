# Changelog

This package is generated from the Eigen engine's OpenAPI specification and its
version tracks [`@eigeninteractive/server`](https://www.npmjs.com/package/@eigeninteractive/server)
exactly — 0.2.3 here is 0.2.3 there. It has no changes of its own.

See the engine's changelog:
<https://github.com/eigeninteractive/eigen-server/blob/main/packages/server/CHANGELOG.md>

While the engine is pre-1.0, a breaking wire change bumps the **minor** — a
constraint of `^0.1.0` resolves to `>=0.1.0 <0.2.0`, so 0.1.x is additive and
0.2.0 is the break. From 1.0.0 on it is the major, as usual.

Generated enums include an `unknownDefaultOpenApi` sentinel so an installed
client can decode enum members introduced by a newer server. The sentinel is
read-side compatibility only: serialising it emits
`unknown_default_open_api`, which is not a value accepted by the API.
