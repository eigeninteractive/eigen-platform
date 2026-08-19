---
"@eigeninteractive/rules": patch
---

Remove the hand-written `contracts/` tree and its checker.

Nothing produced or consumed the per-version digested game-contract manifest under
`contracts/game/v1/`: it had one hand-written example, no generator, and no reader
— the same condition that let RFC 0003's protocol schemas drift into describing a
protocol that did not exist. Everything machine-readable about the platform is now
generated from the code that implements it: the HTTP surface as OpenAPI 3.1 from
the Zod wire schemas, and each game's payload schemas as `game-contract.json` from
its TypeScript rules, with the portable profile enforced at emission.

The contract-ID digest rule is preserved as prose in RFC 0005 rather than lost. It
is worth building when "same version integer, different rules" actually bites: the
drift check already forces a deployment's contract to match its own rules, so the
uncovered case is a shipped app built against stale rules for a version that still
exists.

`tool/check-contracts.mjs` is deleted with it, and `./tool/check.sh contracts` is
now `./tool/check.sh manifest`.
