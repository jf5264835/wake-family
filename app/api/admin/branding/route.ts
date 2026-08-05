import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { siteSettings } from "../../../../db/schema";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { defaultBranding, resolveBranding, WAKE_BRAND_STANDARDS_VERSION } from "../../../../lib/defaults";
import type { BrandingSettings } from "../../../../lib/types";
import { logAdminAction } from "../../../../lib/admin-audit";

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, { tab: "branding", action: "read" });
  if (auth.response) return auth.response;
  const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.id, "default")).limit(1);
  if (!row) return Response.json({ branding: defaultBranding });
  const saved = JSON.parse(row.settings) as Partial<BrandingSettings> & { familyFormLabels?: unknown };
  delete saved.familyFormLabels;
  return Response.json({ branding: resolveBranding(saved) });
}

export async function PUT(request: Request) {
  const auth = await requireAdminApi(request, { tab: "branding", action: "write" });
  if (auth.response || !auth.user) return auth.response!;
  const payload = (await request.json()) as Partial<BrandingSettings> & { familyFormLabels?: unknown };
  delete payload.familyFormLabels;
  const settings: BrandingSettings = { ...defaultBranding, ...payload, brandStandardsVersion: WAKE_BRAND_STANDARDS_VERSION };
  for (const key of ["primaryColor", "accentColor", "panelColor"] as const) {
    if (!/^#[0-9a-f]{6}$/i.test(settings[key])) return Response.json({ error: `${key} must be a 6-digit hex color.` }, { status: 400 });
  }
  for (const key of ["formBackgroundColor", "textColor"] as const) {
    if (!/^#[0-9a-f]{6}$/i.test(settings[key])) return Response.json({ error: `${key} must be a 6-digit hex color.` }, { status: 400 });
  }
  if (!Number.isFinite(settings.panelOverlayOpacity) || settings.panelOverlayOpacity < 0 || settings.panelOverlayOpacity > 95) return Response.json({ error: "Panel overlay must be between 0 and 95 percent." }, { status: 400 });
  if (!["editorial", "modern", "classic"].includes(settings.fontStyle)) return Response.json({ error: "Choose a valid font style." }, { status: 400 });
  if (!["soft", "rounded", "square"].includes(settings.cornerStyle)) return Response.json({ error: "Choose a valid corner style." }, { status: 400 });
  await getDb().insert(siteSettings).values({ id: "default", settings: JSON.stringify(settings), updatedBy: auth.user.email }).onConflictDoUpdate({
    target: siteSettings.id,
    set: { settings: JSON.stringify(settings), updatedBy: auth.user.email, updatedAt: sql`CURRENT_TIMESTAMP` },
  });
  await logAdminAction(auth.user, "branding.update", "site_settings", "default", "Updated public branding.");
  return Response.json({ branding: settings });
}
