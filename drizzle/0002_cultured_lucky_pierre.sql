PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `admin_groups` ADD `is_admin` integer DEFAULT false NOT NULL;--> statement-breakpoint
INSERT INTO `admin_groups` (`id`, `name`, `saml_group_key`, `is_admin`, `permissions`, `created_at`, `updated_at`)
SELECT 'legacy-user-access:' || `id`, `name` || ' (migrated access)', '', `is_admin`, `permissions`, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM `admin_users`
WHERE `is_admin` = true OR `permissions` <> '{}';--> statement-breakpoint
INSERT INTO `admin_group_members` (`user_id`, `group_id`)
SELECT `id`, 'legacy-user-access:' || `id`
FROM `admin_users`
WHERE `is_admin` = true OR `permissions` <> '{}';--> statement-breakpoint
CREATE TABLE `__new_admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`username` text,
	`name` text NOT NULL,
	`auth_source` text DEFAULT 'saml' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_admin_users`("id", "email", "username", "name", "auth_source", "enabled", "created_at", "updated_at")
SELECT "id", "email",
  CASE WHEN "auth_source" IN ('local', 'either') OR "local_auth_enabled" = true THEN lower(substr("email", 1, instr("email", '@') - 1)) || '-' || substr(replace("id", '-', ''), 1, 6) ELSE NULL END,
  "name",
  CASE WHEN "auth_source" = 'saml' AND "local_auth_enabled" = true THEN 'either' ELSE "auth_source" END,
  "enabled", "created_at", "updated_at"
FROM `admin_users`;--> statement-breakpoint
DROP TABLE `admin_users`;--> statement-breakpoint
ALTER TABLE `__new_admin_users` RENAME TO `admin_users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_username_unique` ON `admin_users` (`username`);--> statement-breakpoint
CREATE INDEX `admin_users_email_idx` ON `admin_users` (`email`);--> statement-breakpoint
CREATE INDEX `admin_users_username_idx` ON `admin_users` (`username`);
