CREATE TABLE `game_finishes` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_finishes_gameId_unique` ON `game_finishes` (`game_id`);--> statement-breakpoint
DROP INDEX `idx_rating_history_user_pool`;--> statement-breakpoint
ALTER TABLE `games` ADD `seq` integer DEFAULT 0 NOT NULL;