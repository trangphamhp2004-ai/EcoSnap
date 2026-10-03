CREATE TABLE `ai_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_key` text NOT NULL,
	`day` text NOT NULL,
	`month` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reserve_vnd` integer NOT NULL,
	`cost_vnd` integer DEFAULT 0 NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_user_key` ON `ai_requests` (`user_id`,`request_key`);--> statement-breakpoint
CREATE INDEX `idx_ai_user_day_status` ON `ai_requests` (`user_id`,`day`,`status`);--> statement-breakpoint
CREATE INDEX `idx_ai_month_status` ON `ai_requests` (`month`,`status`);--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`details` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `content` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`group_name` text DEFAULT '' NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_content_kind_published` ON `content` (`kind`,`published`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'Mới' NOT NULL,
	`file_key` text,
	`file_name` text,
	`file_type` text,
	`file_size` integer,
	`created_at` integer NOT NULL,
	`request_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_request_key_unique` ON `feedback` (`request_key`);--> statement-breakpoint
CREATE INDEX `idx_feedback_status_created` ON `feedback` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`month` text NOT NULL,
	`amount` integer NOT NULL,
	`actor_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_grants_user_month` ON `grants` (`user_id`,`month`);--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`method` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `content`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_history_user_created` ON `history` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved` (
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `content`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_user_item` ON `saved` (`user_id`,`item_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`daily_limit` integer DEFAULT 5 NOT NULL,
	`monthly_limit` integer DEFAULT 20 NOT NULL,
	`budget_vnd` integer DEFAULT 5000000 NOT NULL,
	`reserve_vnd` integer DEFAULT 1000 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`cooldown_until` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);
--> statement-breakpoint
INSERT INTO content(id,kind,title,group_name,payload,published,verified,source,updated_at) VALUES ('group-0','groups','Nhựa','','{}',1,1,'Danh mục EcoSnap đã thống nhất',0);
--> statement-breakpoint
INSERT INTO content(id,kind,title,group_name,payload,published,verified,source,updated_at) VALUES ('group-1','groups','Giấy','','{}',1,1,'Danh mục EcoSnap đã thống nhất',0);
--> statement-breakpoint
INSERT INTO content(id,kind,title,group_name,payload,published,verified,source,updated_at) VALUES ('group-2','groups','Thủy tinh','','{}',1,1,'Danh mục EcoSnap đã thống nhất',0);
--> statement-breakpoint
INSERT INTO content(id,kind,title,group_name,payload,published,verified,source,updated_at) VALUES ('group-3','groups','Kim loại','','{}',1,1,'Danh mục EcoSnap đã thống nhất',0);
--> statement-breakpoint
INSERT INTO content(id,kind,title,group_name,payload,published,verified,source,updated_at) VALUES ('group-4','groups','Quần áo','','{}',1,1,'Danh mục EcoSnap đã thống nhất',0);
--> statement-breakpoint
INSERT INTO content(id,kind,title,group_name,payload,published,verified,source,updated_at) VALUES ('group-5','groups','Điện tử','','{}',1,1,'Danh mục EcoSnap đã thống nhất',0);
--> statement-breakpoint
INSERT INTO content(id,kind,title,group_name,payload,published,verified,source,updated_at) VALUES ('group-6','groups','Hữu cơ','','{}',1,1,'Danh mục EcoSnap đã thống nhất',0);
--> statement-breakpoint
INSERT INTO content(id,kind,title,group_name,payload,published,verified,source,updated_at) VALUES ('group-7','groups','Khác','','{}',1,1,'Danh mục EcoSnap đã thống nhất',0);
