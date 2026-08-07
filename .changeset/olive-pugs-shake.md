---
"@eigeninteractive/server": patch
---

Reword the footer credit to `Built with EigenInteractive`, linking only the
name — accent-coloured, no underline. A custom `madeByCredit` that names the
engine keeps the link on that word; one that does not renders as plain text.

Every link the engine renders — the legal pages, the store buttons, the credit
— now opens in a new tab, and the `/j` share page honours `madeByCredit`
instead of always showing the default.
