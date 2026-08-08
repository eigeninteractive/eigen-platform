/**
 * Canary for the `Uint8Array` base64 shim in `src/runtime-globals.d.ts`.
 *
 * This file is compiled by `tsconfig.canary.json`, which deliberately does NOT
 * include the shim, so here `toBase64` reflects only the platform types
 * (TypeScript's lib + `@cloudflare/workers-types`). While neither declares it
 * the call below is a type error, which the `@ts-expect-error` absorbs. The day
 * either one adds `Uint8Array.prototype.toBase64`, the error disappears, the
 * directive becomes unused, and `pnpm typecheck` fails with TS2578: the signal
 * to delete `src/runtime-globals.d.ts` and this file.
 *
 * (The method IS implemented by workerd at runtime, see `bot/bot-auth.ts`, so
 * the shim is purely a type gap, not a runtime one.)
 */

// @ts-expect-error: remove the shim + this file once this stops erroring (see above).
export const _shimStillNeeded: string = new Uint8Array().toBase64();
