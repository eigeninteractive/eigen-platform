---
"@eigeninteractive/server": patch
---

Serve a placeholder app icon instead of linking one that is not there.

Every page the engine renders linked `/favicon.png` and `/icons/Icon-192.png`
unconditionally. Those are static assets from the game's own `public/`, which a
fresh scaffold ships holding a single `.gitkeep`, so until a Flutter web build
landed there the browser tab was blank and all four manifest icons 404ed. An
Android-only game, which never runs `build:web`, stayed that way permanently,
even though the download page's hero already had a fallback for exactly this
case.

The shell now links the EigenInteractive mark, served by the worker at
`/_eigen/icon/v1/mark.svg` and drawn in the game's `site.primaryColor`, and the
manifest advertises that single scalable icon rather than four missing PNGs.
Apple's touch icon is omitted rather than pointed at a missing file, since it
has no SVG support.

It is a placeholder, not a default: as soon as `favicon.png` exists in
`public/`, the shell links the game's own icons everywhere and the placeholder
goes unused.

The probe behind that decision was split in two. `hasWebBuild` asks for
`index.html` and still gates the "Play on the web" button; the new
`hasAppIcons` asks for `favicon.png` and gates every icon. They used to be one
question on the grounds that `flutter build web` emits both together, which is
true for a game that ships on the web and wrong for the case worth supporting:
an Android-only game that copies its launcher icons into `public/` now gets
them. `hasAppIcons` checks the response's content type as well as its status,
because the scaffold's `single-page-application` fallback answers `200 OK` with
`index.html` for any asset that is missing.
