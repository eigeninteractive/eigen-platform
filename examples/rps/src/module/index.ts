/**
 * The RPS {@link GameModule}: the {@link GameRules} units keyed by
 * `schemaVersion` — exactly the versions this build ships.
 */

import type { GameModule } from "@eigeninteractive/rules";
import { rulesV1 } from "./v1.js";

export default {
  versions: { 1: rulesV1 },
} satisfies GameModule;
