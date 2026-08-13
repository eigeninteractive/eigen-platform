# EigenInteractive platform

This repository is the vNext implementation workspace for EigenInteractive.
It consolidates the platform's server, Flutter client, and documentation while
preserving the complete history of each original repository.

The initial import is intentionally behavior-preserving:

- `server/` is the former `eigen-server` repository;
- `flutter/` is the former `eigen-flutter` repository;
- `web/` is the former `eigen-web` repository.

Package extraction and directory normalization happen only after the imported
baseline passes unchanged. The original repositories and their GitHub remotes
remain intact as archives until a separately authorized cutover.

See [`docs/architecture/`](docs/architecture/) for vNext decisions and
[`platform.json`](platform.json) for the exact imported release set.
