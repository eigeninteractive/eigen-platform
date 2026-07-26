/**
 * OpenSkill rating computation — pure, store-agnostic. Multi-seat bots collapse
 * to a single rated identity, and purged seats are excluded.
 *
 * Invoked on a rated game's finishing transition: the applier fetches each
 * seat's current `mu`/`sigma` (defaulting a never-rated identity to openskill
 * `rating()`), zips them with the outcome into {@link PlayerInput}s, and
 * turns the posteriors into {@link RatingResult}s, applied under the D1 CAS
 * (read revision → compute → conditional write → recompute on conflict). This
 * module is pure: it never touches a store and is unaware of revisions or the
 * display number.
 */

import type { Rating } from "openskill";
import { rate, rating } from "openskill";

/** OpenSkill Gaussian rating parameters (`mu`, `sigma`) — openskill's own
 * type, re-exported (type-only, erased at runtime) so the seat types below
 * can never drift from what `rate()` consumes and produces. */
export type { Rating };

/** A player seat to be rated. Self-contained: each seat's current
 * `mu`/`sigma` is bundled, so this module never reads a store.
 * `displayRating` is intentionally NOT carried — it is derived from
 * `mu`/`sigma` so the formula lives in one place per side of the wire. */
export interface PlayerInput extends Rating {
  playerIndex: number;
  userId: string | null;
  botId: string | null;
  /** Ordinal finish rank (1 = best); ties share the same value. */
  placement: number;
  /** Players sharing a teamIndex are rated as one team. For individual
   * games this equals playerIndex. */
  teamIndex: number;
}

/** Who a rating belongs to. Exactly one id is set — the same nullable-pair
 * shape as the server's `Principal` and the wire's `Seat`, so the three read
 * alike and the wire projection is the identity function. */
export interface RatingIdentity {
  userId: string | null;
  botId: string | null;
}

/** One identity's newly computed rating — the pure OpenSkill posterior,
 * before the store-owned CAS revision is attached by the applier. */
export interface RatingResult extends Rating {
  identity: RatingIdentity;
}

/** One rated identity's before → after, exactly the rating_history row minus
 * store keys. Computed by the D1 applier inside the rating CAS and delivered
 * on the post-finish ratings transition (the `kind: "ratings"` action). */
export interface RatingDelta {
  identity: RatingResult["identity"];
  pool: string;
  muBefore: number;
  sigmaBefore: number;
  displayBefore: number;
  muAfter: number;
  sigmaAfter: number;
  displayAfter: number;
  displayChange: number;
}

/** max(0, round((mu − 3σ) · 40)) — the one server-side home of the display
 * formula (the client mirrors it for optimistic display only). */
export function displayRating(mu: number, sigma: number): number {
  return Math.max(0, Math.round((mu - 3 * sigma) * 40));
}

/** The OpenSkill prior for a never-rated identity. */
export function defaultRating(): Rating {
  return rating();
}

/** Stable grouping key for the identity occupying a seat. A seat with neither
 * id (its account was purged mid-game) keys by seat, so two purged players in
 * one game are never lumped into a single identity. */
function keyOf(player: PlayerInput): string {
  if (player.userId) return `u:${player.userId}`;
  if (player.botId) return `b:${player.botId}`;
  return `x:${player.playerIndex}`;
}

/** Whether the seat still has a ratable identity — a purged seat shapes the
 * field's posteriors but gets no {@link RatingResult} of its own. */
function hasIdentity(player: PlayerInput): boolean {
  return player.userId !== null || player.botId !== null;
}

/** The identity payload written to the update. Only called for seats that
 * passed {@link hasIdentity} — anything else is a bug here. */
function identityOf(player: PlayerInput): RatingIdentity {
  if (player.userId) return { userId: player.userId, botId: null };
  if (player.botId) return { userId: null, botId: player.botId };
  throw new Error(`Player ${player.playerIndex} has no identity`);
}

/** Group items into buckets sharing the same key, preserving first-seen
 * order. Every returned bucket is non-empty by construction. */
