import { drizzle } from "drizzle-orm/d1";

/** The engine's D1 handle. Column naming belongs to the table definitions, so
 * every query uses the same snake_case SQL names with any connection. */
export const orm = (d1: D1Database) => drizzle(d1);
