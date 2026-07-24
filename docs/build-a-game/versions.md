---
sidebar_position: 11
title: Evolving your game — versions
description: One GameRules unit per schema_version — copy, change, register, and let old games drain.
---

# Evolving your game — versions

When rules or payload shapes change **incompatibly**, do not edit a shipped
unit's semantics — that would break games (and replays) already running under it.
Instead:

1. Copy `v1.ts` to `v2.ts`, importing whatever didn't change.
2. Make the change in `v2`.
3. Register it: `versions: { 1: rulesV1, 2: rulesV2 }`.

New games are created at the latest version your build ships; existing games keep
running against their own version's unit until they drain, at which point you can
retire it by deleting the entry. The engine handles all dispatch — your hooks
never branch on version, and the schema gate makes an old client politely refuse
a newer game rather than mis-parsing it. Compatible tweaks (a bug fix that
doesn't change stored shapes or recorded behaviour) can edit the unit in place;
update the fixtures alongside.

:::warning Wire enums are closed sets

A schema-version bump is also what a wire-enum change requires — the generated
Dart client parses strictly, with no `unknown` sentinel. See
[The cross-repo contract](../reference/cross-repo.md).

:::
