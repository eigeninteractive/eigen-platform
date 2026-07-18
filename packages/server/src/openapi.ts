/**
 * Node-safe entry for OpenAPI emission (`scripts/emit-openapi.mjs`): pulls
 * only the route/app graph — nothing that imports `cloudflare:workers` at
 * runtime — so the document can be generated outside workerd and vendored
 * into the Dart repo for client codegen (§2.1).
 */

export { openApiDocument } from "./engine.js";
