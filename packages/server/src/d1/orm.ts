import { drizzle } from "drizzle-orm/d1";

/**
 * The engine's D1 handle. Every read and write goes through here so the
 * camelCase-property → snake_case-column mapping (`casing: "snake_case"`) is
 * configured in exactly one place. Schema properties are camelCase and the
 * columns stay snake_case; because the mapping is derived from the property
 * name, a call site can never forget the option and silently query a camelCase
 * column that does not exist. Every column name is derived; the schema carries
 * no explicit column strings at all.
 */
export const orm = (d1: D1Database) => drizzle(d1, { casing: "snake_case" });
