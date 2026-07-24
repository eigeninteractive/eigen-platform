---
sidebar_position: 2
title: Schemas & payload types
description: Standard Schema for state, action and config — and the two rules that keep your hooks free of unvalidated JSON.
---

# Schemas & payload types — schema-first

Every payload that crosses the JSON boundary (`state`, `action`, `config`) is
declared as a **Standard Schema** — bring Zod, Valibot, ArkType, anything that
implements the spec. The engine parses each payload with your schema *before*
your hook sees it, and re-validates the state your hook returns before
committing. So your hook bodies never touch unvalidated JSON.

Derive your TypeScript types from the schemas, and follow two rules:

- **Use `type` aliases via `z.infer`, not `interface`s.** The engine's
  `JsonObject` constraint needs the implicit index signature that a `type` gets
  and an `interface` doesn't.
- **Keep schemas transform-free.** What parses is what persists — don't reshape
  in the schema. And schemas must validate **synchronously** (the engine rejects
  an async schema as a game bug; every mainstream library is sync unless you opt
  into async refinements).

```ts
import { z } from "zod";

const moveSchema   = z.enum(["rock", "paper", "scissors"]);
const actionSchema = z.object({ move: moveSchema });
const configSchema = z.object({ targetWins: z.int().min(1).max(10) });
const stateSchema  = z.object({ /* your board */ });

type Action = z.infer<typeof actionSchema>;
type Config = z.infer<typeof configSchema>;
type State  = z.infer<typeof stateSchema>;
```
