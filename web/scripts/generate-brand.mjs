// Generates the full EigenInteractive brand asset set into static/brand/ from
// the two paths that make up the mark. Run it with `pnpm run generate-brand`
// and commit the output; nothing in static/brand/ should be hand-edited.
//
// Geometry is the one documented in static/brand/USAGE.md. The crop safe-zone
// scales are *derived* from the mark's circumscribed radius rather than
// guessed, since that is the part which is easy to get wrong by hand.
//
// The wordmark is outlined with Space Grotesk Medium (SIL OFL, vendored under
// scripts/assets/ with its licence), so no shipped asset needs a webfont.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import sharp from "sharp";

// The accent is Material 3's `primary` for a `Colors.teal` seed, one value per
// brightness: literally what `ColorScheme.fromSeed` hands the Flutter shell,
// and what the engine's public pages set `--primary` to.
//
// It is defined there and copied here, rather than the other way round, because
// a UI has to derive a whole scheme from the accent and a mark only has to be
// drawn in it. M3 pulls any seed to tone 40 and rebuilds the ramp around it, so
// a hand-picked brand hex comes back as something near itself but not itself: a
// logo can match a generated palette, a generated palette cannot be talked into
// matching a logo.
//
// Ink and paper are the mark's own and carry no such obligation; they are the
// two grounds it is drawn on, which is also why the game scaffolder uses them
// for launcher icons and splash screens.
const INK = "#1B1E24";
const PAPER = "#F4F1EA";
const ACCENT_LIGHT = "#006A60";
const ACCENT_DARK = "#82D5C8";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../static/brand");
mkdirSync(OUT, { recursive: true });

// The mark: one position, two continuations. viewBox carries one stroke width
// of clear space on every side, so it can be rendered edge-to-edge safely.
const VIEW_BOX = "25.3 19 149 149";
const FOLLOWED = "M80 109L150.711 33.289";
const PRUNED = "M80 160V104L48.887 72.887";

const mark = (accent, ink, width = 18) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" width="160" height="160" fill="none">
  <path d="${FOLLOWED}" stroke="${accent}" stroke-width="${width}" stroke-linecap="butt"></path>
  <path d="${PRUNED}" stroke="${ink}" stroke-width="${width}" stroke-linejoin="miter" stroke-linecap="butt"></path>
</svg>`;

const markLight = mark(ACCENT_LIGHT, INK);
const markDark = mark(ACCENT_DARK, PAPER);
const markLightHeavy = mark(ACCENT_LIGHT, INK, 26);
const markDarkHeavy = mark(ACCENT_DARK, PAPER, 26);

const render = (svg, size) => sharp(Buffer.from(svg), { density: 900 }).resize(size, size).png();

/** Mark centred on an opaque square, optionally inset for a crop safe zone. */
async function plate(svg, size, background, scale = 1) {
  const inner = Math.round(size * scale);
  const art = await render(svg, inner).toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: art, gravity: "centre" }])
    .png()
    .toBuffer();
}

/** Mark centred on transparency, for Android adaptive-icon foregrounds. */
async function foreground(svg, size, scale) {
  const inner = Math.round(size * scale);
  const art = await render(svg, inner).toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: art, gravity: "centre" }])
    .png()
    .toBuffer();
}

const write = (name, buf) => {
  writeFileSync(resolve(OUT, name), buf);
  console.log("  ", name, `${(buf.length / 1024).toFixed(1)}kB`);
};

// ---------------------------------------------------------------- source SVGs

console.log("source marks:");
write("eigen-mark.svg", Buffer.from(`${markLight}\n`));
write("eigen-mark-dark.svg", Buffer.from(`${markDark}\n`));
write("eigen-mark-mono.svg", Buffer.from(`${mark("currentColor", "currentColor")}\n`));

// A browser cannot choose between two icon files by colour scheme; <link> has
// no prefers-color-scheme selector. One file that restyles itself is the only
// mechanism that actually works, so this supersedes favicon.svg +
// favicon-dark.svg as the single <link rel="icon" type="image/svg+xml">.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" width="160" height="160" fill="none">
  <style>
    .followed { stroke: ${ACCENT_LIGHT} }
    .pruned { stroke: ${INK} }
    @media (prefers-color-scheme: dark) {
      .followed { stroke: ${ACCENT_DARK} }
      .pruned { stroke: ${PAPER} }
    }
  </style>
  <path class="followed" d="${FOLLOWED}" stroke-width="26" stroke-linecap="butt"></path>
  <path class="pruned" d="${PRUNED}" stroke-width="26" stroke-linejoin="miter" stroke-linecap="butt"></path>
</svg>`;
write("favicon.svg", Buffer.from(`${faviconSvg}\n`));
write("favicon-light.svg", Buffer.from(`${markLightHeavy}\n`));
write("favicon-dark.svg", Buffer.from(`${markDarkHeavy}\n`));

// ------------------------------------------------------------------- favicons

