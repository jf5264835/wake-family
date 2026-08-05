import { addressAutocompleteConfigured, getAddressDetails } from "../../../../lib/address";
import { checkRateLimit } from "../../../../lib/rate-limit";

export async function GET(request: Request) {
  if (!addressAutocompleteConfigured()) return Response.json({ error: "Address autocomplete is not configured." }, { status: 503 });
  if (!(await checkRateLimit(request, "address-details", 30, 60))) return Response.json({ error: "Too many address lookups. Please continue with manual entry." }, { status: 429 });
  const url = new URL(request.url);
  const placeId = (url.searchParams.get("placeId") ?? "").trim();
  if (!placeId || placeId.length > 256) return Response.json({ error: "A valid place is required." }, { status: 400 });
  try {
    return Response.json({ address: await getAddressDetails(placeId, url.searchParams.get("session") ?? undefined) });
  } catch {
    return Response.json({ error: "Address details could not be loaded." }, { status: 502 });
  }
}
