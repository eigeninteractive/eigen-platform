CREATE TABLE `commands` (
	`command_id` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `frames` (
	`version` integer NOT NULL,
	`player_index` integer NOT NULL,
	`data` text NOT NULL,
	`pending_players` text NOT NULL,
	PRIMARY KEY(`version`, `player_index`)
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`id` integer PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`status` text NOT NULL,
	`access` text NOT NULL,
	`schema_version` integer NOT NULL,
	`config` text NOT NULL,
	`turn_seconds` integer,
	`budget_seconds` integer,
	`increment_seconds` integer,
	`rated` integer NOT NULL,
	`rating_pool` text,
	`min_players` integer NOT NULL,
	`max_players` integer NOT NULL,
	`created_by` text,
	`rng_seed` text,
	`short_code` text NOT NULL,
	`outcomes` text,
	`seq` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`finish_id` text PRIMARY KEY NOT NULL,
	`outcomes` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roster` (
	`player_index` integer PRIMARY KEY NOT NULL,
	`user_id` text,
	`bot_id` text,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transitions` (
	`version` integer PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`action` text,
	`pending` text NOT NULL,
	`deadline` integer,
	`player_times` text,
	`turn_started_at` integer
);
