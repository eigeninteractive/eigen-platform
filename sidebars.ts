import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";
import apiSidebar from "./docs/reference/http-api/sidebar";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Two sidebars, matching the two navbar entries.
 *
 * `docsSidebar` is audience-first — you arrive knowing whether you are building
 * a game, building its client, or operating a deployment — and each section is
 * ordered tutorial → how-to → explanation within itself.
 *
 * `referenceSidebar` is the lookup half, and is mostly generated: `sync-api`
 * writes `reference/typescript/` (typedoc) and `reference/http-api/` (from
 * openapi.json, which also emits the `apiSidebar` imported above).
 *
 * Note the `key` on the two "Reference" categories. Docusaurus 3.9+ requires
 * sibling nav items to be distinguishable, and two categories sharing a label
 * are not — without the keys the sidebar silently collapses them.
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    "intro",
    {
      type: "category",
      label: "Getting started",
      collapsed: false,
      items: ["getting-started/quickstart", "getting-started/your-first-game"],
    },
    {
      type: "category",
      label: "Build a game",
      items: [
        "build-a-game/game-module",
        "build-a-game/schemas",
        "build-a-game/hooks",
        "build-a-game/hidden-information",
        "build-a-game/transitions",
        "build-a-game/timing",
        "build-a-game/bots",
        "build-a-game/wiring",
        "build-a-game/testing",
        "build-a-game/ci",
        "build-a-game/versions",
        "build-a-game/recipes",
        "build-a-game/engine-owned",
      ],
    },
    {
      type: "category",
      label: "The Flutter client",
      items: ["client/overview", "client/transport", "client/frames", "client/identity-and-timing", "client/game-ui", "client/app-shell", "client/push", "client/shipping"],
    },
    {
      type: "category",
      label: "Operate",
      items: ["operate/configuration", "operate/local-development", "operate/deploy", "operate/web-surface", "operate/account-lifecycle"],
    },
    {
      type: "category",
      label: "How it works",
      items: ["concepts/overview", "concepts/system-shape", "concepts/kernel", "concepts/game-sessions", "concepts/lifecycle", "concepts/timing", "concepts/storage", "concepts/identity", "concepts/bots", "concepts/notifications", "concepts/security", "concepts/failure-model"],
    },
  ],

  referenceSidebar: [
    {
      type: "category",
      key: "reference-overview",
      label: "Reference",
      collapsed: false,
      items: ["reference/http-surface", "reference/envelope", "reference/cross-repo"],
    },
    {
      type: "category",
      key: "reference-http-api",
      label: "HTTP API",
      items: apiSidebar,
    },
    {
      type: "category",
      key: "reference-typescript",
      label: "TypeScript API",
      link: { type: "doc", id: "reference/typescript/index" },
      items: ["reference/typescript/rules", "reference/typescript/kernel", "reference/typescript/server", "reference/typescript/server-testing", "reference/typescript/testkit", "reference/typescript/server-d1schema", "reference/typescript/server-doschema"],
    },
    "reference/dart",
  ],
};

export default sidebars;
