/**
 * Serve Flutter's static `index.html` through the Worker for the two dynamic
 * app-link paths. The browser receives the same SPA shell as `/`, while social
 * crawlers see per-game metadata produced from D1.
 */

export interface FlutterShellMetadata {
  title: string;
  description: string;
  siteName: string;
  image?: string;
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export async function renderFlutterShell(request: Request, assets: Fetcher, metadata: FlutterShellMetadata, status = 200): Promise<Response> {
  const indexUrl = new URL("/index.html", request.url);
  const asset = await assets.fetch(new Request(indexUrl, { headers: { Accept: "text/html" } }));
  if (!asset.ok || asset.body === null) {
    throw new Error(`Flutter web assets could not serve /index.html (status ${asset.status})`);
  }

  const title = escapeAttribute(metadata.title);
  const description = escapeAttribute(metadata.description);
  const canonicalUrl = new URL(request.url);
  canonicalUrl.search = "";
  canonicalUrl.hash = "";
  const url = escapeAttribute(canonicalUrl.toString());
  const siteName = escapeAttribute(metadata.siteName);
  const image = metadata.image === undefined ? "" : `<meta property="og:image" content="${escapeAttribute(metadata.image)}">`;
  const head = [
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:site_name" content="${siteName}">`,
    image,
    `<meta name="twitter:card" content="${metadata.image === undefined ? "summary" : "summary_large_image"}">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    metadata.image === undefined ? "" : `<meta name="twitter:image" content="${escapeAttribute(metadata.image)}">`,
    '<meta name="robots" content="noindex">',
    `<link rel="canonical" href="${url}">`,
  ].join("");

  const headers = new Headers(asset.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "text/html; charset=utf-8");
  const shell = new Response(asset.body, { status, headers });

  return new HTMLRewriter()
    .on("title", {
      element(element) {
        element.setInnerContent(metadata.title);
      },
    })
    .on('meta[name="description"]', {
      element(element) {
        element.setAttribute("content", metadata.description);
      },
    })
    .on('meta[property^="og:"]', {
      element(element) {
        element.remove();
      },
    })
    .on('meta[name^="twitter:"]', {
      element(element) {
        element.remove();
      },
    })
    .on('meta[name="robots"], link[rel="canonical"]', {
      element(element) {
        element.remove();
      },
    })
    .on("head", {
      element(element) {
        element.append(head, { html: true });
      },
    })
    .on("body", {
      element(element) {
        element.append(`<noscript><p><a href="/download">Download ${escapeAttribute(metadata.siteName)}</a></p></noscript>`, { html: true });
      },
    })
    .transform(shell);
}
