import { eq, inArray } from "drizzle-orm";
import { getAdminIdentity } from "./admin-identity";
import { getDb } from "../db";
import { adminGroupMembers, adminGroups, adminUsers } from "../db/schema";
import { getRuntimeEnv } from "./runtime-env";
import type { AdminAction, AdminPermissions, AdminTab } from "./types";

const tabs: AdminTab[] = ["transactions", "forms", "registration", "branding", "system"];

export type AdminAccessUser = {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  permissions: AdminPermissions;
  groupIds: string[];
};

export function emptyPermissions(): AdminPermissions {
  return Object.fromEntries(tabs.map((tab) => [tab, { read: false, write: false }])) as AdminPermissions;
}

export function fullPermissions(): AdminPermissions {
  return Object.fromEntries(tabs.map((tab) => [tab, { read: true, write: true }])) as AdminPermissions;
}

export function normalizePermissions(value: unknown): AdminPermissions {
  const result = emptyPermissions();
  if (!value || typeof value !== "object") return result;
  for (const tab of tabs) {
    const current = (value as Record<string, unknown>)[tab];
    if (current && typeof current === "object") {
      result[tab].read = Boolean((current as Record<string, unknown>).read);
      result[tab].write = Boolean((current as Record<string, unknown>).write);
      if (result[tab].write) result[tab].read = true;
    }
  }
  return result;
}

function mergePermissions(...permissionSets: AdminPermissions[]) {
  const result = emptyPermissions();
  for (const tab of tabs) for (const action of ["read", "write"] as const) result[tab][action] = permissionSets.some((set) => set[tab][action]);
  return result;
}

function parsePermissions(value: string) {
  try { return normalizePermissions(JSON.parse(value)); } catch { return emptyPermissions(); }
}

function configuredAdmins() {
  const runtimeValue = getRuntimeEnv().ADMIN_EMAILS;
  const configured = typeof runtimeValue === "string" ? runtimeValue : undefined;
  return configured?.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean) ?? [];
}

export async function getAdminUser(): Promise<AdminAccessUser | null> {
  const identity = await getAdminIdentity();
  if (!identity) return null;
  const email = identity.email.toLowerCase();
  if (configuredAdmins().includes(email)) return { id: `bootstrap:${email}`, email, displayName: identity.displayName, isAdmin: true, permissions: fullPermissions(), groupIds: [] };

  try {
    const db = getDb();
    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    if (!row?.enabled) return null;
    const memberships = await db.select().from(adminGroupMembers).where(eq(adminGroupMembers.userId, row.id));
    const groupIds = memberships.map((membership) => membership.groupId);
    const groups = groupIds.length ? await db.select().from(adminGroups).where(inArray(adminGroups.id, groupIds)) : [];
    if (row.authSource === "local") return null;
    const isAdmin = groups.some((group) => group.isAdmin);
    const permissions = isAdmin ? fullPermissions() : mergePermissions(...groups.map((group) => parsePermissions(group.permissions)));
    return { id: row.id, email, displayName: row.name || identity.displayName, isAdmin, permissions, groupIds };
  } catch {
    return null;
  }
}

export async function requireAdminApi(request: Request, permission?: { tab: AdminTab; action: AdminAction; adminOnly?: boolean }) {
  const user = await getAdminUser();
  if (!user) return { response: Response.json({ error: "Unauthorized" }, { status: 401 }), user: null };
  if (permission && !user.isAdmin && (permission.adminOnly || !user.permissions[permission.tab][permission.action])) {
    return { response: Response.json({ error: "You do not have permission to perform this action." }, { status: 403 }), user: null };
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return { response: Response.json({ error: "Invalid request origin" }, { status: 403 }), user: null };
    }
  }
  return { response: null, user };
}
