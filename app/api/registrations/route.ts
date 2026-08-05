import { checkRegistrationRateLimit } from "../../../lib/rate-limit";
import { createRegistration } from "../../../lib/registration-service";
import type { RegistrationInput } from "../../../lib/types";

export async function POST(request: Request) {
  try {
    if (!(await checkRegistrationRateLimit(request))) {
      return Response.json({ error: "Too many registrations were submitted from this device. Please ask a volunteer for help." }, { status: 429 });
    }
    const payload = (await request.json()) as RegistrationInput;
    const result = await createRegistration(payload);
    if (!result.ok) return Response.json({ error: result.errors[0], errors: result.errors }, { status: 400 });
    return Response.json({ transactionId: result.id, matches: result.matches, status: result.status }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Registration could not be saved." }, { status: 500 });
  }
}
