import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "Eigen Interactive",
  tagline: "The open-source engine for turn-based multiplayer games",
  favicon: "favicon.ico",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // The production URL — drives canonical tags and the generated sitemap, so it
  // must be the real host.
  url: "https://eigeninteractive.com",
  baseUrl: "/",
  // Emit URLs without a trailing slash, matching the worker-served game pages.
  trailingSlash: false,

  // Repo coordinates. `projectName` is a best guess — set it to the actual
  // eigen-web repository name.
  organizationName: "eigeninteractive",
  projectName: "eigen-web",

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          // No editUrl: guides are synced in from the code repos at build
          // time, so "edit this page" has no single source here.
        },
        blog: {
          showReadingTime: true,
          blogTitle: "Changelog",
          blogDescription: "Releases and notable changes to the Eigen engine.",
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          // Useful options to enforce blogging best practices
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Default social/OG card (1200x630), emitted as og:image + twitter:image.
    image: "home.og.png",
    metadata: [
      {
        name: "description",
        content: "Eigen Interactive builds an open-source, server-authoritative engine for turn-based multiplayer games, and the games made with it.",
      },
    ],
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Eigen Interactive",
      logo: {
        alt: "Eigen Interactive",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Docs",
        },
        { to: "/blog", label: "Changelog", position: "left" },
        {
          href: "https://github.com/eigeninteractive/eigen-server",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Introduction",
              to: "/docs/intro",
            },
          ],
        },
        {
          title: "Project",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/seenu-k/eigen-server",
            },
            {
              label: "License (MIT)",
              href: "https://github.com/seenu-k/eigen-server/blob/main/LICENSE",
            },
          ],
        },
        {
          title: "Legal",
          items: [
            {
              label: "Privacy Policy",
              to: "/privacy",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Eigen Interactive. MIT-licensed. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
