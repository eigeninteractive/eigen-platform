DROP INDEX `idx_rating_history_user_pool`;--> statement-breakpoint
ALTER TABLE `games` ADD `seq` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `finish_seq` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_games_finish_seq` ON `games` (`finish_seq`) WHERE finish_seq IS NOT NULL;