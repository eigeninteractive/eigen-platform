/**
 * The games showcase manifest.
 *
 * One entry per shipped game. `site` is the game's own worker-served website
 * (landing page + legal), which the engine generates from its `site` config;
 * the store links are the same URLs that worker puts on its landing page.
 *
 * Add a game by adding an entry; the showcase page renders whatever is here.
 */

export type Game = {
  name: string;
  tagline: string;
  description: string;
  /** Emoji stand-in until each game ships a logo into `static/img/games/`. */
  emoji: string;
  site?: string;
  android?: string;
  ios?: string;
  source?: string;
  status: "live" | "in-development";
};

export const games: Game[] = [
  {
    name: "Rock Paper Scissors",
    tagline: "The reference game",
    description: "Simultaneous commitment with hidden information, the engine's hardest-case-first example, shipped as `examples/rps`. Both seats commit each round; neither sees the other's move until both have played.",
    emoji: "✊",
    source: "https://github.com/eigeninteractive/eigen-platform/tree/main/server/examples/rps",
    status: "live",
  },
];
