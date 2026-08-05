<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://eigeninteractive.com/brand/eigen-lockup-dark-360.png">
  <img src="https://eigeninteractive.com/brand/eigen-lockup-360.png" alt="EigenInteractive" width="270">
</picture>

# eigen-web

Source of truth for the documentation at <https://eigeninteractive.com>, plus
the company landing page and games showcase. Built with
[Docusaurus](https://docusaurus.io/).

## Getting set up

```bash
pnpm install
pnpm start       # dev server
pnpm build       # production build — this is also the link checker
pnpm lint
pnpm typecheck
```

The site builds standalone: the generated API reference under
`docs/reference/` is committed, so no sibling checkout is required. See
[CONTRIBUTING.md](CONTRIBUTING.md) for how the docs are organized and how that
reference is regenerated.

## Deployment

Cloudflare Workers Builds watches `main` directly and deploys on every push —
there's no deploy step to run from here. The site is a static-assets-only
Worker (see `wrangler.jsonc`), served entirely by Cloudflare's asset server.

```bash
pnpm deploy      # build + `wrangler deploy`, for a one-off deploy from a
                 # machine with `wrangler login`
pnpm preview     # build + `wrangler dev`, to preview the Worker locally
```

Full details, including the Cloudflare build settings, are in
[CONTRIBUTING.md](CONTRIBUTING.md#deploying).
