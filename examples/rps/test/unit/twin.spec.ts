/**
 * The twin-drift suite: every JSON fixture under src/module/fixtures/ runs
 * against the TS rules unit here, and against the Dart `GameRules` twin in
 * the client repo's CI: one recorded behavior, two implementations.
 */

import { twinFixtureTests } from "@eigeninteractive/testkit";
import gameModule from "../../src/module/index.js";

twinFixtureTests(gameModule, new URL("../../src/module/fixtures/", import.meta.url));
