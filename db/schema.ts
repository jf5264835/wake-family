import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const registrations = sqliteTable(
  "registrations",
  {
    id: text("id").primaryKey(),
    formId: text("form_id").notNull().default("family-registration"),
    status: text("status").notNull(),
    rawPayload: text("raw_payload").notNull(),
    normalizedPayload: text("normalized_payload").notNull(),
    matchPayload: text("match_payload"),
    integrationState: text("integration_state").notNull().default("{}"),
    pcoHouseholdId: text("pco_household_id"),
    pcoPrimaryPersonId: text("pco_primary_person_id"),
    lastError: text("last_error"),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("registrations_status_idx").on(table.status),
    index("registrations_created_idx").on(table.createdAt),
  ],
);

export const registrationLogs = sqliteTable(
  "registration_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    registrationId: text("registration_id").notNull(),
    level: text("level").notNull(),
    event: text("event").notNull(),
    message: text("message").notNull(),
    details: text("details"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("registration_logs_registration_idx").on(table.registrationId)],
);

export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey().default("default"),
  settings: text("settings").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const forms = sqliteTable(
  "forms",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("draft"),
    definition: text("definition").notNull(),
    createdBy: text("created_by").notNull().default(""),
    editPolicy: text("edit_policy").notNull().default("owner"),
    sharedUserIds: text("shared_user_ids").notNull().default("[]"),
    sharedGroupIds: text("shared_group_ids").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("forms_status_idx").on(table.status)],
);

export const adminUsers = sqliteTable(
  "admin_users",
  {
    id: text("id").primaryKey(),
    email: text("email").unique(),
    username: text("username").unique(),
    name: text("name").notNull(),
    authSource: text("auth_source").notNull().default("saml"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("admin_users_email_idx").on(table.email), index("admin_users_username_idx").on(table.username)],
);

export const adminGroups = sqliteTable("admin_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  samlGroupKey: text("saml_group_key").notNull().default(""),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  permissions: text("permissions").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const adminGroupMembers = sqliteTable(
  "admin_group_members",
  {
    userId: text("user_id").notNull(),
    groupId: text("group_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.groupId] }), index("admin_group_members_group_idx").on(table.groupId)],
);

export const adminAuditLogs = sqliteTable(
  "admin_audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorEmail: text("actor_email").notNull(),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    summary: text("summary").notNull(),
    details: text("details"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("admin_audit_logs_created_idx").on(table.createdAt), index("admin_audit_logs_actor_idx").on(table.actorEmail)],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  expiresAt: integer("expires_at").notNull(),
});
