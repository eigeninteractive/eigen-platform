import { jwtVerify, SignJWT } from "jose";

const ISSUER = "eigeninteractive";
const AUDIENCE = "game-socket";
const ALGORITHM = "HS256";
export const SOCKET_TICKET_TTL_SECONDS = 60;

export interface SocketTicketIdentity {
  gameId: string;
  userId: string;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Mint a short-lived credential for one user and one game socket.
 *
 * Firebase proves the caller's identity on the authenticated ticket endpoint;
 * the browser then puts only this narrow, expiring credential in the WebSocket
 * URL. Tickets are deliberately stateless and reusable within their short
 * lifetime: reconnecting is expected on mobile, and no durable replay ledger is
 * needed to protect a read-only socket feed.
 */
export async function issueSocketTicket(secret: string, identity: SocketTicketIdentity, now = new Date()): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return await new SignJWT({ gameId: identity.gameId })
    .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(identity.userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SOCKET_TICKET_TTL_SECONDS)
    .sign(key(secret));
}

/** Verify and decode a ticket. Claim validation is delegated to `jose`; this
 * function only enforces Eigen's two application claims. */
export async function verifySocketTicket(secret: string, ticket: string, gameId: string, now = new Date()): Promise<SocketTicketIdentity> {
  const { payload } = await jwtVerify(ticket, key(secret), {
    algorithms: [ALGORITHM],
    issuer: ISSUER,
    audience: AUDIENCE,
    currentDate: now,
    requiredClaims: ["sub", "jti", "iat", "exp"],
  });
  if (payload.gameId !== gameId || typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Socket ticket does not match this game");
  }
  return { gameId, userId: payload.sub };
}
