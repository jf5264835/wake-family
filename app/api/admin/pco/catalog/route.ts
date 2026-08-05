import { requireAdminApi } from "../../../../../lib/admin-auth";
import { fetchPcoCatalog, pcoErrorDetails, pcoIsConfigured } from "../../../../../lib/pco";

export async function GET(request: Request) {
  const auth = await requireAdminApi(request);
  if (auth.response || !auth.user) return auth.response!;
  if (!auth.user.isAdmin && !auth.user.permissions.forms.read && !auth.user.permissions.registration.read) {
    return Response.json({ error: "You do not have permission to load Planning Center fields." }, { status: 403 });
  }
  if (!pcoIsConfigured()) return Response.json({ error: "Planning Center credentials are not configured.", items: [] }, { status: 503 });
  try {
    return Response.json({ items: await fetchPcoCatalog() });
  } catch (error) {
    return Response.json({ error: "Planning Center fields and lists could not be loaded.", details: pcoErrorDetails(error), items: [] }, { status: 502 });
  }
}
