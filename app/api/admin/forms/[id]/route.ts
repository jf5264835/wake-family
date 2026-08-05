import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { forms } from "../../../../../db/schema";
import { requireAdminApi } from "../../../../../lib/admin-auth";
import type { FormDefinition } from "../../../../../lib/types";
import { validateFormDefinition } from "../../../../../lib/form-validation";
import { canEditForm } from "../../../../../lib/form-access";
import { logAdminAction } from "../../../../../lib/admin-audit";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(request, { tab: "forms", action: "write" });
  if (auth.response || !auth.user) return auth.response!;
  const { id } = await context.params;
  const [existing] = await getDb().select().from(forms).where(eq(forms.id, id)).limit(1);
  if (!existing) return Response.json({ error: "Form not found." }, { status: 404 });
  if (!canEditForm(auth.user, existing)) return Response.json({ error: "This form is locked to its owner or sharing list." }, { status: 403 });
  const payload = (await request.json()) as { name?: string; slug?: string; description?: string; status?: string; definition?: FormDefinition; editPolicy?: string; sharedUserIds?: string[]; sharedGroupIds?: string[] };
  if (!payload.name?.trim() || !payload.slug?.trim() || !payload.definition?.fields) return Response.json({ error: "Name, URL, and fields are required." }, { status: 400 });
  const definitionErrors = validateFormDefinition(payload.definition);
  if (definitionErrors.length) return Response.json({ error: definitionErrors[0], errors: definitionErrors }, { status: 400 });
  const slug = payload.slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const status = payload.status === "published" ? "published" : "draft";
  const editPolicy = ["owner", "shared", "all"].includes(payload.editPolicy ?? "") ? payload.editPolicy! : "owner";
  const sharedUserIds = Array.isArray(payload.sharedUserIds) ? payload.sharedUserIds.filter((value) => typeof value === "string") : [];
  const sharedGroupIds = Array.isArray(payload.sharedGroupIds) ? payload.sharedGroupIds.filter((value) => typeof value === "string") : [];
  await getDb().update(forms).set({ name: payload.name.trim(), slug, description: payload.description?.trim() ?? "", status, definition: JSON.stringify(payload.definition), editPolicy, sharedUserIds: JSON.stringify(sharedUserIds), sharedGroupIds: JSON.stringify(sharedGroupIds), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(forms.id, id));
  await logAdminAction(auth.user, "form.update", "form", id, `Updated form ${payload.name.trim()}.`, { slug, status, editPolicy, sharedUserIds, sharedGroupIds });
  return Response.json({ ok: true });
}
