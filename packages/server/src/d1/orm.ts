import { drizzle } from "drizzle-orm/d1";

/**
 * The engine's D1 handle. Every read and write goes through here so the
 * camelCase-property → snake_case-column mapping (`casing: "snake_case"`) is
 * configured in exactly one place. Schema properties are camelCase and the
 * columns stay snake_case; because the mapping is derived from the property
 * name, a call site can never forget the option and silently query a camelCase
 * column that does not exist. The two columns whose names the derivation cannot
 * produce (`user_id_1`, `user_id_2`) keep an explicit name in the schema.
 */
export const orm = (d1: D1Database) => drizzle(d1, { casing: "snake_case" });
