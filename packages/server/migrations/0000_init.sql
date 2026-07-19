CREATE TABLE `bots` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`schema_version` integer NOT NULL,
	`type` text NOT NULL,
	`webhook_url` text,
	`rated_eligible` integer NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "bots_webhook_matches_type" CHECK(("bots"."type" = 'external') = ("bots"."webhook_url" IS NOT NULL)),
	CONSTRAINT "bots_type_valid" CHECK("bots"."type" IN ('engine', 'external', 'local'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bots_username_unique` ON `bots` (`username`);--> statement-breakpoint
CREATE TABLE `device_installations` (
	`fid` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_device_installations_user` ON `device_installations` (`user_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by` text,
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
	`short_code` text NOT NULL,
	`pending_players` text,
	`turn_deadline` integer,
	`outcomes` text,
	`finish_id` text,
	`finished_at` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_short_code_unique` ON `games` (`short_code`);--> statement-breakpoint
CREATE INDEX `idx_games_status_access` ON `games` (`status`,`access`);--> statement-breakpoint
CREATE INDEX `idx_games_created_by` ON `games` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_games_lobby` ON `games` (`created_at`) WHERE access = 'public' AND status IN ('waiting', 'ready');--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`user_id` text,
	`bot_id` text,
	`player_index` integer NOT NULL,
	`type` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participants_unique` ON `participants` (`game_id`,`user_id`) WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participants_player_index` ON `participants` (`game_id`,`player_index`);--> statement-breakpoint
CREATE INDEX `idx_participants_user_id` ON `participants` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_participants_game_id` ON `participants` (`game_id`);--> statement-breakpoint
CREATE TABLE `player_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`bot_id` text,
	`pool` text NOT NULL,
	`mu` real NOT NULL,
	`sigma` real NOT NULL,
	`display_rating` integer NOT NULL,
	`revision` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_player_ratings_user_pool` ON `player_ratings` (`user_id`,`pool`) WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_player_ratings_bot_pool` ON `player_ratings` (`bot_id`,`pool`) WHERE bot_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE `rating_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`bot_id` text,
	`game_id` text NOT NULL,
	`pool` text NOT NULL,
	`finish_id` text NOT NULL,
	`mu_before` real NOT NULL,
	`sigma_before` real NOT NULL,
	`display_before` integer NOT NULL,
	`mu_after` real NOT NULL,
	`sigma_after` real NOT NULL,
	`display_after` integer NOT NULL,
	`display_change` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rating_history_game_user` ON `rating_history` (`game_id`,`user_id`) WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rating_history_game_bot` ON `rating_history` (`game_id`,`bot_id`) WHERE bot_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_rating_history_user_pool` ON `rating_history` (`user_id`,`pool`,`created_at`);--> statement-breakpoint
CREATE TABLE `relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id_1` text NOT NULL,
	`user_id_2` text NOT NULL,
	`initiated_by` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_relationships_pair` ON `relationships` (`user_id_1`,`user_id_2`);--> statement-breakpoint
CREATE INDEX `idx_relationships_user2` ON `relationships` (`user_id_2`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`is_anonymous` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_username` ON `users` (`username`);