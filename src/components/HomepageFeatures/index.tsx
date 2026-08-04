import Heading from "@theme/Heading";
import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./styles.module.css";

/**
 * The three homepage features.
 *
 * The icons are inline SVG rather than files under `static/img`, and drawn in
 * `currentColor` so they follow the theme instead of carrying their own palette
 * — the site respects `prefers-color-scheme`, and a two-tone illustration only
 * looks right in whichever mode it was drawn for.
 *
 * They replace the three stock Docusaurus mascot illustrations, which were not
 * merely off-brand: each shipped an embedded `<title>` from the template, and
 * `<title>` on an inline SVG is what a screen reader announces. The homepage
 * was reading out "Easy to Use", "Focus on What Matters" and — under "Bring
 * your own game", on a TypeScript and Flutter product — "Powered by React".
 *
 * These carry `aria-hidden` instead. Every one of them restates the heading
 * beside it, so announcing them would only repeat the text: decorative is the
 * honest role, and silence is what a screen reader should do with them.
 */

/** A board: the state the server owns, and what "abstract strategy" looks like. */
function BoardIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="14" y="14" width="68" height="68" rx="6" />
      <path d="M31 14v68M48 14v68M65 14v68M14 31h68M14 48h68M14 65h68" opacity={0.45} />
      <circle cx="39.5" cy="39.5" r="6.5" fill="currentColor" stroke="none" />
      <circle cx="65" cy="65" r="6.5" />
    </svg>
  );
}

/** One isolated cell holding its own data and players — not a shared cluster. */
function WorkerIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="30" y="30" width="36" height="36" rx="8" />
      <circle cx="48" cy="14" r="7" />
      <circle cx="48" cy="82" r="7" />
      <circle cx="14" cy="48" r="7" />
      <circle cx="82" cy="48" r="7" />
      <path d="M48 21v9M48 66v9M21 48h9M66 48h9" opacity={0.55} />
    </svg>
  );
}

/** A module that slots into the engine: the small piece a game author writes. */
function RulesIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M18 26a8 8 0 0 1 8-8h44a8 8 0 0 1 8 8v44a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8z" opacity={0.45} />
      <path d="M40 40l-9 8 9 8M56 40l9 8-9 8" />
    </svg>
  );
}

type FeatureItem = {
  title: string;
  Icon: React.ComponentType<React.ComponentProps<"svg">>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Server-authoritative",
    Icon: BoardIcon,
    description: <>The rules run on the server. Every move is validated against the true state, hidden information stays hidden, and clocks are authoritative.</>,
  },
  {
    title: "One Worker per game",
    Icon: WorkerIcon,
    description: <>Each game deploys as a single Cloudflare Worker that owns its own domain, database, and players — no shared infrastructure to operate.</>,
  },
  {
    title: "Bring your own game",
    Icon: RulesIcon,
    description: <>Implement a small rules module and deploy. The engine handles identity, matchmaking, ratings, history, and the game&apos;s website for you.</>,
  },
];

function Feature({ title, Icon, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <Icon className={styles.featureIcon} />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props) => (
            <Feature key={props.title} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
