import Heading from "@theme/Heading";
import type { ReactNode } from "react";
import styles from "./styles.module.css";

/**
 * The three homepage features.
 *
 * They name the three things a project is handed, a server and an app, and then
 * the one part that is the implementor's. Two earlier headings are worth not
 * repeating: "Bring your own game" described the whole product rather than one
 * feature of it, and "One codebase runs many games" stated a property of the
 * engine's source tree that changes nothing for the person reading it.
 *
 * The markup is Infima's own `card card--full-height` with a `card__body`,
 * inside the standard `row`/`col` grid, so surface, radius, shadow and padding
 * all come from the theme, in both colour schemes.
 *
 * The icons are inline SVG rather than files under `static/img`, and drawn in
 * `currentColor` so they follow the theme instead of carrying their own palette.
 * The site respects `prefers-color-scheme`, and a two-tone illustration only
 * looks right in whichever mode it was drawn for.
 *
 * They replace the three stock Docusaurus mascot illustrations, which were not
 * merely off-brand: each shipped an embedded `<title>` from the template, and
 * `<title>` on an inline SVG is what a screen reader announces. The homepage
 * was reading out "Easy to Use", "Focus on What Matters" and, on a TypeScript
 * and Flutter product, "Powered by React".
 *
 * These carry `aria-hidden` instead. Every one of them restates the heading
 * beside it, so announcing them would only repeat the text: decorative is the
 * honest role, and silence is what a screen reader should do with them.
 */

/** One isolated cell holding its own data and players, not a shared cluster. */
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

/** A handset with a board on it: the app half, already assembled. */
function AppIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="26" y="8" width="44" height="80" rx="8" />
      <path d="M42 18h12" opacity={0.55} />
      <rect x="36" y="32" width="24" height="24" rx="3" opacity={0.45} />
      <circle cx="42" cy="38" r="3" fill="currentColor" stroke="none" />
      <circle cx="54" cy="50" r="3" fill="currentColor" stroke="none" />
      <path d="M36 68h24" opacity={0.55} />
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
    title: "The Cloudflare Worker",
    Icon: WorkerIcon,
    description: <>One Cloudflare Worker with its own domain, database and players. Sockets, reconnection, turn clocks, ratings and replay are handled by a Durable Object.</>,
  },
  {
    title: "The Flutter App",
    Icon: AppIcon,
    description: <>A Flutter app for Android and the web. Sign-in, lobby, friends, profiles, avatars, push and deep links all ship with it and natively speaks the Server's Language.</>,
  },
  {
    title: "You write the rules",
    Icon: RulesIcon,
    description: <>Six pure game rules functions and a board widget. One command scaffolds both halves and leaves a game running on your machine.</>,
  },
];

function Feature({ title, Icon, description }: FeatureItem) {
  return (
    <div className="col col--4 margin-bottom--lg">
      <div className="card card--full-height">
        <div className="card__body">
          <Icon className={styles.featureIcon} />
          <Heading as="h3">{title}</Heading>
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className="margin-vert--xl">
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
