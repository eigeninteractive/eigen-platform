/**
 * External-bot auth (engine_stack.md §7) — HMAC both directions (engine→bot
 * wake, bot→engine action) using a per-bot key **derived** from one engine
 * secret, so registering a bot needs no new secret and no redeploy:
 *
 *   derivedKey = HMAC-SHA256(BOT_SIGNING_SECRET, bot_id)
 *   signature  = "v1," + base64(HMAC-SHA256(derivedKey, "<domain>:<message>"))
 *
 * The `domain` tag (`wake` = engine→bot, `action` = bot→engine) is signed, so
 * a signature captured in one direction can never verify in the other — no
 * reflection. The `v1,` prefix names the scheme (Standard-Webhooks style) and
 * rides outside the signed bytes; a future scheme gets `v2,` and can verify
 * side-by-side during a migration. The operator is handed `deriveBotKey(id)`
 * at registration and never sees the master secret.
 *
 * Ported from the Supabase-era `_engine/bot_auth.ts`; the crypto is all
 * platform-native — WebCrypto for the HMAC, and the runtime's own
 * `Uint8Array` base64 codec (`toBase64`/`fromBase64`) for the transport
 * encoding — and it takes the master secret as an argument instead of reading
 * a Deno-global env.
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

/** The per-bot signing key: HMAC(master, bot_id) raw bytes. */
async function deriveBotKey(masterSecret: string, botId: string): Promise<Uint8Array> {
  const master = await importHmacKey(encoder.encode(masterSecret), ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", master, encoder.encode(botId)));
}

/** Sign `message` for one direction with the bot's derived key — used for
 * wakes (`"wake"`); a bot's own client code produces the `"action"` twin. */
export async function signForBot(masterSecret: string, botId: string, domain: SignatureDomain, message: string): Promise<string> {
  const key = await importHmacKey(await deriveBotKey(masterSecret, botId), ["sign"]);
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
  const key = await importHmacKey(await deriveBotKey(masterSecret, botId), ["verify"]);
  return crypto.subtle.verify("HMAC", key, sigBytes as BufferSource, encoder.encode(`${domain}:${payload}`));
}
