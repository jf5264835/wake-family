import { getDb } from "../../../../db";
import { adminGroups, adminUsers } from "../../../../db/schema";
import { requireAdminApi } from "../../../../lib/admin-auth";

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, { tab: "forms", action: "read" });
  if (auth.response) return auth.response;
  const [users, groups] = await Promise.all([getDb().select({ id: adminUsers.id, name: adminUsers.name, email: adminUsers.email, username: adminUsers.username, enabled: adminUsers.enabled }).from(adminUsers), getDb().select({ id: adminGroups.id, name: adminGroups.name }).from(adminGroups)]);
  return Response.json({ users: users.filter((user) => user.enabled).map(({ id, name, email, username }) => ({ id, name, email, username })), groups });
}
