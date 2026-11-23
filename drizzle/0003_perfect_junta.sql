ALTER TABLE `groups` ADD `sync_user_id` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `sync_status` text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `invite_code` text;