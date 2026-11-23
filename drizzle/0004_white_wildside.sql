CREATE TABLE `personal_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `personal_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`month` text NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`amount` integer NOT NULL,
	`category` text,
	`account_id` text,
	`tag` text,
	`threshold` integer DEFAULT 80 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`expense_id` text,
	`actor_id` text,
	`action` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_activity_group_idx` ON `group_activity` (`group_id`);--> statement-breakpoint
CREATE TABLE `group_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`base_revision` integer NOT NULL,
	`local_revision` integer NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_operations_order_idx` ON `group_operations` (`user_id`,`group_id`,`local_revision`);--> statement-breakpoint
CREATE TABLE `personal_recurring_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text NOT NULL,
	`date` text NOT NULL,
	`template` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `personal_recurring_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`template` text NOT NULL,
	`start_date` text NOT NULL,
	`frequency` text NOT NULL,
	`interval` integer DEFAULT 1 NOT NULL,
	`next_date` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `personal_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`default_currency` text DEFAULT 'INR' NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD `currency` text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `entry_type` text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `account_id` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `to_account_id` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `refund_of_id` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `currency` text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `contributions` text;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `split_inputs` text;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `category` text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `method` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `reference` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `author_id` text;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `itemized` text;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `conversion` text;--> statement-breakpoint
ALTER TABLE `group_expenses` ADD `receipts` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `group_members` ADD `deactivated_at` text;--> statement-breakpoint
ALTER TABLE `group_members` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `currency` text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `owner_id` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `local_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `me_member_id` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `conflict_message` text;