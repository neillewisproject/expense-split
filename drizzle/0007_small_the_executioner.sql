CREATE TABLE `personal_group_cash_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`expense_id` text NOT NULL,
	`member_id` text NOT NULL,
	`group_user_id` text,
	`account_id` text NOT NULL,
	`currency` text NOT NULL,
	`amount` integer NOT NULL,
	`direction` text NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`group_name` text NOT NULL,
	`expense_revision` integer NOT NULL,
	`created_at` text NOT NULL,
	`voided_at` text
);
