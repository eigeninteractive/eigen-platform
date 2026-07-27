#!/usr/bin/env node
import { parseArgs } from "node:util";
import { detectPackageManager, type PackageManager, scaffoldGame } from "./index.js";

const help = `Usage: create-eigen-game <game-slug> [options]

Creates one repository containing an Eigen Cloudflare Worker and Flutter app.
The destination basename is the lowercase kebab-case game slug; the CLI derives
the display name, Dart package name, and Dart/TypeScript type prefix from it.

Options:
  --org <reverse-domain> Android/iOS organization (default: com.example)
  --package-manager <pm> npm or pnpm (defaults to the invoking package manager)
  -h, --help             Show this help`;

function main(args: string[]): void {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      org: { type: "string" },
      "package-manager": { type: "string" },
    },
  });

  if (values.help) {
    console.log(help);
    return;
  }
  if (positionals.length !== 1) {
    throw new Error(`expected exactly one destination directory\n\n${help}`);
  }

  const requestedManager = values["package-manager"];
  if (requestedManager !== undefined && requestedManager !== "npm" && requestedManager !== "pnpm") {
    throw new Error("--package-manager must be npm or pnpm");
  }
  const packageManager = (requestedManager as PackageManager | undefined) ?? detectPackageManager() ?? "pnpm";
  const result = scaffoldGame({
    directory: positionals[0],
    org: values.org,
    packageManager,
  });
  console.log(`Created ${result.name} in ${result.root}`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`create-eigen-game: ${message}`);
  process.exitCode = 1;
}
