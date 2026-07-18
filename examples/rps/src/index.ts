/**
 * The RPS example worker — the whole implementor surface (§2.3): the rules
 * module, a `GameDO` subclass binding it, and one `createEngine` call.
 * Deploys with `pnpm deploy` (engine D1 migrations apply, then the code).
 */

import { BaseGameDO, createEngine } from "@eigen/server";
import { gameModule as rpsGame } from "./rules";

export class GameDO extends BaseGameDO<Env> {
  protected readonly gameModule = rpsGame;
  protected d1(env: Env): D1Database {
    return env.rps_dev;
  }
}

export default createEngine({
  gameModule: rpsGame,
  d1: (env: Env) => env.rps_dev,
  gameDO: (env: Env) => env.GAME_DO,
});
