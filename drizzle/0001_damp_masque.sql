CREATE TABLE `admin_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_email` text NOT NULL,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`summary` text NOT NULL,
	`details` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_logs_created_idx` ON `admin_audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `admin_audit_logs_actor_idx` ON `admin_audit_logs` (`actor_email`);--> statement-breakpoint
CREATE TABLE `admin_group_members` (
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `group_id`)
);
--> statement-breakpoint
CREATE INDEX `admin_group_members_group_idx` ON `admin_group_members` (`group_id`);--> statement-breakpoint
CREATE TABLE `admin_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`saml_group_key` text DEFAULT '' NOT NULL,
	`permissions` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`auth_source` text DEFAULT 'saml' NOT NULL,
	`local_auth_enabled` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`permissions` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE INDEX `admin_users_email_idx` ON `admin_users` (`email`);--> statement-breakpoint
ALTER TABLE `forms` ADD `created_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `edit_policy` text DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `shared_user_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `forms` ADD `shared_group_ids` text DEFAULT '[]' NOT NULL;