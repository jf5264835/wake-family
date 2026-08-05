import { requireAdminApi } from "../../../../../lib/admin-auth";
import { getRegistration, updateRegistration } from "../../../../../lib/registration-service";
import type { RegistrationInput } from "../../../../../lib/types";
import { logAdminAction } from "../../../../../lib/admin-audit";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(request, { tab: "transactions", action: "read" });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const result = await getRegistration(id);
  if (!result) return Response.json({ error: "Registration not found." }, { status: 404 });
  return Response.json(result);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(request, { tab: "transactions", action: "write" });
  if (auth.response || !auth.user) return auth.response!;
  const { id } = await context.params;
  const payload = (await request.json()) as RegistrationInput;
  const result = await updateRegistration(id, payload);
  if (!result.ok) return Response.json({ error: result.errors[0], errors: result.errors }, { status: 400 });
  await logAdminAction(auth.user, "transaction.update", "registration", id, "Edited a saved registration transaction.");
  return Response.json(result);
}
