# Client migration plan

How the Flutter client moves from the Supabase backend to the Cloudflare-native
server. This is the **sequenced plan**; it sits alongside the
other two client docs:

| Doc | Role |
|---|---|
| [`client_reference.md`](./client_reference.md) | The **target state** — how the client works once migrated. |
| [`client_changes.md`](./client_changes.md) | The **delta list** — every server change and the client work it implies, tracked to `done`. |
| **this file** | The **plan** — topology, tooling, keep/rewrite inventory, and the ordered stages that get us there. |

> Lives in `eigen-server` for now (with the other two) because the client work
> hasn't started. It moves into the client repo once Stage 0 lands, and retires
> at cutover — `client_reference.md` becomes the single golden client doc.

> **Naming.** The client repo `eigen_engine` is renamed **`eigen-flutter`** (repos
> use hyphens; the old underscore name predates the server split). Inside it, two
> pub packages (underscores — pub forbids hyphens): **`eigen_flutter`** (the
> Flutter package — everything hand-written) and **`eigen_api`** (the generated
> REST client, a build artifact consumed as a path dependency).

---

## 1. The core reframe: re-architect against the server, don't port

The Supabase coupling is narrow — 24 files, concentrated in
`game_repository.dart` (893 lines), `auth_service.dart`, `app_config.dart`, and
six small repositories. But narrow coupling is not the same as a correct shape:
the client's data and presentation layers were designed against Postgres rows,
RLS, Realtime channels, and Edge Functions. Where a layer only *looks* the way
it does because of Supabase, it is rebuilt to fit the new server rather than
adapted to it. **Do not** `flutter create` a new app; do treat any Supabase-era
shape as up for revision.

Four rules govern the rewrite:

1. **No invented interfaces.** Firebase Auth, `sqflite`, and `shared_preferences`
   are the only implementations there will ever be. Call them directly; do not
   abstract a seam for a single implementor.
2. **No mapping layers.** The generated `eigen_api` types *are* the data model.
   The hand-written freezed mirrors (`Game`, `Observation`, `Participant`,
   `PlayerInfo`, `BotInfo`, `RatingChange`) are deleted, not adapted — they
   correspond nearly 1:1 to `GameSummary`, `Frame`, `Seat`, `Player`, `Bot`, and
   `RatingDelta`. Behaviour that hung off them moves to extension methods on the
   generated types.
3. **Reuse what exists.** The Riverpod graph, the persistence patterns, theming,
   and navigation stay as patterns even where their contents change.
4. **Fix the wire at the source.** A shape that is awkward to consume is fixed
   in the server's zod schemas and regenerated — never patched around in Dart.
   (Established practice: the `ok` fields, `Error` → `ErrorResponse`, the 204/201
   statuses, the `ErrorCode` enum, the `RatingIdentity` flattening, and the
   OpenAPI tags all came from this loop.)

### Keep / rewrite inventory

| Area | Files (indicative) | Disposition |
|---|---|---|
| Auth | `features/auth/data/auth_service.dart`, `auth_providers.dart` | **Rewrite** — Supabase → Firebase Auth (Google + Apple + Anonymous, `linkWithCredential` for guest→permanent). |
| Transport client | `shared/providers/supabase_client_provider.dart` | **Delete** — replaced by a configured `Dio` + the generated `eigen_api` classes. |
| Wire models | `features/game/data/models/*`, `shared/data/models/player_info.dart`, `features/rating/data/models/rating_change.dart` | **Delete** — the generated types replace them 1:1; no adapters. |
| Game data | `features/game/data/game_repository.dart`, realtime bits in `game_providers.dart` | **Rewrite** — REST via `GamesApi`; realtime → hand-written WebSocket frame stream. |
| Reads/repos | `player_repository`, `profile_repository`, `rating_repository`, `social_repository`, `device_installation_repository`, `avatar_storage_service` | **Rewrite** — thin call sites on `MeApi`/`SocialApi`/`PlayersApi`/`BotsApi`, returning generated types. |
| Error handling | `core/errors/engine_exception.dart` | **Rewrite** — the `EIG01`–`EIG16` registry is dead; the server now publishes a typed `ErrorCode` enum to switch on. |
| Turn/budget clocks | `features/game/presentation/widgets/{budget_clock,turn_countdown,timer_builders}.dart` | **Rewrite** — `Frame` carries an absolute `deadline`; the old `turn_started_at` mirror is gone. |
| Config | `core/config/app_config.dart` | **Rewrite** — API base URL + Firebase config replace Supabase URL/anon key. |
| Local bots | `features/game/providers/local_bot_driver.dart`, `core/game/local_bot.dart` | **Delete** — bots run server-side now (offline-solo import is a separate future feature). |
| Presentation | everything in `features/*/presentation/` | **Revise** — kept where transport-agnostic, reworked where it encodes a Supabase-era shape. |
| Game contract | `core/game/*` (module, frame, players_context, timing) | **Keep** — transport-agnostic. |
| Frame/animation, theming, navigation, Riverpod graph | `features/game/providers/game_frame_provider.dart`, `core/theme`, `core/navigation`, `shared/` | **Keep**, lightly rewired to new providers. |
| Twin fixtures | `lib/testing/twin_fixtures.dart` | **Rewire** — drop the Supabase import; the fixtures themselves are shared JSON. |

