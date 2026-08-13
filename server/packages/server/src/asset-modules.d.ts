/**
 * Non-JS source imports resolve to their file contents as a string.
 *
 * The public pages' stylesheet is authored as a real `.css` file so it
 * highlights, formats, and diffs like the CSS it is. tsup inlines it via its
 * text loader (see `tsup.config.ts`), exactly as it already does for drizzle's
 * `.sql` bundle, so the published package carries it as a plain JS string and
 * implementors need no wrangler `Text` rule.
 *
 * This declaration is compile-time only: it is not emitted into the published
 * `.d.ts`, so a consumer's type space is untouched.
 */

declare module "*.css" {
  const content: string;
  export default content;
}
