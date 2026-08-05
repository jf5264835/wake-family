import { requireAdminApi } from "../../../../../../lib/admin-auth";
import { getRegistration, syncRegistration } from "../../../../../../lib/registration-service";
import { logAdminAction } from "../../../../../../lib/admin-audit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(request, { tab: "transactions", action: "write" });
  if (auth.response || !auth.user) return auth.response!;
  const { id } = await context.params;
  const current = await getRegistration(id);
  if (!current) return Response.json({ error: "Registration not found." }, { status: 404 });
  const payload = await request.json().catch(() => ({})) as { override?: boolean };
  const result = await syncRegistration(id, undefined, { override: payload.override === true });
  await logAdminAction(auth.user, payload.override === true ? "transaction.override_submit" : "transaction.retry", "registration", id, payload.override === true ? "Explicitly overrode the PCO resubmission lock." : "Retried a Planning Center submission.", result);
  if ("locked" in result && result.locked) return Response.json({ error: "This transaction is already linked to Planning Center. Use the explicit override to submit it again.", ...result }, { status: 409 });
  return Response.json(result);
}
