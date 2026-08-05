import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { forms } from "../../../../db/schema";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const [form] = await getDb().select().from(forms).where(eq(forms.slug, slug)).limit(1);
  if (!form || form.status !== "published") return Response.json({ error: "Form not found." }, { status: 404 });
  return Response.json({ form: { id: form.id, slug: form.slug, name: form.name, description: form.description, definition: JSON.parse(form.definition) } });
}
