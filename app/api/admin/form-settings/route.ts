import { sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { siteSettings } from "../../../../db/schema";
import { logAdminAction } from "../../../../lib/admin-audit";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { getFamilyFormSettings, normalizeFamilyFormSettings } from "../../../../lib/family-form-settings";

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, { tab: "registration", action: "read" });
  if (auth.response) return auth.response;
  return Response.json({ settings: await getFamilyFormSettings() });
}

export async function PUT(request: Request) {
  const auth = await requireAdminApi(request, { tab: "registration", action: "write" });
  if (auth.response || !auth.user) return auth.response!;
  const settings = normalizeFamilyFormSettings(await request.json());
  await getDb().insert(siteSettings).values({ id: "family-form", settings: JSON.stringify(settings), updatedBy: auth.user.email }).onConflictDoUpdate({ target: siteSettings.id, set: { settings: JSON.stringify(settings), updatedBy: auth.user.email, updatedAt: sql`CURRENT_TIMESTAMP` } });
  await logAdminAction(auth.user, "registration_form.update", "site_settings", "family-form", "Updated primary registration labels and Planning Center value mappings.", { mappings: settings.mappings });
  return Response.json({ settings });
}
