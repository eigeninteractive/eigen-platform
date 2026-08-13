#!/usr/bin/env node
/**
 * `eigen-inspect`: read a Worker's local `.wrangler` state from the terminal.
 *
 * Deliberately narrow. Wrangler already ships a first-party browser for local
 * resources (press `e` in `wrangler dev`, or open `/cdn-cgi/explorer`), and
 * generic table browsing is its job, not this tool's. What that view cannot do
 * is answer a question in the engine's own terms, because a game's truth is
 * split across two stores on purpose: the D1 index and the game's own Durable
 * Object. This reads both, decodes the JSON columns, prints the transition log
 * as a timeline, and says what the game is waiting for.
 *
 * It also runs with no dev server, no browser and no account, and emits
 * `--json` for a script or an agent.
 */

import { parseArgs } from "node:util";
import type { LocalGameRow, LocalGameView, LocalSeat } from "./local-state.js";
import { LocalStore } from "./local-state.js";

const HELP = `Usage: eigen-inspect <command> [options]

Read the local .wrangler state of an EigenInteractive Worker: the D1 index and
each game's own Durable Object database.

Commands:
  games                    The D1 index, newest first
  game <id|code|prefix>    One game across both stores, with its timeline
  do                       Every local Durable Object, mapped back to its game
  players                  Local users and bots, by id
  tables [--game <ref>]    Table names and row counts
  sql <query> [--game <ref>]
                           Run a read-only statement against D1 or one game's DO

Options:
  --dir <path>   Start the search for .wrangler/state here (default: cwd)
  --status <s>   games: filter by status
  --limit <n>    games: row cap (default 20)
  --game <ref>   tables/sql: target one game's Durable Object instead of D1
  --json         Emit JSON instead of a table
  -h, --help     Show this help

Every database is opened read-only, so this is safe to run while the Worker is
running. Wrangler's own browser for the same files is \`e\` in \`wrangler dev\`.`;

function relative(ms: number | null): string {
  if (ms === null) return "never";
  const delta = Date.now() - ms;
  const future = delta < 0;
  const seconds = Math.round(Math.abs(delta) / 1000);
  const [value, unit] = seconds < 60 ? [seconds, "s"] : seconds < 3600 ? [Math.round(seconds / 60), "m"] : seconds < 86400 ? [Math.round(seconds / 3600), "h"] : [Math.round(seconds / 86400), "d"];
  return future ? `in ${value}${unit}` : `${value}${unit} ago`;
}

/** Render rows as an aligned table. Values are stringified defensively because
 * SQLite hands back whatever the column holds, including blobs and nulls. */
function table(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "(no rows)";
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const cell = (value: unknown): string => (value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value));
  const widths = columns.map((column) => Math.max(column.length, ...rows.map((row) => cell(row[column]).length)));
  const line = (values: string[]): string =>
    values
      .map((value, i) => value.padEnd(widths[i]))
      .join("  ")
      .trimEnd();
  return [line(columns), line(widths.map((w) => "-".repeat(w))), ...rows.map((row) => line(columns.map((column, i) => cell(row[column]).padEnd(widths[i]))))].join("\n");
}

function short(id: string | null, length = 8): string {
  return id === null ? "" : id.length <= length ? id : `${id.slice(0, length)}…`;
}

function seatLabel(seat: LocalSeat): string {
  const identity = seat.username ?? short(seat.userId ?? seat.botId);
  return `${seat.playerIndex}:${identity || "(empty)"}${seat.type === "bot" ? " (bot)" : ""}`;
}

function timingLabel(row: { turnSeconds: number | null; budgetSeconds: number | null; incrementSeconds: number | null }): string {
  if (row.turnSeconds !== null) return `${row.turnSeconds}s per turn`;
  if (row.budgetSeconds !== null) return `${row.budgetSeconds}s budget${row.incrementSeconds === null ? "" : ` +${row.incrementSeconds}s`}`;
  return "untimed";
}

function gamesTable(rows: LocalGameRow[]): Record<string, unknown>[] {
  return rows.map((row) => ({
    id: short(row.id, 8),
    code: row.shortCode,
    status: row.status,
    access: row.access,
    seats: `${row.minPlayers}-${row.maxPlayers}`,
    rated: row.rated ? "yes" : "no",
    timing: timingLabel(row),
    pending: row.pendingPlayers === null ? "" : JSON.stringify(row.pendingPlayers),
    updated: relative(row.updatedAt),
  }));
}

/** The `game` report: the whole session in reading order, index first, then the
 * authoritative session, then the log, then the one sentence that explains it. */
