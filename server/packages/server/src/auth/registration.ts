/**
 * The guest axis: what an anonymous account may not do, whatever it has paid.
 *
 * A guest is a real but throwaway identity (see `firebase.ts`). Some operations
 * need an identity that outlives the install — a friend graph, a rating, a
 * purchase — and those refuse a guest with `registrationRequired`.
 *
 * That is a different axis from a commerce capability, and deliberately a
 * different code: signing in lifts it and paying never does. The client offers
 * sign-in for this one, and a store only for `capabilityRequired`,
 * `contentRequired` and `commercialLimitReached`. Folding the two together
 * would have it ask a guest to pay for something only an account can fix.
 */

import { HttpError } from "../http.js";
import type { AuthClaims } from "./firebase.js";

/** Refuse a guest. `message` is diagnostic; the code is what a client reads. */
export function requireRegistered(claims: AuthClaims, message = "This action requires a registered account"): void {
  if (claims.isAnonymous) throw new HttpError(403, message, "registrationRequired");
}
