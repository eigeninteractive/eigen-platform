import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";
import apiSidebar from "./docs/reference/http-api/sidebar";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Two sidebars, matching the two navbar entries.
 *
 * `docsSidebar` is task-first: a section is a thing you are trying to do, and
 * each page inside it carries BOTH halves of that task — the TypeScript rules
 * and the Dart client — because they are one change. There is deliberately no
 * "client" section; splitting by repo made a single task (hidden information,
 * say) live on two pages that never referenced each other.
 *
 * "How it works" is explanation only, and sits below the doing sections
 * because a game can be built without reading any of it.
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
      items: ["getting-started/quickstart", "getting-started/your-first-game", "getting-started/manual-setup"],
    },
    {
      type: "category",
      label: "Build a game",
      collapsed: false,
      items: ["build-a-game/the-contract", "build-a-game/schemas", "build-a-game/hooks", "build-a-game/hidden-information", "build-a-game/rendering", "build-a-game/timing", "build-a-game/bots", "build-a-game/creation-ui", "build-a-game/testing", "build-a-game/versions", "build-a-game/recipes"],
    },
    {
      type: "category",
      label: "Ship it",
      items: ["ship-it/deploy-the-worker", "ship-it/deploy-the-web-app", "ship-it/configure", "ship-it/deep-links", "ship-it/branding", "ship-it/push", "ship-it/store-release"],
    },
    {
      type: "category",
      label: "How it works",
      items: [
        "how-it-works/overview",
        "how-it-works/system-shape",
        "how-it-works/kernel",
        "how-it-works/game-sessions",
        "how-it-works/lifecycle",
        "how-it-works/timing",
        "how-it-works/storage",
        "how-it-works/identity",
        "how-it-works/bots",
        "how-it-works/notifications",
        "how-it-works/security",
        "how-it-works/failure-model",
        "how-it-works/the-client-app",
        "how-it-works/transport",
        "how-it-works/account-lifecycle",
      ],
    },
  ],

  referenceSidebar: [
    {
      type: "category",
      key: "reference-overview",
      label: "Reference",
      collapsed: false,
      items: ["reference/repository-model", "reference/http-surface", "reference/envelope", "reference/cross-repo", "reference/compatibility"],
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
      items: [
        "reference/typescript/rules",
        "reference/typescript/server",
        "reference/typescript/testkit",
        "reference/typescript/server-testing",
        {
          type: "category",
          label: "Engine internals",
          items: ["reference/typescript/kernel"],
        },
      ],
    },
    "reference/dart",
  ],
};

export default sidebars;