---

## 2. Target topology — one Flutter package + a generated client

One repo (`eigen-flutter`), one hand-written package, one generated one:

```
eigen-flutter/
├── pubspec.yaml              # name: eigen_flutter; eigen_api as a path dependency
├── openapi/openapi.json      # vendored snapshot of the server spec
├── tool/generate_api.sh      # regenerates eigen_api from that snapshot
├── lib/                      # everything hand-written (transport included)
└── packages/
    └── eigen_api/            # GENERATED — never hand-edited
```

An earlier draft carved transport into a third, pure-Dart `eigen_sdk` package.
**That was folded into `eigen_flutter`.** The argument for it was a
compile-enforced Flutter-free boundary, but it only pays if something consumes
transport without Flutter — and nothing ever will: `GameModule` is
Flutter-bound, `strategy` is a Flutter app, and its Dart rules twins already run
under `flutter test`. Keeping it would have forced injected seams for
`firebase_auth` and `sqflite` purely to preserve a boundary with one consumer,
which is exactly the invented-interface tax rule 1 forbids. Transport lives in
`lib/` under its own directory; separation is by layer, not by pubspec.

`eigen_api` is **not** a workspace member — it is a build artifact with a
pubspec, consumed by path. It resolves standalone so its own `build_runner` can
run, and `tool/generate_api.sh` blows away and rewrites `lib/` and `doc/` on
every regeneration. Its `pubspec.yaml` is the one hand-owned file, protected by
`.openapi-generator-ignore` (see §3).

---

## 3. Tooling decisions

