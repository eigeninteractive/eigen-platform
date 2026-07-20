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
> Flutter shell) and **`eigen_sdk`** (the pure-Dart transport SDK). The bare-Dart
> package takes the plain suffix-free style (`_sdk`, not `_dart` — pure Dart is
> the default); the Flutter binding carries `_flutter`, mirroring
> `supabase` / `supabase_flutter`.

---

## 1. The core reframe: a data-layer swap, not a rewrite

`eigen_flutter` (the renamed `eigen_engine` shell) is already layered
presentation / domain / data, and the Supabase coupling is contained to the
**data layer + auth + config**. The migration re-implements that layer against
the new server behind the same interfaces; the UI shell, the frame/animation
model, the Riverpod graph, theming, navigation, and the `core/game` contract are
transport-agnostic and stay.

**Do not** `flutter create` a new app. **Do** carve transport into its own
package (`eigen_sdk`) so the swap is a clean seam, not a diffuse edit.

### Keep / rewrite inventory

| Area | Files (indicative) | Disposition |
|---|---|---|
| Auth | `features/auth/data/auth_service.dart`, `auth_providers.dart` | **Rewrite** — Supabase → Firebase Auth (Google + Apple + Anonymous, `linkWithCredential` for guest→permanent). |
| Transport client | `shared/providers/supabase_client_provider.dart` | **Delete** — replaced by the `eigen_sdk` package. |
| Game data | `features/game/data/game_repository.dart`, realtime bits in `game_providers.dart` | **Rewrite** — REST calls via generated client; realtime → hand-written WebSocket frame stream. |
| Reads/repos | `player_repository`, `profile_repository`, `rating_repository`, `social_repository`, `device_installation_repository`, `avatar_storage_service` | **Rewrite** — thin adapters over `eigen_sdk`, same domain models out. |
| Config | `core/config/app_config.dart` | **Rewrite** — API base URL + Firebase config replace Supabase URL/anon key. |
| Local bots | `features/game/providers/local_bot_driver.dart`, `core/game/local_bot.dart` | **Delete** — bots run server-side now (offline-solo import is a separate future feature). |
| Presentation | everything in `features/*/presentation/` | **Keep** — repository interfaces hold their shape. |
| Game contract | `core/game/*` (module, frame, players_context, timing) | **Keep** — transport-agnostic. |
| Frame/animation, theming, navigation, Riverpod graph | `features/game/providers/game_frame_provider.dart`, `core/theme`, `core/navigation`, `shared/` | **Keep**, lightly rewired to new providers. |
| Twin fixtures | `lib/testing/twin_fixtures.dart` | **Rewire** — drop the Supabase import; the fixtures themselves are shared JSON. |

---

## 2. Target topology — pub workspace + `eigen_sdk`

One repo (`eigen-flutter`), a **Dart pub workspace** (SDK ≥ 3.6; the repo is on
3.9), two members:

```
eigen-flutter/                (repo root — the workspace root)
├── pubspec.yaml              # name: eigen_flutter; workspace: [ ., packages/eigen_sdk ]
├── lib/                      # Flutter shell (eigen_flutter) — depends on eigen_sdk
└── packages/
    └── eigen_sdk/            # pure Dart, NO Flutter
        ├── lib/src/api/      # generated from openapi.json (committed)
        ├── lib/src/socket/   # hand-written frame stream + gap recovery
        └── lib/eigen_sdk.dart
```

**Why a separate pure-Dart package (not in-place):** the generated REST client,
the WebSocket protocol layer, and token plumbing are pure Dart — no Flutter — so
they're independently testable, reusable by tooling and the future offline-solo
replay path, and mirror the server's clean separation. **Why same repo (not a
second git repo):** one thing to version and branch through the heavy churn; a
path/workspace dependency, not a published one.

`eigen_sdk` **does not own Firebase.** It exposes a token-provider seam
(`Future<String> Function()`) that the Flutter shell fills from `firebase_auth`.
Transport stays Flutter-free.

---

## 3. Tooling decisions

- **REST client — generate, don't hand-write.** Generate from the server's
  vendored `packages/server/openapi.json` into `eigen_sdk/lib/src/api`, as a
  **committed CLI step** (reviewable, regenerated on spec change) — *not*
  build_runner-in-app that regenerates every build. The paths already carry the
  `/api/engine` prefix, so they come for free. **Generator: bake-off then
  decide** — prototype both against the real spec:
  - `openapi_generator_cli` (dart-dio) — mature, dio-based, widely used.
  - `openapi_flutter_gen` — 2026, standalone CLI, zero build_runner, immutable
    models + sealed exhaustive responses (fits the `{ error, code? }` model).

  Judge on: fidelity to `openapi.json` (enums, nullable, the error envelope),
  web compatibility, generated-code ergonomics, and regen friction.

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

**Stage 0b — workspace + SDK package skeleton**
```
# repo root
mkdir -p packages/eigen_sdk
cd packages/eigen_sdk && dart create -t package . --force
# add `workspace:` to the root pubspec and eigen_sdk as a workspace member,
# then declare eigen_sdk as a dependency of eigen_flutter (path/workspace)
dart pub get
```

**Stage 1 — codegen bake-off**
```
dart pub global activate openapi_generator_cli      # option A
# and/or add openapi_flutter_gen as a dev tool       # option B
# generate from packages/server/openapi.json into eigen_sdk/lib/src/api
```

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

1. **`eigen_sdk` foundation** — generated REST client + typed error envelope;
   the token-provider seam; a `Dio`/http interceptor that attaches the bearer
   and maps `{ error, code? }` to a typed `EngineException` (preserving the
   stable `code`).
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

- **`eigen_sdk` is unit-testable without Flutter** — fake the token provider
  and the socket transport; assert frame ordering, gap recovery, reconnect, and
  error-envelope mapping in pure Dart.
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
