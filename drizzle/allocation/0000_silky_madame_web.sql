CREATE TABLE `allocation_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`allocation_id` integer NOT NULL,
	`changed_at` integer NOT NULL,
	`change_type` text NOT NULL,
	`note` text,
	FOREIGN KEY (`allocation_id`) REFERENCES `allocations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `alloc_change_alloc` ON `allocation_changes` (`allocation_id`);--> statement-breakpoint
CREATE TABLE `allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`app_id` integer NOT NULL,
	`percentage` real NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "alloc_pct_range" CHECK("allocations"."percentage" > 0 AND "allocations"."percentage" <= 100),
	CONSTRAINT "alloc_end_after_start" CHECK("allocations"."end_date" IS NULL OR "allocations"."end_date" > "allocations"."start_date")
);
--> statement-breakpoint
CREATE INDEX `alloc_user_range` ON `allocations` (`user_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `alloc_app_range` ON `allocations` (`app_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `app_teams` (
	`app_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	PRIMARY KEY(`app_id`, `team_id`),
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `apps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`required_capacity` real NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`notes` text,
	CONSTRAINT "apps_capacity_non_negative" CHECK("apps"."required_capacity" >= 0)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_teams` (
	`user_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `team_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`start_date` text,
	`active` integer DEFAULT true NOT NULL
);
