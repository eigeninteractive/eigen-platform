import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import HomepageFeatures from "@site/src/components/HomepageFeatures";
import CodeBlock from "@theme/CodeBlock";
import Heading from "@theme/Heading";
import Layout from "@theme/Layout";
import clsx from "clsx";
import type { ReactNode } from "react";

import styles from "./index.module.css";

/**
 * The homepage is written for someone deciding whether to build their game on
 * Eigen — not for someone maintaining the engine. The split section below is
 * the page's argument: the list on the right is long, and none of it is their
 * game.
 *
 * Everything visual is Infima's (`hero hero--primary`, `row`/`col`, `card`,
 * `button button--*`, `CodeBlock`), taken as it comes.
 *
 * One button, and it is `button--secondary`. On `hero--primary` that is not the
 * quiet choice — it is the only correct one: the modifier fills the banner with
 * `--ifm-color-primary`, the same variable `button--primary` paints itself
 * with, so a primary button here would be teal on teal and collapse to a
 * floating label. Near-white is what reads as emphatic on a coloured band.
 */

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <p className={styles.heroLede}>A turn-based multiplayer game needs accounts, a lobby, sockets, reconnection, turn clocks, ratings, push and a store release before it needs a single rule of its own. Eigen ships all of it as one Cloudflare Worker and one Flutter app. You write the rules.</p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/getting-started/quickstart">
            Quickstart
          </Link>
        </div>
        {/* col--6 of the container is ~570px, which fits the longest command
            whole; the offset centres it, and both clear themselves below 996px. */}
        <div className="row margin-top--xl">
          <div className="col col--6 col--offset-3 text--left">
            <CodeBlock language="bash">pnpm create eigen-game my-game</CodeBlock>
            <CodeBlock language="text">{"/plugin marketplace add eigeninteractive/eigen-server\n/plugin install eigen@eigeninteractive"}</CodeBlock>
          </div>
        </div>
      </div>
    </header>
  );
}

const YOU_WRITE: { title: string; body: string }[] = [
  {
    title: "The rules, in TypeScript",
    body: "Six pure functions: the opening position, what a move does to it, what each seat is allowed to see, and when the game is over.",
  },
  {
    title: "The board, in Dart",
    body: "One widget that draws the current view and proposes moves — plus a rules twin, so the board can respond before the server has answered.",
  },
  {
    title: "What a new game can be set to",
    body: "Declare the options. The engine renders the creation dialog, the lobby entry and the countdown around them.",
  },
];

const EIGEN_OWNS: string[] = ["Sign-in, accounts, profiles and avatars", "Lobby, invites, friends and bots", "WebSockets, reconnection and turn deadlines", "Ratings, history and immutable replay", "Push notifications and deep links", "The game's own website and its Play Store pipeline"];

function WhatYouWrite(): ReactNode {
  return (
    <section className="margin-vert--xl">
      <div className="container">
        <div className="row">
          <div className="col col--6">
            <Heading as="h2">What you write</Heading>
            <dl>
              {YOU_WRITE.map(({ title, body }) => (
                <div className={styles.writeItem} key={title}>
                  <dt className={styles.writeTerm}>{title}</dt>
                  <dd>{body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="col col--6">
            <Heading as="h2">What you get</Heading>
            <ul>
              {EIGEN_OWNS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              For scale: Rock–Paper–Scissors, the reference game, is about <strong>220 lines of TypeScript and 500 of Dart</strong> — and none of it mentions turns, deadlines, sockets, versions, persistence or ratings.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description="Eigen ships the server and the app for a turn-based multiplayer game. You write the rules.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <WhatYouWrite />
      </main>
    </Layout>
  );
}
