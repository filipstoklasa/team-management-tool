CREATE TABLE `action_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`one_on_one_id` integer,
	`description` text NOT NULL,
	`owner` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`due_date` text,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`one_on_one_id`) REFERENCES `one_on_ones`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `action_item_user_status` ON `action_items` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`direction` text NOT NULL,
	`source` text,
	`category` text NOT NULL,
	`content` text NOT NULL,
	`shared` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `feedback_user_shared` ON `feedback` (`user_id`,`shared`);--> statement-breakpoint
CREATE TABLE `goal_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goal_id` integer NOT NULL,
	`date` text NOT NULL,
	`note` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goal_update_goal_date` ON `goal_updates` (`goal_id`,`date`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`category` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`target_date` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `goal_user_status` ON `goals` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `one_on_ones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`manager_notes` text,
	`their_topics` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `one_on_one_user_date` ON `one_on_ones` (`user_id`,`date`);