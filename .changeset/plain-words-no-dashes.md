---
"@eigeninteractive/server": patch
"@eigeninteractive/kernel": patch
"@eigeninteractive/rules": patch
"@eigeninteractive/testkit": patch
"create-eigen-game": patch
---

Em dashes are gone from every line this repository writes. Most of that is comments and documentation, but some of it is text that ships:

- **Error and response messages.** `State updated, try again` (kernel `stateUpdated`), `Too many requests in a short window. Slow down and try again.`, `Unsupported image type '…'. Use image/jpeg, …`, `Account deletion failed. Please try again`. Dispatch on `code`, never on `error`, so nothing that follows that rule is affected.
- **OpenAPI descriptions**, and therefore the generated `eigen_api` Dart client and the published HTTP reference. Wording only; no operation, schema or status code moved.
- **Engine-rendered public pages.** A page title now reads `Terms of Service: My Game`, joined with a colon rather than a dash, and the `/j` share description separates the versus line with a comma.
- **`create-eigen-game`'s own output**, including the greeting, the missing-tooling report and the scaffolded project's README.

`worker-configuration.d.ts` is untouched: it is Cloudflare's generated runtime types, reproduced by `wrangler types`.
