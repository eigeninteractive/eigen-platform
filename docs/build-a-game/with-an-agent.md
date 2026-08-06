---
sidebar_position: 12
title: Working with an agent
description: The Claude Code skill for writing Eigen games, the retrieval surface behind these docs, and the mistakes an agent makes on this contract that a reviewer should look for.
---

# Working with an agent

A game is a small, sharply-specified module — six pure functions and a widget —
which is the kind of thing a coding agent does well, provided it knows the
contract. Two things make that true rather than hopeful: a skill that states the
contract, and a retrieval surface so the agent reads current documentation
instead of recalling a version of the engine that no longer exists.

## The Claude Code skill

The engine repository is a plugin marketplace. Install it once:

```text
/plugin marketplace add eigeninteractive/eigen-server
/plugin install eigen@eigeninteractive
```

That adds the `building-a-game` skill, which loads when the work is writing or
reviewing an Eigen game — implementing rules, adding a schema version, writing a
bot brain, or debugging a rejected move. It carries the parts of this contract
that are easy to get wrong and expensive to discover late: the four invariants,
what the engine has already validated before your hook runs, the
`computeObservation` projection rule, and a review checklist.

It ships from the engine repository, so it moves with the engine rather than
drifting behind it.

## The retrieval surface

Every page on this site is also machine-readable, which is what lets an agent
work from what the engine does *now*:

| What | Where |
|---|---|
| Index of every page | [`/llms.txt`](pathname:///llms.txt) |
| Everything in one file | [`/llms-full.txt`](pathname:///llms-full.txt) |
| Any page as Markdown | append `.md` to its URL |
| The HTTP contract | [`/openapi.json`](pathname:///openapi.json) |

The generated HTTP reference is deliberately excluded from the `llms` bundles —
those pages are component trees, and the raw spec is the better input.

Worth putting in your project's `AGENTS.md` or `CLAUDE.md`: an instruction to
retrieve rather than recall. Model training data will contain other turn-based
engines and older shapes of this one, and the failure mode is confident,
plausible code against an API that was never real.

## Where agents go wrong on this contract

These are the mistakes worth reviewing for specifically, because each one
produces code that looks correct and passes a casual read:

- **Re-validating what the engine already enforced.** Turn order, version,
  seat ownership and the deadline are checked before `applyAction` is called.
  A hand-written `if (playerIndex !== state.turn)` is not a safety net; it is a
  second, divergent source of truth. See [The hooks](./hooks.md).
- **Reaching for wall-clock time or `Math.random()`.** Determinism is not a
  style preference here — replay, reconnection and optimistic preview all
  depend on it. Randomness comes from the injected `rng`, drawn in a fixed
  order.
- **Branching on `schemaVersion` inside a hook.** The engine resolves the
  version before calling anything, so a version check in a hook body is always
  wrong. See [Evolving your game](./versions.md).
- **Projecting the state instead of the seat's view.** The commonest and most
  damaging: `computeObservation` returning the full state, or stripping the
  hidden field while leaving `pendingPlayers` truthful enough to reveal that an
  opponent has already committed. See [Hidden
  information](./hidden-information.md).
- **Putting engine-owned facts in your state.** Whose turn it is, the deadline
  and the result belong to the engine. State that carries its own `winner` will
  disagree with the engine's eventually.

## Let the tests do the reviewing

You do not have to catch all of that by reading. The
[twin fixtures](./testing.md) are shared JSON run by both the TypeScript and
Dart halves, so a rules twin an agent transcribed incorrectly fails a test
rather than shipping as a UI that greys out the wrong button:

```bash
pnpm run contract:check   # from the repository root
pnpm test                 # in server/ — the TypeScript half
flutter test              # in app/ — the Dart half, on the same fixtures
```

Ask for fixtures alongside rules, not after them — at minimum one legal move
with its expected observation, one illegal move, one game-ending move, and a
case for each `ratingPool` and `botSeatable` branch. A generated hook with no
fixture is the part of the diff to read closely; a generated hook with a fixture
that fails is simply a fix.