function renderGame(view: LocalGameView): string {
  const out: string[] = [];
  const index = view.index;
  out.push(`Game ${view.gameId}${index === null ? "" : `  ${index.shortCode}`}`);

  if (index === null) {
    out.push("", "D1 index      (no games row)");
  } else {
    out.push(
      "",
      `D1 index      status=${index.status}  access=${index.access}  rated=${index.rated ? "yes" : "no"}  schema=v${index.schemaVersion}`,
      `              seats ${index.minPlayers}-${index.maxPlayers}  ${timingLabel(index)}  created ${relative(index.createdAt)}  updated ${relative(index.updatedAt)}`,
      `config        ${JSON.stringify(index.config)}`,
      `participants  ${view.indexSeats.length === 0 ? "(none)" : view.indexSeats.map(seatLabel).join("   ")}`,
    );
    if (index.finishedAt !== null) out.push(`finished      ${relative(index.finishedAt)}  outcomes ${JSON.stringify(index.outcomes)}`);
  }

  out.push("");
  if (view.durableObject === null) {
    out.push("Durable Object  (none: no command or socket has touched this game yet)");
  } else {
    out.push(`Durable Object  ${short(view.durableObject.id, 12)}  ${view.durableObject.file}`);
    const meta = view.meta;
    if (meta === null) {
      out.push("DO meta       (no meta row: the object exists but never initialised)");
    } else {
      out.push(`DO meta       status=${meta.status}  seats ${meta.minPlayers}-${meta.maxPlayers}  createdBy=${short(meta.createdBy)}  rngSeed=${meta.rngSeed === null ? "(unset, so no start has committed)" : short(meta.rngSeed, 12)}`);
    }
    out.push(`roster        ${view.roster.length === 0 ? "(empty)" : view.roster.map(seatLabel).join("   ")}`);
    out.push(`alarm         ${view.alarm === null || view.alarm.scheduledTime === null ? "none armed" : `${new Date(view.alarm.scheduledTime).toISOString()} (${relative(view.alarm.scheduledTime)})`}`);
    out.push(`commands      ${view.commands.length} recorded`);
    if (view.outbox.length > 0) out.push(`outbox        ${view.outbox.length} UNAPPLIED finish row(s): ${view.outbox.map((row) => short(row.finishId)).join(", ")}`);
  }

  out.push("", "Timeline");
  if (view.transitions.length === 0) {
    out.push("  (no transitions: the game has not started, so there is no v0)");
  } else {
    for (const transition of view.transitions) {
      const action = transition.action;
      const cause = action === null ? "start" : `${action.kind}/${action.type}${action.playerIndex === null ? "" : ` seat ${action.playerIndex}`}`;
      const payload = action === null || action.data === null || action.data === undefined ? "" : ` ${JSON.stringify(action.data)}`;
      out.push(`  v${String(transition.version).padEnd(3)} ${cause}${payload}`);
      out.push(`       state ${JSON.stringify(transition.state)}`);
      out.push(`       pending ${JSON.stringify(transition.pending)}  deadline ${transition.deadline === null ? "none" : relative(transition.deadline)}  frames ${transition.frameSeats.length === 0 ? "(compacted)" : JSON.stringify(transition.frameSeats)}`);
    }
  }

  out.push("", `Diagnosis     ${view.diagnosis.summary}`);
  for (const drift of view.diagnosis.mirrorDrift) out.push(`Mirror drift  ${drift}`);
  return out.join("\n");
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: "string" },
      status: { type: "string" },
      limit: { type: "string" },
      game: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  const [command, ...rest] = positionals;
  if (values.help === true || command === undefined) {
    console.log(HELP);
    return;
  }

  const emit = (value: unknown, text: () => string): void => {
    console.log(values.json === true ? JSON.stringify(value, null, 2) : text());
  };

  const store = LocalStore.open(values.dir);
  try {
    switch (command) {
      case "games": {
        const rows = store.games({ status: values.status, limit: values.limit === undefined ? 20 : Number(values.limit) });
        emit(rows, () => (rows.length === 0 ? "no games in the local D1 index" : table(gamesTable(rows))));
        return;
      }
      case "game": {
        const ref = rest[0];
        if (ref === undefined) throw new Error("game needs an id, short code, or id prefix");
        const view = store.game(ref);
        if (view === null) throw new Error(`no game matching "${ref}" in the local D1 index or in any local Durable Object`);
        emit(view, () => renderGame(view));
        return;
      }
      case "do": {
        // Paths print relative to the state root: the absolute prefix is the
        // same on every row and pushes the useful columns off the terminal.
        const objects = store.durableObjects().map((object) => ({ class: object.className, game: object.name ?? "(unnamed)", doId: short(object.id, 12), file: object.file.startsWith(store.root) ? object.file.slice(store.root.length + 1) : object.file }));
        emit(objects, () => (objects.length === 0 ? "no local Durable Objects: nothing has created a game session yet" : table(objects)));
        return;
      }
      case "players": {
        const users = store.query("select id, username, display_name, is_anonymous, created_at from users order by created_at desc");
        const bots = store.query("select id, username, display_name, type, schema_version from bots order by username");
        emit({ users, bots }, () => `Users\n${table(users)}\n\nBots\n${table(bots)}`);
        return;
      }
      case "tables": {
        const rows = store.tables({ game: values.game });
        emit(rows, () => table(rows));
        return;
      }
      case "sql": {
        const sql = rest.join(" ");
        if (sql === "") throw new Error("sql needs a statement");
        const rows = store.query(sql, { game: values.game });
        emit(rows, () => table(rows));
        return;
      }
      default:
        throw new Error(`unknown command "${command}". Run eigen-inspect --help`);
    }
  } finally {
    store.close();
  }
}

try {
  main();
} catch (error) {
  console.error(`eigen-inspect: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
