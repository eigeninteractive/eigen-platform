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

  // Uncomment to turn on the game's public website: the download page grows a
  // tagline, screenshots and structured data, and /terms, /privacy and
  // /delete-account start serving the engine's default documents with your
  // details in them. The app stores require all three, so this is not optional
  // for long — but read what they say before you publish, because you are the
  // one on the hook for it. https://eigeninteractive.com/docs/ship-it/branding
  //
  // site: {
  //   tagline: "Race an opponent to the target.",
  //   primaryColor: "#006a60",
  //   screenshots: ["1.png", "2.png"], // under public/screenshots/
  //   operator: {
  //     name: "Your Company Ltd",
  //     jurisdiction: "India",
  //     contactEmail: "hello@example.com",
  //     effectiveDate: "1 July 2026",
  //   },
  // },
});
