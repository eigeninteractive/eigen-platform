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
CREATE INDEX `idx_game_content_game` ON `game_content` (`game_id`);