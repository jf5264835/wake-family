import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { adminGroupMembers, adminGroups, adminUsers, siteSettings } from "../../../../db/schema";
import { logAdminAction } from "../../../../lib/admin-audit";
import { emptyPermissions, normalizePermissions, requireAdminApi } from "../../../../lib/admin-auth";
import type { AdminAuthSettings } from "../../../../lib/types";

const defaultSettings: AdminAuthSettings = { localAuthEnabled: false, samlEnabled: true, samlGroupClaim: "groups" };
const authSources = new Set(["saml", "local", "either"]);

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, { tab: "system", action: "read", adminOnly: true });
  if (auth.response || !auth.user) return auth.response!;
  const db = getDb();
  const [users, groups, memberships, settingsRow] = await Promise.all([
    db.select().from(adminUsers).orderBy(adminUsers.name),
    db.select().from(adminGroups).orderBy(adminGroups.name),
    db.select().from(adminGroupMembers),
    db.select().from(siteSettings).where(eq(siteSettings.id, "auth")).limit(1),
  ]);
  const currentExists = users.some((user) => user.email?.toLowerCase() === auth.user!.email.toLowerCase());
  const visibleUsers = currentExists ? users : [{
    id: auth.user.id,
    email: auth.user.email,
    username: null,
    name: auth.user.displayName,
    authSource: "saml",
    enabled: true,
    createdAt: "",
    updatedAt: "",
  }, ...users];
  return Response.json({ users: visibleUsers, groups, memberships, settings: settingsRow[0] ? { ...defaultSettings, ...JSON.parse(settingsRow[0].settings) } : defaultSettings });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi(request, { tab: "system", action: "write", adminOnly: true });
  if (auth.response || !auth.user) return auth.response!;
  const payload = await request.json() as Record<string, unknown>;
  const operation = String(payload.operation || "");
  const db = getDb();

  if (operation === "save_settings") {
    const incoming = payload.settings as Partial<AdminAuthSettings>;
    const settings: AdminAuthSettings = { localAuthEnabled: Boolean(incoming?.localAuthEnabled), samlEnabled: Boolean(incoming?.samlEnabled), samlGroupClaim: String(incoming?.samlGroupClaim || "groups").trim() || "groups" };
    await db.insert(siteSettings).values({ id: "auth", settings: JSON.stringify(settings), updatedBy: auth.user.email }).onConflictDoUpdate({ target: siteSettings.id, set: { settings: JSON.stringify(settings), updatedBy: auth.user.email, updatedAt: sql`CURRENT_TIMESTAMP` } });
    await logAdminAction(auth.user, "settings.update", "authentication", "auth", "Updated authentication settings.", settings);
    return Response.json({ settings });
  }

  if (operation === "save_user") {
    const data = payload.user as Record<string, unknown>;
    const id = String(data?.id || crypto.randomUUID());
    if (id.startsWith("bootstrap:")) return Response.json({ error: "The bootstrap administrator is managed by the server allowlist." }, { status: 400 });
    const name = String(data?.name || "").trim();
    const requestedAuthSource = String(data?.authSource || "saml");
    const authSource = authSources.has(requestedAuthSource) ? requestedAuthSource : "saml";
    const email = String(data?.email || "").trim().toLowerCase() || null;
    const username = String(data?.username || "").trim().toLowerCase() || null;
    if (!name) return Response.json({ error: "Name is required." }, { status: 400 });
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Enter a valid email or leave it blank." }, { status: 400 });
    if ((authSource === "saml" || authSource === "either") && !email) return Response.json({ error: "An email is required for SAML / SSO accounts." }, { status: 400 });
    if ((authSource === "local" || authSource === "either") && !username) return Response.json({ error: "A username is required for local accounts." }, { status: 400 });
    if (username && !/^[a-z0-9._-]{3,64}$/.test(username)) return Response.json({ error: "Usernames must be 3 to 64 letters, numbers, periods, underscores, or hyphens." }, { status: 400 });
    const values = { id, email: authSource === "local" ? email : email!, username: authSource === "saml" ? null : username, name, authSource, enabled: data?.enabled !== false };
    const groupIds = Array.isArray(payload.groupIds) ? payload.groupIds.filter((value): value is string => typeof value === "string") : [];
    try {
      await db.insert(adminUsers).values(values).onConflictDoUpdate({ target: adminUsers.id, set: { ...values, updatedAt: sql`CURRENT_TIMESTAMP` } });
      await db.delete(adminGroupMembers).where(eq(adminGroupMembers.userId, id));
      if (groupIds.length) await db.insert(adminGroupMembers).values(groupIds.map((groupId) => ({ userId: id, groupId })));
    } catch {
      return Response.json({ error: "That email or local username is already assigned to another user." }, { status: 409 });
    }
    const identity = email || username || id;
    await logAdminAction(auth.user, "user.save", "admin_user", id, `Saved admin user ${identity}.`, { enabled: values.enabled, authSource, groupIds });
    return Response.json({ ok: true, id });
  }

  if (operation === "save_group") {
    const data = payload.group as Record<string, unknown>;
    const name = String(data?.name || "").trim();
    if (!name) return Response.json({ error: "Group name is required." }, { status: 400 });
    const id = String(data?.id || crypto.randomUUID());
    const isAdmin = Boolean(data?.isAdmin);
    const permissions = isAdmin ? emptyPermissions() : normalizePermissions(data?.permissions);
    const values = { id, name, samlGroupKey: String(data?.samlGroupKey || "").trim(), isAdmin, permissions: JSON.stringify(permissions) };
    await db.insert(adminGroups).values(values).onConflictDoUpdate({ target: adminGroups.id, set: { ...values, updatedAt: sql`CURRENT_TIMESTAMP` } });
    await logAdminAction(auth.user, "group.save", "admin_group", id, `Saved admin group ${name}.`, { samlGroupKey: values.samlGroupKey, isAdmin, permissions });
    return Response.json({ ok: true, id });
  }

  return Response.json({ error: "Unsupported access-settings operation." }, { status: 400 });
}
