import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { describe, expect, it } from "vitest";
import { orm } from "../src/d1/orm.js";
import { users } from "../src/d1/schema.js";
import migrations from "../src/do/migrations/migrations.js";
import { outbox } from "../src/do/schema.js";
import { userRow } from "./factories.js";

// Kit RC5 drops NOT NULL on inline text primary keys. These tests exercise
// physical constraints from the generated migrations, beneath TS nullability.
describe("generated migration integrity", () => {
  it("D1 rejects a null identity while accepting an otherwise identical row", async () => {
    const db = orm(env.DB);
    await db.insert(users).values(userRow("valid-identity")).run();

    await expect(
      db
        .insert(users)
        .values({ ...userRow("null-identity"), id: sql`NULL` })
        .run(),
    ).rejects.toThrow();
    expect(await db.select({ id: users.id }).from(users).all()).toEqual([{ id: "valid-identity" }]);
  });

  it("DO rejects a null finish key, rolls back synchronously, and can reapply migrations", async () => {
    const stub = env.GAME_DO.get(env.GAME_DO.idFromName(crypto.randomUUID()));
    await runInDurableObject(stub, async (_instance, state) => {
      const db = drizzle(state.storage);
      db.insert(outbox).values({ finishId: "valid-finish", outcomes: [], createdAt: 1 }).run();

      expect(() => {
        void db.transaction((tx) => {
          tx.update(outbox).set({ createdAt: 2 }).run();
          tx.insert(outbox).values({ finishId: sql`NULL`, outcomes: [], createdAt: 3 }).run();
        });
      }).toThrow();

      migrate(db, migrations);
      expect(db.select().from(outbox).all()).toEqual([{ finishId: "valid-finish", outcomes: [], createdAt: 1 }]);
    });
  });
});
