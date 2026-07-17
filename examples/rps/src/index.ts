/**
 * The RPS example worker — the whole implementor surface: the rules module,
 * a `GameDO` subclass binding it, and one harness call. `createDevHarness`
 * is the engine's TEMPORARY unauthenticated stand-in for `createEngine`
 * (the routes milestone) — see its doc in `@eigen/server`.
 */

import { BaseGameDO, createDevHarness } from "@eigen/server";
import { gameModule as rpsGame } from "./rules";

export class GameDO extends BaseGameDO<Env> {
  protected readonly gameModule = rpsGame;
  protected d1(env: Env): D1Database {
    return env.rps_dev;
  }
}

export default createDevHarness({
  d1: (env: Env) => env.rps_dev,
  gameDO: (env: Env) => env.GAME_DO,
});
