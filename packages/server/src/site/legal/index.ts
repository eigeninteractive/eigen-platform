/**
 * The engine's default legal documents.
 *
 * They are hono/jsx components taking typed props, which is what replaced the
 * earlier `{{token}}` substitution: a mistyped placeholder is now a compile
 * error, values are escaped by the renderer rather than by hand, and the
 * regex/fail-fast machinery that guarded the old scheme is gone.
 *
 * Each is rendered to an HTML fragment once, at startup, so a request never
 * builds prose — and `LegalConfig` overrides stay plain HTML strings, which
 * need no props because the implementor writes their own values in directly.
 */

import type { LegalConfig, OperatorConfig } from "../config.js";
import { DeleteAccount } from "./delete-account.js";
import { Privacy } from "./privacy.js";
import type { LegalProps } from "./props.js";
import { Terms } from "./terms.js";

/** Render the three documents, preferring an implementor's fragment over the
 * engine's default. Called once from `createEngine`. */
export function renderLegal(legal: LegalConfig | undefined, props: LegalProps): { terms: string; privacy: string; deleteAccount: string } {
  const override = legal ?? {};
  // Every default is a synchronous component, so the JSX node stringifies
  // synchronously — no await, and nothing to resolve per request.
  const render = (Component: (p: LegalProps) => unknown): string => String(Component(props));
  return {
    terms: override.terms ?? render(Terms),
    privacy: override.privacy ?? render(Privacy),
    deleteAccount: override.deleteAccount ?? render(DeleteAccount),
  };
}

export type { LegalProps, OperatorConfig };
export { DeleteAccount, Privacy, Terms };
