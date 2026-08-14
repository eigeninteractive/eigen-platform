/**
 * Device registration: the FCM push-target ingress that
 * makes `notify/push.ts` deliverable. Verifies the upsert-on-FID reassignment
 * and the caller-scoped delete: the two behaviours that keep one app install
 * mapped to exactly one user.
 */

import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { orm } from "../src/d1/orm.js";
import { deviceInstallations } from "../src/d1/schema.js";
import { testBearer as bearer, testMutationHeaders as mutationHeaders } from "../src/testing.js";

const db = orm(env.DB);
const uid = (tag: string) => `${tag}-${crypto.randomUUID()}`;

async function api(id: string, method: string, path: string, body?: unknown): Promise<Response> {
  return await exports.default.fetch(`https://x/api/engine${path}`, {
    method,
    headers: method === "GET" ? { ...(await bearer({ uid: id })), "content-type": "application/json" } : await mutationHeaders({ uid: id }),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function fidOwner(fid: string): Promise<string | undefined> {
  const row = await db.select({ userId: deviceInstallations.userId }).from(deviceInstallations).where(eq(deviceInstallations.fid, fid)).get();
  return row?.userId;
}

describe("device registration", () => {
  it("registers, then reassigns the FID to whoever last signed in", async () => {
    const a = uid("dev-a");
    const b = uid("dev-b");
    const fid = `fid-${crypto.randomUUID()}`;

    expect((await api(a, "PUT", "/me/devices", { fid, platform: "ios" })).status).toBe(204);
    expect(await fidOwner(fid)).toBe(a);

    // Same device, new user signs in: the FID row reassigns (one FID → one user).
    expect((await api(b, "PUT", "/me/devices", { fid, platform: "android" })).status).toBe(204);
    expect(await fidOwner(fid)).toBe(b);
  });

  it("deletes only the caller's own FID (a reassigned device is left untouched)", async () => {
    const a = uid("dev-a");
    const b = uid("dev-b");
    const fid = `fid-${crypto.randomUUID()}`;

    await api(a, "PUT", "/me/devices", { fid, platform: "ios" });
    await api(b, "PUT", "/me/devices", { fid, platform: "ios" }); // reassigned to b

    // a signs out late: scoped delete is a no-op, b keeps the registration.
    expect((await api(a, "DELETE", `/me/devices/${fid}`)).status).toBe(204);
    expect(await fidOwner(fid)).toBe(b);

    // b signs out: the row goes.
    expect((await api(b, "DELETE", `/me/devices/${fid}`)).status).toBe(204);
    expect(await fidOwner(fid)).toBeUndefined();
  });

  it("rejects an unknown platform", async () => {
    const a = uid("dev-a");
    const res = await api(a, "PUT", "/me/devices", { fid: "fid-x", platform: "desktop" });
    expect(res.status).toBe(400);
  });
});
