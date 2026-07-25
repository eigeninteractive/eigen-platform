/**
 * D1 user provisioning: a `users` row appears on first
 * sight of a verified token — the Cloudflare replacement for the Supabase-era
 * `handle_new_user` trigger, porting its username rules: derived from the
 * email local part (sanitised to the `^[a-z0-9_.]{3,20}$` charset the future
 * username-edit route will enforce), or a generated `player_NNNNN` handle for
 * guests. The guest lifecycle carries over: `linkWithCredential`
 * preserves the uid, so conversion is an UPDATE backfill on the same row —
 * and per the old product decision, the provider's display name and avatar
 * OVERWRITE whatever the guest had, while the username stays the stable
 * handle.
 */

import { eq } from "drizzle-orm";
import { orm } from "../d1/orm.js";
import { users } from "../d1/schema.js";
import type { AuthClaims } from "./firebase.js";

export type UserRow = typeof users.$inferSelect;

const HANDLE_ATTEMPTS = 10;

/** The username base: sanitised email local part, 3–20 chars, `player` when
 * nothing survives sanitisation (and for guests, who have no email). */
function handleBase(email: string | null): string {
  if (email === null) return "player";
  const local = (email.split("@")[0] ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 20);
  if (local === "") return "player";
  return local.length < 3 ? local.padEnd(3, "0") : local;
}

/** Collision retries append `_` + 4 digits; `slice(0, 15)` keeps
 * base + suffix within the 20-char limit. */
function suffixed(base: string): string {
  return `${base.slice(0, 15)}_${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
}

/** Guests start from a random 5-digit handle so concurrent signups rarely
 * collide at all; email users start from the readable base itself. */
function firstAttempt(email: string | null): string {
  if (email !== null) return handleBase(email);
  return `player_${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
}

/** Load the caller's row, creating or backfilling it as the token demands.
 * One read on the hot path; writes only on first sight and on guest →
 * permanent conversion. */
export async function ensureUser(d1: D1Database, claims: AuthClaims, now: number): Promise<UserRow> {
  const db = orm(d1);
  const existing = await db.select().from(users).where(eq(users.id, claims.uid)).get();

  if (existing !== undefined) {
    if (!existing.isAnonymous || claims.isAnonymous) return existing;
    // Guest → permanent conversion: the provider's identity overwrites the
    // guest's (there is nothing user-set worth keeping on a guest row); the
    // username alone survives as the stable handle. The trim guard keeps an
    // empty provider name from blanking the display name.
    const name = claims.name?.trim() ?? "";
    const patch = {
      isAnonymous: false,
      email: claims.email ?? existing.email,
      displayName: name !== "" ? name : existing.displayName,
      avatarUrl: claims.picture,
      updatedAt: now,
    };
    await db.update(users).set(patch).where(eq(users.id, claims.uid));
    return { ...existing, ...patch };
  }

  const base = handleBase(claims.email);
  for (let attempt = 1; attempt <= HANDLE_ATTEMPTS; attempt++) {
    const username = attempt === 1 ? firstAttempt(claims.email) : suffixed(base);
    const row: UserRow = {
      id: claims.uid,
      username,
      email: claims.email,
      displayName: claims.name ?? username,
      avatarUrl: claims.picture,
      isAnonymous: claims.isAnonymous,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.insert(users).values(row);
      return row;
    } catch (error) {
      // A username collision retries with a fresh handle; a uid collision
      // (two racing first requests) resolves to the winner's row.
      const raced = await db.select().from(users).where(eq(users.id, claims.uid)).get();
      if (raced !== undefined) return raced;
      if (attempt === HANDLE_ATTEMPTS) throw error;
    }
  }
  throw new Error("unreachable: handle retry loop exit");
}
