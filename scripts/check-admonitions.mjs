#!/usr/bin/env node
/**
 * Assert that every admonition uses the directive-label syntax.
 *
 *     pnpm check-admonitions
 *
 *     :::tip[A titled admonition]     ✓
 *     :::tip A titled admonition      ✗ renders as a literal paragraph
 *
 * The second form is MDX 1 syntax. Docusaurus used to rewrite it into the first
 * during preprocessing, but that shim lives behind `markdown.mdx1Compat.admonitions`,
 * and `future.v4: true` in docusaurus.config.ts turns the whole mdx1Compat block
 * off. Without the rewrite, `remark-directive` does not recognise a directive
 * name followed by bare text, so the block is not a directive at all; it falls
 * through to an ordinary paragraph and the page ships `:::tip` as visible text.
 *
 * This check exists because nothing else catches that. It is not a parse error,
 * so the build stays green; the only symptom is a box that renders as prose,
 * which is invisible to everyone who does not happen to look at that page. All
 * 22 admonitions on the site degraded this way at once when the v4 flag went in,
 * and CI reported success throughout.
 *
 * The bracket form is correct under both settings, so this asks for the form
 * that does not depend on a compatibility flag.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["docs", "blog", "src"];

// The five Docusaurus keywords. A `:::` block naming anything else is a custom
// directive or a typo, and neither is this script's business.
const OPENER = /^\s*:::(note|tip|info|warning|danger)\s+(\S.*)$/;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if ([".md", ".mdx"].includes(extname(entry.name))) yield path;
  }
}

const offenders = [];

for (const root of roots) {
  for (const path of walk(join(siteDir, root))) {
    // Fenced blocks are skipped: a page is allowed to *show* the broken form
    // while explaining it, and this file's own examples above would otherwise
    // fail the check if they ever moved into the docs.
    let fenced = false;

    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (line.trimStart().startsWith("```")) {
          fenced = !fenced;
          return;
        }
        if (fenced) return;

        const match = OPENER.exec(line);
        if (match) {
          offenders.push({
            file: `${root}${path.slice(join(siteDir, root).length)}`,
            line: index + 1,
            keyword: match[1],
            title: match[2].trim(),
          });
        }
      });
  }
}

if (offenders.length > 0) {
  const subject = offenders.length === 1 ? "1 admonition uses" : `${offenders.length} admonitions use`;
  console.error(`✗ ${subject} the MDX 1 title syntax and will render as literal text:`);
  console.error("");
  for (const { file, line, keyword, title } of offenders) {
    console.error(`  ${file}:${line}`);
    console.error(`    - :::${keyword} ${title}`);
    console.error(`    + :::${keyword}[${title}]`);
  }
  console.error("");
  console.error("  Put the title in brackets. See https://docusaurus.io/docs/markdown-features/admonitions");
  process.exit(1);
}

console.log("✓ All admonitions use the directive-label syntax.");
