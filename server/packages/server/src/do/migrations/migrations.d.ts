import type { migrate } from "drizzle-orm/durable-sqlite/migrator";

/** Drizzle Kit's generated SQL bundle, typed by its consuming migrator. */
declare const migrations: Parameters<typeof migrate>[1];
export default migrations;
