/**
 * The twin-drift suite: every JSON fixture under src/rules/fixtures/ runs
 * against the TS rules unit here, and against the Dart `GameRules` twin in
 * the client repo's CI — one recorded behavior, two implementations.
 */

import { twinFixtureTests } from "@eigen/testkit";
import { gameModule } from "../../src/rules/index.js";

twinFixtureTests(gameModule, new URL("../../src/rules/fixtures/", import.meta.url));
