#!/usr/bin/env node
import { parseArgs } from "node:util";
import { addContinuousIntegration, detectPackageManager, type PackageManager, scaffoldGame } from "./index.js";

const help = `Usage: create-eigen-game <game-slug> [options]
       create-eigen-game add ci [directory] [options]

Creates one repository containing an Eigen Cloudflare Worker and Flutter app.
The destination basename is the lowercase kebab-case game slug; the CLI derives
the display name, Dart package name, and Dart/TypeScript type prefix from it.

Options:
  --ci                   Also emit the GitHub Actions workflows (off by
                         default: release.yml needs an upload keystore and a
                         Play service account, so it fails until both exist)
  --org <reverse-domain> Android/iOS organization (default: com.example)
  --package-manager <pm> npm or pnpm (defaults to the invoking package manager)
  -h, --help             Show this help

Commands:
  add ci [directory]     Add the workflows to an existing project, for when
                         you are ready to ship rather than at scaffold time.
                         Defaults to the current directory.`;

function resolveManager(requested: string | undefined): PackageManager | undefined {
  if (requested === undefined) return undefined;
  if (requested !== "npm" && requested !== "pnpm") {
    throw new Error("--package-manager must be npm or pnpm");
  }
  return requested;
}

function main(args: string[]): void {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      ci: { type: "boolean" },
      org: { type: "string" },
      "package-manager": { type: "string" },
    },
  });

  if (values.help) {
    console.log(help);
    return;
  }

  const requestedManager = resolveManager(values["package-manager"]);

  if (positionals[0] === "add") {
    if (positionals[1] !== "ci") {
      throw new Error(`unknown subcommand: add ${positionals[1] ?? ""}\n\n${help}`.trim());
    }
    if (positionals.length > 3) {
      throw new Error(`expected at most one directory\n\n${help}`);
    }
    const result = addContinuousIntegration({
      directory: positionals[2] ?? process.cwd(),
      packageManager: requestedManager,
    });
    console.log(`Added ${result.files.join(" and ")} in ${result.root}`);
    return;
  }

  if (positionals.length !== 1) {
    throw new Error(`expected exactly one destination directory\n\n${help}`);
  }

  const result = scaffoldGame({
    directory: positionals[0],
    org: values.org,
    packageManager: requestedManager ?? detectPackageManager() ?? "pnpm",
    ci: values.ci,
  });
  console.log(`Created ${result.name} in ${result.root}`);
  if (!values.ci) {
    console.log("No CI workflows were generated. Run `create-eigen-game add ci` inside the project when you want them.");
  }
}

try {
  main(process.argv.slice(2));
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`create-eigen-game: ${message}`);
  process.exitCode = 1;
}
