import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Each isolate starts with an empty simulated D1, so bring it to the current
// schema exactly the way production does (the generated .sql migrations).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
