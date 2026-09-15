/**
 * `@eigeninteractive/server/commerce-kit`: the small, sharp things every
 * commerce adapter needs and none of them should reimplement.
 *
 * Adapters run on Workers, so there is no Node `crypto` and no provider SDK
 * that assumes one. What they do all need is the same three primitives: an
 * HMAC, a comparison that does not leak where two secrets diverge, and a JSON
 * call whose failures say which provider failed without quoting the token that
 * failed with it.
 *
 * @module @eigeninteractive/server/commerce-kit
 */

const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** HMAC-SHA256 of `message` under `secret`, lowercase hex. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/**
 * Compare two hex digests without revealing how far they agreed.
 *
 * Length is compared first and separately: two digests of different lengths
 * cannot match anyway, and hashing both sides to a fixed width first means the
 * loop below runs over equal-length inputs every time.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

/** A provider call that failed, named by provider and status, never by token. */
export class ProviderRequestError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    detail: string,
  ) {
    super(`${provider} responded ${status}: ${detail}`);
    this.name = "ProviderRequestError";
  }
}

/**
 * A JSON call to a provider.
 *
 * The body of a failed response is truncated into the error: providers put the
 * useful part first, and an untruncated one is how a token ends up in a log.
 */
export async function providerJson<T>(provider: string, request: Request): Promise<T> {
  const response = await fetch(request);
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new ProviderRequestError(provider, response.status, detail);
  }
  return (await response.json()) as T;
}

/** Basic authorization header value for a key/secret pair. */
export function basicAuth(id: string, secret: string): string {
  return `Basic ${btoa(`${id}:${secret}`)}`;
}

/** Require a configured secret, naming what is missing rather than failing later. */
export function requireSecret(value: string | undefined, name: string): string {
  if (value === undefined || value.length === 0) throw new Error(`commerce: ${name} is not configured`);
  return value;
}
