---
sidebar_position: 1
title: Repository model
description: What game implementors own, what engine developers own, and which boundaries keep those repositories independent.
---

# Repository model

## Game implementor

A game owns a Cloudflare Worker repository and a Flutter app repository. They
may be two directories in one repository or independent repositories.

The Worker depends on the published `@eigeninteractive/*` npm packages. The app
depends on the published `eigen_flutter` package. The only game-specific
artifact crossing between them is `game-contract.json`, emitted from the
Worker's authoritative schemas and fixtures and consumed by the Dart generator.

`create-eigen-game` scaffolds the common combined layout only. It adds no
runtime capability: teams using separate repositories can create either half by
hand from the same public contracts. npm and pnpm are the supported Node package
managers.

## Engine developer

Engine developers work in the three engine repositories:

- `eigen-server` publishes the TypeScript packages and the OpenAPI-generated
  `eigen_api`;
- `eigen-flutter` publishes the reusable Flutter shell and its Dart payload
  generator executable;
- `eigen-web` publishes these versioned docs and generated references.

Cross-repository source paths and dependency overrides are development-only.
No published manifest points at a sibling checkout.

Publishing and CI credentials are intentionally a separate setup pass. Until
then, workspace builds prove package contents and the scaffold CLI is exercised
from source; this does not alter the eventual implementor workflow.

See [The cross-repo contract](./cross-repo.md) for artifact promotion and
[Quickstart](../getting-started/quickstart.md) for commands.
