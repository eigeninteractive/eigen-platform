import { twinFixtureTests } from "@eigeninteractive/testkit";
import gameModule from "../src/module/index.js";

twinFixtureTests(gameModule, new URL("../src/module/fixtures/", import.meta.url));
