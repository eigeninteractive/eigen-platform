---
"create-eigen-game": patch
---

The `firebase` CLI is now suggested as `curl -sL https://firebase.tools | bash` rather than `npm install -g firebase-tools`, both in the missing-tooling report and in the scaffolded project's README. That installer is Google's own, it picks a standalone binary or npm to suit the machine, and it is the one the Firebase documentation leads with. The npm install still works; it just needs a global prefix the reader may not have write access to.
