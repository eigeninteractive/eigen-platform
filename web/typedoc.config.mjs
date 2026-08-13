/**
 * TypeDoc reads the engine's package barrels from this monorepo's server tree and
 * emits markdown into `docs/reference/typescript/`. It runs only via
 * `pnpm sync-api`, never during `docusaurus build`; the output is committed.
 *
 * @type {Partial<import("typedoc").TypeDocOptions>}
 */
export default {
  entryPoints: ["../server/packages/kernel/src/index.ts", "../server/packages/rules/src/index.ts", "../server/packages/server/src/index.ts", "../server/packages/server/src/testing.ts", "../server/packages/testkit/src/index.ts"],
  entryPointStrategy: "resolve",
  tsconfig: "./scripts/typedoc.tsconfig.json",
  out: "docs/reference/typescript",
  plugin: ["typedoc-plugin-markdown"],

  // "Defined in:" links. Use the monorepo's stable main path: embedding HEAD
  // would make every unrelated platform commit invalidate generated docs.
  sourceLinkTemplate: "https://github.com/eigeninteractive/eigen-platform/blob/main/{path}#L{line}",

  readme: "none",
  githubPages: false,
  hideGenerator: true,
  excludePrivate: true,
  excludeInternal: true,
  excludeExternals: true,
  // The engine type-checks itself in its own repo; re-doing it here would only
  // surface cross-repo resolution noise.
  skipErrorChecking: true,

  // One file per module, flat, so URLs stay short. `sync-api` then rewrites
  // the `@eigeninteractive.*` filenames TypeDoc derives from module names into plain
  // slugs, since `@` in a URL path is legal but ugly.
  outputFileStrategy: "modules",
  flattenOutputFiles: true,
  entryFileName: "index",

  // Docusaurus renders the page header and breadcrumbs itself.
  hidePageHeader: true,
  hideBreadcrumbs: true,
  useCodeBlocks: true,
  expandObjects: true,

  // Parameters stay tabular (they read well as a grid), but properties render
  // as headings: that is what gives each member a real anchor, so TypeDoc's own
  // `#property-x` cross-links resolve and every member is deep-linkable.
  parametersFormat: "table",
  interfacePropertiesFormat: "list",
  typeAliasPropertiesFormat: "list",
  propertyMembersFormat: "list",
};
