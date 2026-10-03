ALTER TABLE `ai_requests` ADD `trial_run_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_ai_trial_status` ON `ai_requests` (`trial_run_id`,`status`);