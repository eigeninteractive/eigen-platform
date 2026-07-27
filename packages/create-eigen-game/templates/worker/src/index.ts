import { BaseGameDO, createEngine } from "@eigeninteractive/server";
import gameModule from "./module/index.js";

export class GameDO extends BaseGameDO<Env> {
  protected readonly gameModule = gameModule;

  protected d1(env: Env): D1Database {
    return env.GAME_DB;
  }
}

export default createEngine({
  gameModule,
  appName: "Example Game",
  d1: (env: Env) => env.GAME_DB,
  gameDO: (env: Env) => env.GAME_DO,
});
