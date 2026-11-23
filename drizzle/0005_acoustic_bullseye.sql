CREATE TABLE `personal_goal_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `personal_savings_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`account_id` text NOT NULL,
	`currency` text NOT NULL,
	`target` integer NOT NULL,
	`target_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_access_tombstones` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`)
);
--> statement-breakpoint
ALTER TABLE `personal_budgets` ADD `carryover_from_id` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `receipt_uris` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `refund_of_id` text;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `refund_snapshot` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `invite_expires_at` text;