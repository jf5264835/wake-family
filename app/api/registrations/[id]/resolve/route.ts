import { resolveDuplicate } from "../../../../../lib/registration-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as { isMatch?: boolean };
    if (typeof payload.isMatch !== "boolean") return Response.json({ error: "A match selection is required." }, { status: 400 });
    const result = await resolveDuplicate(id, payload.isMatch);
    if (!result) return Response.json({ error: "Registration not found." }, { status: 404 });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Selection could not be saved." }, { status: 500 });
  }
}
