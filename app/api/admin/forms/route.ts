import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { forms } from "../../../../db/schema";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { defaultFormDefinition } from "../../../../lib/defaults";
import { logAdminAction } from "../../../../lib/admin-audit";
import { canEditForm } from "../../../../lib/form-access";

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, { tab: "forms", action: "read" });
  if (auth.response || !auth.user) return auth.response!;
  const rows = await getDb().select().from(forms).orderBy(desc(forms.updatedAt));
  return Response.json({ forms: rows.map((row) => ({ ...row, canEdit: canEditForm(auth.user!, row) })) });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi(request, { tab: "forms", action: "write" });
  if (auth.response || !auth.user) return auth.response!;
  const payload = (await request.json()) as { name?: string; slug?: string };
  const name = payload.name?.trim() || "Untitled form";
  const slug = (payload.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  if (!slug) return Response.json({ error: "Enter a valid form name or slug." }, { status: 400 });
  const form = { id: crypto.randomUUID(), slug, name, description: "", status: "draft", definition: JSON.stringify(defaultFormDefinition), createdBy: auth.user.id, editPolicy: "owner", sharedUserIds: "[]", sharedGroupIds: "[]" };
  try {
    await getDb().insert(forms).values(form);
    await logAdminAction(auth.user, "form.create", "form", form.id, `Created form ${name}.`, { slug });
    return Response.json({ form }, { status: 201 });
  } catch {
    return Response.json({ error: "That form URL is already in use." }, { status: 409 });
  }
}
