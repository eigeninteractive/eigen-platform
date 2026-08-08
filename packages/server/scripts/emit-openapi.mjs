// Emits the engine's OpenAPI 3.1 document (run `pnpm openapi`; builds first,
// the import below is the built, node-safe entry).
//
// `info.version` is read from package.json rather than written into the
// document builder, so the spec, the npm packages and the generated Dart client
// (whose pubspec `generate-dart-client.sh` stamps from the same field) can never
// disagree about what version they describe. changesets owns that field, so a
// release moves all three at once and no one has to remember this file exists.
import { readFileSync, writeFileSync } from "node:fs";
import { openApiDocument } from "../dist/openapi.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const target = new URL("../openapi.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(openApiDocument(version), null, 2)}\n`);
console.log(`wrote ${target.pathname} (version ${version})`);