function groupBy<T>(items: T[], keyOf: (item: T) => string | number): T[][] {
  const groups = new Map<string | number, T[]>();
  for (const item of items) {
    const group = groups.get(keyOf(item));
    if (group) group.push(item);
    else groups.set(keyOf(item), [item]);
  }
  return [...groups.values()];
}

/** Rate one field of seats and return each seat's posterior by playerIndex.
 * Seats sharing a teamIndex are rated as a single team. */
function rateField(field: PlayerInput[]) {
  const teams = groupBy(field, (p) => p.teamIndex);
  const posteriors = rate(
    teams.map((team) => team.map((p) => rating({ mu: p.mu, sigma: p.sigma }))),
    { rank: teams.map((team) => team[0].placement) },
  );
  const bySeat = new Map<number, Rating>();
  teams.forEach((team, t) => {
    team.forEach((p, s) => {
      bySeat.set(p.playerIndex, posteriors[t][s]);
    });
  });
  return bySeat;
}

/** A seat's posterior, asserting rateField's invariant that it returns every
 * seat it was given. A miss means the seat was dropped — a bug, not a no-op. */
function posteriorFor(posteriors: Map<number, Rating>, index: number) {
  const posterior = posteriors.get(index);
  if (posterior === undefined) {
    throw new Error(`No posterior computed for seat ${index}`);
  }
  return posterior;
}

/** The result for an identity that holds exactly one seat (every human, every
 * single-seat bot): rated once against the true field they actually faced. */
function singleSeatUpdate(seat: PlayerInput, fieldPosteriors: Map<number, Rating>): RatingResult {
  const after = posteriorFor(fieldPosteriors, seat.playerIndex);
  return {
    identity: identityOf(seat),
    mu: after.mu,
    sigma: after.sigma,
  };
}

/** The single net update for an identity that holds several seats (a bot
 * filling multiple slots in one game).
 *
 * Each seat is an independent game result for the same identity, applied in
 * seat order to a *running* rating, and scored only against the **other**
 * identities — an entity is never rated against itself. Because the seats'
 * moves share no information, every result legitimately moves the rating.
 *
 * All seats move one underlying rating, so the identity yields exactly ONE
 * result — prior → final. That matches the store's one row per
 * (game, identity); emitting per-seat updates would collide on that unique
 * key and roll back the whole apply. The running rating is the one piece of
 * sequential state and never escapes this function.
 */
function multiSeatUpdate(seats: PlayerInput[], field: PlayerInput[]): RatingResult {
  const ownKey = keyOf(seats[0]);
  const opponents = field.filter((p) => keyOf(p) !== ownKey);
  const ordered = [...seats].sort((a, b) => a.playerIndex - b.playerIndex);

  const prior: Rating = { mu: ordered[0].mu, sigma: ordered[0].sigma };
  let running: Rating = prior;
  for (const seat of ordered) {
    running = posteriorFor(rateField([{ ...seat, ...running }, ...opponents]), seat.playerIndex);
  }
  return {
    identity: identityOf(seats[0]),
    mu: running.mu,
    sigma: running.sigma,
  };
}

/** Compute every identity's new rating for one finished game.
 *
 * Exactly one result per identity — humans and bots alike — matching the one
 * rating row per (game, identity) the store keeps. The field is rated once;
 * single-seat identities read their posterior straight from that rating,
 * while a multi-seat identity is re-rated seat-by-seat into a single net
 * result (see `multiSeatUpdate`). The single full-field `rate()` is
 * what every single-seat player is scored against, so a human who faced a
 * two-seat bot is correctly rated against two distinct opponents.
 *
 * A seat with no identity — its account was purged mid-game — stays in the
 * field (opponents' posteriors must account for everyone they actually faced,
 * at that seat's supplied baseline) but yields no result: there is no rating
 * row left to update.
 */
export function computeRatings(players: PlayerInput[]): RatingResult[] {
  const fieldPosteriors = rateField(players);
  return groupBy(players, keyOf)
    .filter((seats) => hasIdentity(seats[0]))
    .map((seats) => (seats.length === 1 ? singleSeatUpdate(seats[0], fieldPosteriors) : multiSeatUpdate(seats, players)));
}
