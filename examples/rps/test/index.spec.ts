import { env, exports } from "cloudflare:workers";
import { expect, it } from "vitest";

it("serves the hello-world route", async () => {
  const res = await exports.default.fetch("https://example.com/");
  expect(await res.text()).toBe("Hello, world!");
});

it("reaches the GameDO", async () => {
  const stub = env.GAME_DO.getByName("test");
  expect(await stub.sayHello("test")).toBe("Hello, test!");
});
