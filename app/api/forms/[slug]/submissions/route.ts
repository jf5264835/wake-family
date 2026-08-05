import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { forms, registrations } from "../../../../../db/schema";
import { checkRegistrationRateLimit } from "../../../../../lib/rate-limit";
import { logRegistration } from "../../../../../lib/registration-service";
import type { FormDefinition } from "../../../../../lib/types";
import { normalizeFormValues, validateFormValues } from "../../../../../lib/form-validation";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!(await checkRegistrationRateLimit(request))) return Response.json({ error: "Too many submissions. Please wait and try again." }, { status: 429 });
  const { slug } = await context.params;
  const [form] = await getDb().select().from(forms).where(eq(forms.slug, slug)).limit(1);
  if (!form || form.status !== "published") return Response.json({ error: "Form not found." }, { status: 404 });
  const definition = JSON.parse(form.definition) as FormDefinition;
  const values = (await request.json()) as Record<string, unknown>;
  const normalizedValues = normalizeFormValues(definition, values);
  const fieldErrors = validateFormValues(definition, normalizedValues);
  const errors = Object.values(fieldErrors);
  if (errors.length) return Response.json({ error: errors[0], errors, fieldErrors }, { status: 400 });
  const mapped = Object.fromEntries(definition.fields.filter((field) => field.pcoMapping).map((field) => [field.pcoMapping!, normalizedValues[field.id]]));
  const id = crypto.randomUUID();
  await getDb().insert(registrations).values({ id, formId: form.id, status: "saved_form_response", rawPayload: JSON.stringify(values), normalizedPayload: JSON.stringify({ values: normalizedValues, pcoMappings: mapped }) });
  await logRegistration(id, "info", "form_saved", `Submission for ${form.name} was saved locally.`, { configuredPcoMappings: Object.keys(mapped) });
  return Response.json({ transactionId: id, status: "saved_form_response" }, { status: 201 });
}
