import Heading from "@theme/Heading";
import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<"svg">>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Server-authoritative",
    Svg: require("@site/static/img/undraw_docusaurus_mountain.svg").default,
    description: <>The rules run on the server. Every move is validated against the true state, hidden information stays hidden, and clocks are authoritative.</>,
  },
  {
    title: "One Worker per game",
    Svg: require("@site/static/img/undraw_docusaurus_tree.svg").default,
    description: <>Each game deploys as a single Cloudflare Worker that owns its own domain, database, and players — no shared infrastructure to operate.</>,
  },
  {
    title: "Bring your own game",
    Svg: require("@site/static/img/undraw_docusaurus_react.svg").default,
    description: <>Implement a small rules module and deploy. The engine handles identity, matchmaking, ratings, history, and the game&apos;s website for you.</>,
  },
];

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
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
