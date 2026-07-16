/**
 * The RPS {@link GameModule}: the {@link GameRules} units keyed by
 * `schema_version` — exactly the versions this build ships.
 */

import type { GameModule } from "@eigen/rules";
import { rulesV1 } from "./v1.js";

export const gameModule: GameModule = {
  versions: { 1: rulesV1 },
};