- **REST client — generated, via `dart-dio` + `json_serializable`.** *(Decided —
  bake-off complete.)* `tool/generate_api.sh` regenerates `packages/eigen_api`
  from the vendored spec as a committed CLI step, not build_runner-in-app. The
  paths already carry the `/api/engine` prefix, so they come for free.

  The rejected candidates: `openapi_flutter_gen` emitted code that did not
  analyze (a missing barrel export, three nullable-`toJson` errors) and leaked
  hardcoded strings from its own sample spec; the plain `dart` generator imports
  `dart:io`, which breaks web. `serializationLibrary=json_serializable` (over the
  `built_value` default) puts the generated models in the same family as the
  shell's own freezed/`json_serializable` code, so there is one serialization
  idiom in the repo.

  Server tags map to one API class per resource: `GamesApi`, `SocialApi`,
  `MeApi`, `PlayersApi`, `BotsApi`, `BotWebhookApi`.

  **Known wart:** the generator stamps `sdk: >=3.5.0` while its own
  `json_serializable` output uses Dart 3.8 null-aware elements
  ([#21815](https://github.com/OpenAPITools/openapi-generator/issues/21815)),
  and no CLI flag overrides it. So `eigen_api/pubspec.yaml` is hand-owned and
  listed in `.openapi-generator-ignore`. To unwind once the fix lands: delete
  both files and restore `rm -rf "$OUT"` in `tool/generate_api.sh`.

- **Wire enums are closed sets.** Generated enums carry no `unknown` sentinel and
  the models use `checked: true`, so an unrecognised value throws. Adding a
  member to any wire enum — `GameStatus`, `ErrorCode`, access, seat type — is a
  breaking change requiring a schema-version bump. `test/shared/api_contract_test.dart`
  pins the sets so drift fails loudly.

- **WebSocket — `web_socket_channel` primitive + a bespoke protocol layer.**
  OpenAPI covers REST only; the frame stream is hand-written. Use
  `web_socket_channel` (official, cross-platform incl. **web**) as the socket,
  then own a thin layer for our semantics: version-serial frame ordering, gap
  detection → REST range catch-up, reconnect resync, pre-start roster snapshots.
  No off-the-shelf reconnection package knows this protocol — the inner-stream /
  outer-stream reconnect pattern, driven by our version cursor. Auth on the
  upgrade goes in the query string (`?token=`), since browsers can't set headers
  on WebSocket upgrades.

- **Auth — Firebase.** `firebase_auth` for Google / Apple / Anonymous;
  `linkWithCredential` upgrades a guest in place. Every REST request sends the ID
  token as `Authorization: Bearer`; the socket sends it as `?token=`.

---

## 4. Manual steps (you run these — nothing scaffolded silently)

Staged so you always hold the mental model. I hand you the exact pubspec /
workspace diffs to paste; you run the CLIs.

**Stage 0a — rename the repo + shell package** (do this first, on its own commit)
```
# GitHub: rename the repo eigen_engine → eigen-flutter, update the local remote
# pubspec.yaml: name: eigen_engine → eigen_flutter
# repo-wide: package:eigen_engine/… → package:eigen_flutter/… (imports + exports),
#            in this repo AND in the strategy game app that depends on it
```
This is a mechanical but wide rename (every import). Land it isolated so the
transport work diffs cleanly on top.

**Stage 0b — package skeleton** *(done; superseded)* — a pub workspace with an
`eigen_sdk` member was set up here, then folded back into `eigen_flutter` (§2).
The repo is a single Flutter package again, with `eigen_api` by path.

**Stage 1 — codegen** *(done)*
```
dart pub global activate openapi_generator_cli
./tool/generate_api.sh          # refreshes the vendored spec + regenerates eigen_api
```
Rerun `tool/generate_api.sh` after **every** server wire change; it re-vendors
`openapi/openapi.json` from the sibling `eigen-server` checkout automatically.

**Stage 2 — Firebase (interactive)**
```
dart pub global activate flutterfire_cli
flutterfire configure     # writes firebase_options.dart, wires the platforms
```

**Stage 3 — dependency swap**
```
flutter pub remove supabase_flutter google_sign_in
flutter pub add web_socket_channel firebase_auth
# + dio if dart-dio is chosen; Apple sign-in package for web/iOS
```

Renames, intent-filters (Android) and associated-domains (iOS) for `/j/*` deep
links, and the web Firebase config are also yours to apply — I'll give the exact
snippets per stage.

---

## 5. Code sequence (mine, after each stage unblocks)

Ordered so the app compiles and runs against the new server as early as
possible, feature by feature. Each maps to `client_changes.md` entries.

1. **Transport foundation** (`lib/core/api/`) — a configured `Dio` with an
   interceptor that attaches the Firebase bearer token and converts a non-2xx
   `ErrorResponse` into `EngineException` carrying the typed `ErrorCode`. The
   six generated API classes are exposed as `keepAlive` Riverpod providers.
2. **Auth cutover** — Firebase replaces Supabase in `auth_service` + providers;
   guest anonymous sign-in + `linkWithCredential`; device registration
   (`PUT /me/devices` on sign-in, `DELETE` on sign-out).
3. **The socket layer** — the frame stream (ordering, gap recovery, reconnect),
   wired into the existing `game_frame_provider` so the animation model is
   unchanged downstream.
4. **Game repository** — lobby/discovery/create/create-solo/action(+`seat`)/
   forfeit(+`seat`) over REST; own-move frame rides the action response into the
   same version-deduped pipeline (as today).
5. **Reads & profile** — players batch, profile, rating, avatar upload
   (raw-binary `PUT /me/avatar`, relative-URL resolution), username edit.
6. **Social** — `/friends/*` + `/users/search` against the new routes; drop
   client-direct relationship reads.
7. **Delete the dead paths** — local-bot driver/UI, Supabase providers, the
   `is_local` bot field, client-direct DB reads.
8. **Tests** — twin-fixture drift rewired; widget tests for the reworked repos;
   an integration test per critical flow (auth, create-solo, live game, social).

---

## 6. Testing & cutover

- **Transport is tested through Dio's own seam** — `DioAdapter`/a stub adapter
  replaces the network, so frame ordering, gap recovery, reconnect, and
  error-envelope mapping are all assertable under `flutter test` without a
  server and without an injected abstraction of our own.
- **The generated surface is pinned** — `test/shared/api_contract_test.dart`
  asserts the wire enums and reshaped payloads, so a server change that
  regenerates cleanly but breaks assumptions still fails the build.
- **Twin fixtures still bind TS ↔ Dart** — the shared JSON fixtures keep the
  Dart rules twin honest against the kernel; only the Supabase import in the
  runner goes away.
- **Web is a first-class target** — verify `web_socket_channel` on web (upgrade
  `?token=`), web Firebase auth, and `cached_network_image` against the
  worker-served avatar URL. Add web to the CI matrix.
- **Cutover is big-bang, no data migration** (no production users): freeze
  Supabase, apply the D1 migrations, deploy the Worker, ship the client in one
  move. This is the point that first needs a real R2 bucket + payment method
  (avatars, cold-tier history) — see `engine_stack.md` §3.

---

## 7. Open risks / watch-items

- **Generator fidelity to the error envelope.** The whole client keys UX off the
  stable `code`; whichever generator wins must surface `{ error, code? }`
  cleanly (sealed responses help). Confirm in the bake-off before committing.
- **Web WebSocket auth.** Header auth is impossible on browser upgrades — the
  `?token=` path must be exercised on web early (token in a URL is acceptable
  here: short-lived Firebase ID token over TLS, not logged server-side).
- **Apple Sign-In on web** needs its own flow; budget for it under Mobile + Web.
- **Guest purge races** — a long-dormant guest may be swept server-side; the
  client treats "valid token, empty data" as automatic re-provision, not an
  error (`client_changes.md`, Milestone C).
- **Token refresh on the socket** — a long-lived socket outlives an ID token;
  decide refresh-and-reconnect vs. server grace, and specify it in the protocol
  layer.
