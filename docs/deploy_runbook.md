# Deploy runbook — Phase 2 milestone 1 (the folded-in spike)

The §14 Phase 0 spike was folded into Phase 2 (decided 2026-07-16): instead
of a throwaway echo worker, the real `GameDO` skeleton ships first and THIS
runbook carries the two exit criteria only a real deploy can verify —
**hibernation billing** and **finish-sequence survival across eviction**.
Everything else is already proven under vitest-pool-workers (100 tests).

All steps below are run by hand (never by an agent). Free plan, no payment
method — one caveat about R2 in step 2.

Everything is driven through the **dev harness** in `examples/rps/src/index.ts`
— an unauthenticated, temporary stand-in for the real routes milestone.
Treat the deployment as disposable.

## 1. Apply the D1 schema

The engine owns the schema; migrations ship inside `@eigen/server`
(`migrations_dir` is already set in `wrangler.jsonc`).

```sh
cd examples/rps
npx wrangler d1 migrations apply rps_dev --local    # for wrangler dev
npx wrangler d1 migrations apply rps_dev --remote   # for the real database
```

## 2. ⚠️ R2 binding before deploying

`wrangler.jsonc` declares the `AVATARS` R2 binding for local simulation. A
**real** deploy validates bindings, and creating the bucket is the exact
moment Cloudflare demands a card — which we don't do. **Comment out the
`r2_buckets` block before `wrangler deploy`** (leave it in for `wrangler dev`;
local simulation needs no bucket). Restore it after.

## 3. Smoke the loop locally first

```sh
npx wrangler dev          # http://localhost:8787
```

Drive a full game (same-view acceptance included — both seats act against v0):

```sh
BASE=http://localhost:8787
GAME=$(curl -s -X POST $BASE/dev/games -d '{"config":{"targetWins":1},"rated":true}' | jq -r .gameId)
curl -s -X POST $BASE/dev/games/$GAME/commands -d '{"kind":"start","actor":{"userId":"dev-a","botId":null}}'
curl -s -X POST $BASE/dev/games/$GAME/commands -d '{"kind":"action","actor":{"userId":"dev-a","botId":null},"seat":0,"expectedVersion":0,"data":{"move":"rock"}}'
curl -s -X POST $BASE/dev/games/$GAME/commands -d '{"kind":"action","actor":{"userId":"dev-b","botId":null},"seat":1,"expectedVersion":0,"data":{"move":"scissors"}}'
curl -s "$BASE/dev/games/$GAME/frames?replay=1" | jq '.[].version'   # 0,1,2,3 — 3 is the ratings transition
npx wrangler d1 execute rps_dev --local --command "SELECT status, outcomes FROM games WHERE id = '$GAME'"
npx wrangler d1 execute rps_dev --local --command "SELECT user_id, mu, display_rating, revision FROM player_ratings"
```

Expect: second commit **accepted** at version 2 with outcomes in the frame;
game `finished` in D1; two `player_ratings` rows; replay frame 3 carries
`ratings` (the N+1 deltas transition).

## 4. Deploy

```sh
npx wrangler deploy       # → https://rps.<your-subdomain>.workers.dev
```

Re-run the step-3 script with `BASE=https://rps.<subdomain>.workers.dev`
(and `--remote` on the d1 execute commands).

## 5. Exit criterion A — hibernation

1. Create + start a game, then open the socket and leave it idle:
   - `npx wrangler tail` in one terminal (to see activity),
   - connect with e.g. `websocat "wss://rps.<subdomain>.workers.dev/dev/games/$GAME/socket?seat=1"`.
2. Send the literal text `ping` — you should get `pong` back **with no tail
   activity**: that's the auto-responder answering without waking the DO.
3. Leave it connected ~20–30 minutes doing nothing.
4. Dashboard → Workers & Pages → `rps` → **Durable Objects → Metrics →
   Duration (GB-s)**: the graph must flatline during the idle window while
   the **connected WebSockets** count stays at 1. That flatline IS
   hibernation — an open socket costing nothing.
5. From another shell, submit seat 0's move — the socket receives the frame
   (the DO woke, fanned out, and will hibernate again).

## 6. Exit criterion B — finish sequence survives eviction

1. Create a **rated** game, start it, submit ONE move (mid-game state).
2. Evict every DO: `npx wrangler deploy` again (a new version restarts DOs),
   or wait out an idle eviction.
3. Submit the second move — it must be **accepted as version 2** (state,
   roster, and dedupe table all reloaded from DO SQLite through the
   drizzle migrator on wake).
4. Verify the finish landed despite the eviction in between:
   ```sh
   npx wrangler d1 execute rps_dev --remote --command "SELECT status, finish_id FROM games WHERE id = '$GAME'"
   npx wrangler d1 execute rps_dev --remote --command "SELECT display_change FROM rating_history WHERE game_id = '$GAME'"
   curl -s "$BASE/dev/games/$GAME/frames?replay=1" | jq '.[3].ratings'
   ```
5. Optional belt-and-braces: `curl -X POST $BASE/dev/games/$GAME/repoke`
   must return `{"applied":false}` — nothing left in the outbox.

## 7. Deadline alarm, deployed

```sh
GAME=$(curl -s -X POST $BASE/dev/games -d '{"targetWins":1,"turnSeconds":30}' | jq -r .gameId)
curl -s -X POST $BASE/dev/games/$GAME/commands -d '{"kind":"start","actor":{"userId":"dev-a","botId":null}}'
sleep 35
npx wrangler d1 execute rps_dev --remote --command "SELECT status FROM games WHERE id = '$GAME'"
```

Expect `finished` — the alarm fired at deadline + 750 ms grace and resolved
the pending seats by timeout (both pending in RPS round 1 ⇒ draw).

## 8. Afterwards

The harness is unauthenticated. Either `npx wrangler delete` the deployment
or accept that `rps-dev` D1 holds junk dev rows until the routes milestone
replaces the harness with `createEngine` (Firebase auth, real policy gates).
