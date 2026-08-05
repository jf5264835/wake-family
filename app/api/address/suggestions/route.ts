import { addressAutocompleteConfigured, suggestAddresses } from "../../../../lib/address";
import { checkRateLimit } from "../../../../lib/rate-limit";

export async function GET(request: Request) {
  if (!addressAutocompleteConfigured()) return Response.json({ configured: false, suggestions: [] });
  if (!(await checkRateLimit(request, "address-suggest", 90, 60))) return Response.json({ configured: true, suggestions: [] }, { status: 429 });
  const url = new URL(request.url);
  const input = (url.searchParams.get("q") ?? "").trim().slice(0, 160);
  if (input.length < 3) return Response.json({ configured: true, suggestions: [] });
  try {
    return Response.json({ configured: true, suggestions: await suggestAddresses(input, url.searchParams.get("session") ?? undefined) });
  } catch {
    return Response.json({ configured: true, suggestions: [] });
  }
}
