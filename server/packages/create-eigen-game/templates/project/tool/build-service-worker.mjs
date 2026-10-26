import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generateSW } from "workbox-build";

const { default: config } = await import(pathToFileURL(resolve(process.argv[2] ?? "workbox-config.cjs")).href);
const { count, size, warnings } = await generateSW(config);
for (const warning of warnings) console.warn(warning);
console.log(`Generated ${config.swDest}: ${count} precached files, ${size} bytes`);