console.log("favicons:");
for (const size of [16, 32, 64]) {
  write(`favicon-${size}.png`, await render(markLightHeavy, size).toBuffer());
}
/**
 * Packs already-encoded PNGs into an ICO.
 *
 * ICO is a container, not a codec: a 6-byte directory header, one 16-byte
 * entry per image, then the member files appended verbatim. Storing PNG rather
 * than BMP members has been valid since Windows Vista and is what every
 * browser expects at this point, so the PNGs sharp produced go in unchanged
 * and there is nothing here worth taking a dependency for.
 */
function encodeIco(pngs) {
  const HEADER = 6;
  const ENTRY = 16;
  const directory = Buffer.alloc(HEADER + ENTRY * pngs.length);
  directory.writeUInt16LE(0, 0); // reserved
  directory.writeUInt16LE(1, 2); // 1 = icon (2 would be a cursor)
  directory.writeUInt16LE(pngs.length, 4);

  let offset = directory.length;
  pngs.forEach(({ size, data }, i) => {
    const at = HEADER + ENTRY * i;
    // 0 means 256 in a single byte: the format's own escape, not a bug.
    directory.writeUInt8(size >= 256 ? 0 : size, at);
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1);
    directory.writeUInt8(0, at + 2); // palette size; 0 for truecolour
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(data.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });

  return Buffer.concat([directory, ...pngs.map((p) => p.data)]);
}

// .ico is the legacy fallback and cannot switch on colour scheme; it carries
// the light-background variant, matching the PNG favicons beside it.
const icoSizes = [16, 32, 48];
const icoMembers = await Promise.all(
  icoSizes.map(async (size) => ({
    size,
    data: await render(markLightHeavy, size).toBuffer(),
  })),
);
write("favicon.ico", encodeIco(icoMembers));

// -------------------------------------------------------------- app / PWA art

console.log("app icons:");
const inkBg = { r: 0x1b, g: 0x1e, b: 0x24, alpha: 1 };

// Full-bleed on ink, reproducing the supplied GitHub avatar at every size.
write("github-avatar-512.png", await plate(markDark, 512, inkBg));
write("icon-192.png", await plate(markDark, 192, inkBg));
write("icon-512.png", await plate(markDark, 512, inkBg));
write("app-icon-1024.png", await plate(markDark, 1024, inkBg));

// iOS composites any alpha against black, so the home-screen icon is opaque.
write("apple-touch-icon-180.png", await plate(markDark, 180, inkBg));

// Both crops below are sized against the mark's *circumscribed* radius, not
// its box: the followed arm's tip is the furthest inked point from centre, at
// 53.76% of the box width, so a naive "inset to the safe-zone percentage"
// pushes that tip outside the crop. Scales are derived, not eyeballed.
//
// Maskable PWA icons guarantee only the centre 80% (radius 40%), so max 0.744.
write("icon-maskable-512.png", await plate(markDark, 512, inkBg, 0.7));

// Android adaptive icons crop harder: 66dp of a 108dp canvas (radius 30.5%)
// is all that is guaranteed, so max 0.567. The foreground layer is transparent
// so the configured background colour shows through.
write("app-icon-foreground-1024.png", await foreground(markDark, 1024, 0.55));

// Splash art is transparent so one image sits on either brand background;
// flutter_native_splash takes a separate image_dark, hence two files.
write("splash-light-768.png", await foreground(markLight, 768, 0.45));
write("splash-dark-768.png", await foreground(markDark, 768, 0.45));

// ----------------------------------------------------------- Android notifier

// Not an SVG: Android's <vector> is its own dialect and has no viewBox origin,
// so the geometry is translated by the viewBox offset (-25.3, -19). API 21+
// ignores colour here and composites the alpha channel against its own tint,
// which is why this is a plain white silhouette.
const dx = 25.3;
const dy = 19;
const t = (x, y) => `${+(x - dx).toFixed(3)},${+(y - dy).toFixed(3)}`;
const notification = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="149"
    android:viewportHeight="149">
  <!-- The followed continuation. -->
  <path
      android:strokeColor="#FFFFFF"
      android:strokeWidth="26"
      android:strokeLineCap="butt"
      android:pathData="M${t(80, 109)}L${t(150.711, 33.289)}"/>
  <!-- The stem and the pruned stub. -->
  <path
      android:strokeColor="#FFFFFF"
      android:strokeWidth="26"
      android:strokeLineCap="butt"
      android:strokeLineJoin="miter"
      android:pathData="M${t(80, 160)}L${t(80, 104)}L${t(48.887, 72.887)}"/>
