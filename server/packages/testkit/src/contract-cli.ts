#!/usr/bin/env node
import { parseArgs } from "node:util";
import { checkConfiguredGameContract, emitConfiguredGameContract } from "./contract-command.js";

try {
  const { values } = parseArgs({
    strict: true,
    options: {
      check: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(`Usage: eigen-contract [options]

Emit game-contract.json from the configured game module and fixtures.

Options:
  --check      Fail when the committed contract is stale
  -h, --help   Show this help`);
  } else {
    if (values.check) await checkConfiguredGameContract();
    else await emitConfiguredGameContract();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`eigen-contract: ${message}`);
  process.exitCode = 1;
}
