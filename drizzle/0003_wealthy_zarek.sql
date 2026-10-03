CREATE TABLE `sorting_results` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_key` text NOT NULL,
	`recognition_id` text,
	`selections` text NOT NULL,
	`rule_version` integer NOT NULL,
	`saved` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sort_user_key` ON `sorting_results` (`user_id`,`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sort_recognition` ON `sorting_results` (`recognition_id`);--> statement-breakpoint
CREATE INDEX `idx_sort_user_created` ON `sorting_results` (`user_id`,`created_at`);