import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Bring the simulated rps_dev to the current engine schema, using the same .sql
// migrations `wrangler d1 migrations apply rps_dev` runs for real.
await applyD1Migrations(env.rps_dev, env.TEST_MIGRATIONS);
