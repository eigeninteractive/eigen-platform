/**
 * Ambient types for platform globals that workerd implements but TypeScript's
 * `ES2024` lib does not yet declare. Remove entries here as they land in the
 * standard lib (then bump `lib` and delete the shim).
 *
 * `Uint8Array` base64 codec: the TC39 "Uint8Array to/from base64" methods
 * (https://github.com/tc39/proposal-arraybuffer-base64), shipped in workerd but
 * still in TS's `esnext` lib, not `es2024`. Used by `bot/bot-auth.ts`.
 */

interface Uint8Array {
  toBase64(options?: { alphabet?: "base64" | "base64url"; omitPadding?: boolean }): string;
}

interface Uint8ArrayConstructor {
  fromBase64(base64: string, options?: { alphabet?: "base64" | "base64url"; lastChunkHandling?: "loose" | "strict" | "stop-before-partial" }): Uint8Array;
}
