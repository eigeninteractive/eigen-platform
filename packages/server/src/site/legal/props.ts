import type { OperatorConfig } from "../config.js";

/** What every default legal document takes. These props are what the old
 * `{{token}}` placeholders stood in for, with the compiler checking them. */
export interface LegalProps {
  /** The game's public name. */
  appName: string;
  operator: OperatorConfig;
}
