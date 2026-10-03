ALTER TABLE `ai_requests` ADD `image_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_requests` ADD `result_json` text;--> statement-breakpoint
ALTER TABLE `ai_requests` ADD `cost_estimated` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_requests` ADD `provider_response_id` text;--> statement-breakpoint
ALTER TABLE `history` ADD `recognition_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_history_recognition` ON `history` (`recognition_id`);