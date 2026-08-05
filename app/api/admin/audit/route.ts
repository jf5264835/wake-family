import { requireAdminApi } from "../../../../lib/admin-auth";
import { listAdminAudit } from "../../../../lib/admin-audit";

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, { tab: "system", action: "read", adminOnly: true });
  if (auth.response) return auth.response;
  const search = new URL(request.url).searchParams.get("search") ?? "";
  return Response.json({ events: await listAdminAudit(search) });
}
