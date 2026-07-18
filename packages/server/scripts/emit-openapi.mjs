// Emits the engine's OpenAPI 3.1 document (run `pnpm openapi`; builds first —
// the import below is the built, node-safe entry).
import { writeFileSync } from "node:fs";
import { openApiDocument } from "../dist/openapi.js";

const target = new URL("../openapi.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(openApiDocument(), null, 2)}\n`);
console.log(`wrote ${target.pathname}`);
