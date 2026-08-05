import { defaultFamilyFormSettings } from "../../../lib/defaults";
import { getFamilyFormSettings } from "../../../lib/family-form-settings";

export async function GET() {
  try {
    return Response.json({ settings: await getFamilyFormSettings() }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ settings: defaultFamilyFormSettings }, { headers: { "cache-control": "no-store" } });
  }
}