</vector>
`;
console.log("android:");
write("ic_notification.xml", Buffer.from(notification));

// ------------------------------------------------------------------- lockup

// The wordmark is converted to outlines so the lockup carries no webfont
// dependency. Space Grotesk Medium, SIL OFL, from the typeface's own repository.
const font = opentype.parse(readFileSync(resolve(HERE, "assets/SpaceGrotesk-Medium.otf")).buffer);
const WORDMARK = "EigenInteractive";
const MARK_SIZE = 38;
const GAP = 16;
const FONT_SIZE = 23;
const TRACKING = -0.015;
const capHeight = (font.tables.os2.sCapHeight ?? 700) / font.unitsPerEm;

const textX = MARK_SIZE + GAP;
// Optically centre the wordmark's cap height against the mark's box.
const baseline = MARK_SIZE / 2 + (capHeight * FONT_SIZE) / 2;
const wordPath = font.getPath(WORDMARK, textX, baseline, FONT_SIZE, { letterSpacing: TRACKING }).toPathData(3);
const wordWidth = font.getAdvanceWidth(WORDMARK, FONT_SIZE, { letterSpacing: TRACKING });
const lockupWidth = Math.ceil(textX + wordWidth);

const lockup = (accent, ink) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lockupWidth} ${MARK_SIZE}" width="${lockupWidth}" height="${MARK_SIZE}" fill="none">
  <svg x="0" y="0" width="${MARK_SIZE}" height="${MARK_SIZE}" viewBox="${VIEW_BOX}" overflow="visible">
    <path d="${FOLLOWED}" stroke="${accent}" stroke-width="18" stroke-linecap="butt"></path>
    <path d="${PRUNED}" stroke="${ink}" stroke-width="18" stroke-linejoin="miter" stroke-linecap="butt"></path>
  </svg>
  <path d="${wordPath}" fill="${ink}"></path>
</svg>`;

console.log("lockup:", `${lockupWidth}x${MARK_SIZE}`);
write("eigen-lockup.svg", Buffer.from(`${lockup(ACCENT_LIGHT, INK)}\n`));
write("eigen-lockup-dark.svg", Buffer.from(`${lockup(ACCENT_DARK, PAPER)}\n`));

// Raster lockups exist for READMEs: GitHub renders SVG, but npm and pub.dev
// strip it, and those two are exactly where the absolute-URL form is needed.
// Transparent, so a <picture> can swap them on colour scheme where supported
// and fall back to one <img> where it is not.
const LOCKUP_PNG_WIDTH = 360;
for (const [name, svg] of [
  ["eigen-lockup-360.png", lockup(ACCENT_LIGHT, INK)],
  ["eigen-lockup-dark-360.png", lockup(ACCENT_DARK, PAPER)],
]) {
  write(name, await sharp(Buffer.from(svg), { density: 900 }).resize({ width: LOCKUP_PNG_WIDTH }).png().toBuffer());
}

// ------------------------------------------------------------------ OG card

// 1200x630 is what og:image / twitter:image expect, and what GitHub, Slack and
// X render for every pasted link.
const OG_W = 1200;
const OG_H = 630;
const ogLockupWidth = 560;
const ogLockupHeight = (ogLockupWidth / lockupWidth) * MARK_SIZE;
const tagline = "The open-source engine for turn-based multiplayer games";
const taglineSize = 27;
const taglinePath = font.getPath(tagline, 0, 0, taglineSize, { letterSpacing: -0.005 }).toPathData(3);
const taglineWidth = font.getAdvanceWidth(tagline, taglineSize, {
  letterSpacing: -0.005,
});

// Centre the optical block (lockup, gap, tagline caps) rather than centring
// each line independently, which leaves the composition riding high.
const OG_GAP = 44;
const taglineCap = capHeight * taglineSize;
const ogBlock = ogLockupHeight + OG_GAP + taglineCap;
const ogTop = (OG_H - ogBlock) / 2;

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${OG_W} ${OG_H}" width="${OG_W}" height="${OG_H}">
  <rect width="${OG_W}" height="${OG_H}" fill="${INK}"/>
  <g transform="translate(${(OG_W - ogLockupWidth) / 2} ${ogTop})">
    <g transform="scale(${ogLockupWidth / lockupWidth})">
      <svg x="0" y="0" width="${MARK_SIZE}" height="${MARK_SIZE}" viewBox="${VIEW_BOX}" overflow="visible">
        <path d="${FOLLOWED}" stroke="${ACCENT_DARK}" stroke-width="18" stroke-linecap="butt" fill="none"></path>
        <path d="${PRUNED}" stroke="${PAPER}" stroke-width="18" stroke-linejoin="miter" stroke-linecap="butt" fill="none"></path>
      </svg>
      <path d="${wordPath}" fill="${PAPER}"></path>
    </g>
  </g>
  <g transform="translate(${(OG_W - taglineWidth) / 2} ${ogTop + ogLockupHeight + OG_GAP + taglineCap})">
    <path d="${taglinePath}" fill="${ACCENT_DARK}"></path>
  </g>
</svg>`;

console.log("og card:");
write(
  "og-card.png",
  // Supersampled, then resized down to the exact 1200x630 scrapers expect.
  await sharp(Buffer.from(ogSvg), { density: 144 }).resize(OG_W, OG_H).png().toBuffer(),
);
