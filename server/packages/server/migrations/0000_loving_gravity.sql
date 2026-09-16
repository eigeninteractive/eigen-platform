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
CREATE TABLE `commerce_capacity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`metric` text NOT NULL,
	`slot` integer NOT NULL,
	`game_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_commerce_capacity_slot` ON `commerce_capacity` (`user_id`,`metric`,`slot`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_commerce_capacity_game` ON `commerce_capacity` (`game_id`);--> statement-breakpoint
CREATE INDEX `idx_commerce_capacity_user` ON `commerce_capacity` (`user_id`,`metric`);--> statement-breakpoint
CREATE TABLE `commerce_checkout_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`user_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`offer_key` text NOT NULL,
	`fingerprint` text NOT NULL,
	`checkout_url` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_commerce_checkout_operations_identity` ON `commerce_checkout_operations` (`provider`,`user_id`,`operation_id`);--> statement-breakpoint
CREATE TABLE `commerce_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`provider_transaction_id` text,
	`received_at` integer NOT NULL,
	`processed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_commerce_events_provider_id` ON `commerce_events` (`provider`,`provider_event_id`);--> statement-breakpoint
CREATE TABLE `commerce_provider_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`user_id` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_commerce_provider_accounts_user` ON `commerce_provider_accounts` (`provider`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_commerce_provider_accounts_provider_id` ON `commerce_provider_accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE TABLE `commerce_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_transaction_id` text NOT NULL,
	`user_id` text,
	`provider_reference` text NOT NULL,
	`offer_key` text NOT NULL,
	`kind` text NOT NULL,
	`state` text NOT NULL,
	`purchased_at` integer NOT NULL,
	`valid_from` integer NOT NULL,
	`valid_until` integer,
	`sealed_provider_state` text,
	`acknowledgement_state` text NOT NULL,
	`last_reconciled_at` integer,
	`reconcile_attempted_at` integer,
	`reconcile_failures` integer DEFAULT 0 NOT NULL,
	`reconcile_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_commerce_transactions_provider_id` ON `commerce_transactions` (`provider`,`provider_transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_commerce_transactions_user` ON `commerce_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_commerce_transactions_sweep` ON `commerce_transactions` (`provider`,`reconcile_failures`,`reconcile_attempted_at`);--> statement-breakpoint
CREATE TABLE `commerce_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`metric` text NOT NULL,
	`period_key` text NOT NULL,
	`slot` integer NOT NULL,
	`operation_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_commerce_usage_operation` ON `commerce_usage` (`user_id`,`metric`,`operation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_commerce_usage_slot` ON `commerce_usage` (`user_id`,`metric`,`period_key`,`slot`);--> statement-breakpoint
CREATE INDEX `idx_commerce_usage_window` ON `commerce_usage` (`user_id`,`metric`,`period_key`);--> statement-breakpoint
CREATE TABLE `creation_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`creation_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`game_id` text NOT NULL,
	`short_code` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_creation_operations_creator_id` ON `creation_operations` (`creator_id`,`creation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_creation_operations_game` ON `creation_operations` (`game_id`);--> statement-breakpoint
CREATE TABLE `device_installations` (
	`fid` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_device_installations_user` ON `device_installations` (`user_id`);--> statement-breakpoint
CREATE TABLE `entitlement_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entitlement_key` text NOT NULL,
	`source_transaction_id` text NOT NULL,
	`valid_from` integer NOT NULL,
	`valid_until` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_entitlement_grants_source_key` ON `entitlement_grants` (`source_transaction_id`,`entitlement_key`);--> statement-breakpoint
CREATE INDEX `idx_entitlement_grants_user` ON `entitlement_grants` (`user_id`,`entitlement_key`);--> statement-breakpoint
CREATE TABLE `game_content` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`collection` text NOT NULL,
	`item_id` text NOT NULL,
	`classification` text NOT NULL,
	`ownership` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_game_content_item` ON `game_content` (`game_id`,`collection`,`item_id`,`ownership`);--> statement-breakpoint
CREATE INDEX `idx_game_content_game` ON `game_content` (`game_id`);--> statement-breakpoint
CREATE TABLE `game_finishes` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_finishes_gameId_unique` ON `game_finishes` (`game_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by` text,
	`status` text NOT NULL,
	`access` text NOT NULL,
	`origin` text DEFAULT 'online' NOT NULL,
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
	`seq` integer DEFAULT 0 NOT NULL,
	`finish_id` text,
	`finished_at` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "games_origin_valid" CHECK("games"."origin" IN ('online', 'local'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_shortCode_unique` ON `games` (`short_code`);--> statement-breakpoint
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
	`revision_before` integer NOT NULL,
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
CREATE UNIQUE INDEX `idx_rating_history_user_cas` ON `rating_history` (`user_id`,`pool`,`revision_before`) WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rating_history_bot_cas` ON `rating_history` (`bot_id`,`pool`,`revision_before`) WHERE bot_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE `relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id1` text NOT NULL,
	`user_id2` text NOT NULL,
	`initiated_by` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_relationships_pair` ON `relationships` (`user_id1`,`user_id2`);--> statement-breakpoint
CREATE INDEX `idx_relationships_user2` ON `relationships` (`user_id2`);--> statement-breakpoint
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