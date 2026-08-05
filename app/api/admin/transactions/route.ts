import { requireAdminApi } from "../../../../lib/admin-auth";
import { listRegistrations } from "../../../../lib/registration-service";

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, { tab: "transactions", action: "read" });
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const rows = await listRegistrations({ status: url.searchParams.get("status") ?? undefined, search: url.searchParams.get("search") ?? undefined });
  return Response.json({ transactions: rows });
}
