/**
 * External-bot auth: HMAC both directions (engine→bot
 * wake, bot→engine action) using a per-bot key **derived** from one engine
 * secret, so registering a bot needs no new secret and no redeploy:
 *
 *   derivedKey = HMAC-SHA256(BOT_SIGNING_SECRET, botId)
 *   signature  = "v1," + base64(HMAC-SHA256(derivedKey, "<domain>:<message>"))
 *
 * The `domain` tag (`wake` = engine→bot, `action` = bot→engine) is signed, so
 * a signature captured in one direction can never verify in the other, so there
 * is no reflection. The `v1,` prefix names the scheme (Standard-Webhooks style) and
 * rides outside the signed bytes; a future scheme gets `v2,` and can verify
 * side-by-side during a migration. At registration the operator computes the
 * bot's key with the exported `deriveBotKey()` (or the equivalent `openssl`
 * one-liner in its docstring) and hands that to the bot's owner, who never
 * sees the master secret.
 *
 * The crypto is all platform-native: WebCrypto for the HMAC, and the
 * runtime's own `Uint8Array` base64 codec (`toBase64`/`fromBase64`) for the
 * transport encoding. The master secret is taken as an argument rather than
 * read from a global, so this module stays pure and testable.
 */

const SCHEME = "v1";

/** The direction a signature is bound to: `wake` = engine→bot, `action` =
 * bot→engine. Signed as part of the message, so the two never cross-verify. */
export type SignatureDomain = "wake" | "action";

const encoder = new TextEncoder();

/** Import raw HMAC-SHA256 key bytes for the given usages. The `BufferSource`
 * cast works around lib.dom typing `Uint8Array` as `ArrayBufferLike`-backed. */
function importHmacKey(keyBytes: Uint8Array, usages: ("sign" | "verify")[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, usages);
}

/** The per-bot signing key: HMAC(master, botId) raw bytes. */
async function deriveBotKeyBytes(masterSecret: string, botId: string): Promise<Uint8Array> {
  const master = await importHmacKey(encoder.encode(masterSecret), ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", master, encoder.encode(botId)));
}

/** The per-bot signing key as base64, **the operator utility**. This is the
 * one value an external bot's owner is given, and the only one they need: it
 * is what they HMAC their request bodies with. The master
 * `BOT_SIGNING_SECRET` never leaves the operator, and because every bot's key
 * is derived from it, registering a bot needs no new secret and no redeploy.
 *
 * Base64 to match the signature transport encoding. Equivalent to:
 *
 * ```
 * echo -n "<botId>" | openssl dgst -sha256 -hmac "<BOT_SIGNING_SECRET>" -binary | base64
 * ```
 *
 * Treat the result as a credential: it authenticates that bot to the engine
 * for as long as it is registered. Rotating one bot's key means rotating the
 * master secret, which rotates every bot's key, so issue per-bot keys only to
 * owners you would re-issue all of them for. */
export async function deriveBotKey(masterSecret: string, botId: string): Promise<string> {
  return (await deriveBotKeyBytes(masterSecret, botId)).toBase64();
}

/** Sign `message` for one direction with the bot's derived key, used for
 * wakes (`"wake"`); a bot's own client code produces the `"action"` twin. */
export async function signForBot(masterSecret: string, botId: string, domain: SignatureDomain, message: string): Promise<string> {
  const key = await importHmacKey(await deriveBotKeyBytes(masterSecret, botId), ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${domain}:${message}`));
  return `${SCHEME},${new Uint8Array(sig).toBase64()}`;
}

/** Verify a bot's signature over the exact payload bytes it signed, bound to
 * `domain`. Rejects unknown scheme prefixes and malformed base64;
 * `crypto.subtle.verify` performs the HMAC comparison in constant time. */
export async function verifyBotSignature(masterSecret: string, botId: string, domain: SignatureDomain, payload: string, signature: string): Promise<boolean> {
  const comma = signature.indexOf(",");
  if (comma === -1 || signature.slice(0, comma) !== SCHEME) return false;
  let sigBytes: Uint8Array;
  try {
    sigBytes = Uint8Array.fromBase64(signature.slice(comma + 1));
  } catch {
    return false; // malformed base64 cannot be a valid signature
  }
  const key = await importHmacKey(await deriveBotKeyBytes(masterSecret, botId), ["verify"]);
  return crypto.subtle.verify("HMAC", key, sigBytes as BufferSource, encoder.encode(`${domain}:${payload}`));
}
