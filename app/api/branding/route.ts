import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { siteSettings } from "../../../db/schema";
import { defaultBranding, resolveBranding } from "../../../lib/defaults";
import type { BrandingSettings } from "../../../lib/types";

export async function GET() {
  try {
    const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.id, "default")).limit(1);
    if (!row) return Response.json({ branding: defaultBranding }, { headers: { "cache-control": "no-store" } });
    const saved = JSON.parse(row.settings) as Partial<BrandingSettings> & { familyFormLabels?: unknown };
    delete saved.familyFormLabels;
    return Response.json({ branding: resolveBranding(saved) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ branding: defaultBranding }, { headers: { "cache-control": "no-store" } });
  }
}
