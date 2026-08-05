import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { registrationLogs, registrations } from "../db/schema";
import { normalizeRegistration, validateRegistration } from "./normalize";
import { pcoErrorDetails, pcoIsConfigured, searchPcoDuplicates, syncFamilyToPco } from "./pco";
import { getFamilyFormSettings } from "./family-form-settings";
import type { RegistrationInput } from "./types";

export async function logRegistration(registrationId: string, level: string, event: string, message: string, details?: unknown) {
  await getDb().insert(registrationLogs).values({
    registrationId,
    level,
    event,
    message,
    details: details === undefined ? null : JSON.stringify(details),
  });
}

async function setStatus(id: string, status: string, values: Partial<typeof registrations.$inferInsert> = {}) {
  await getDb().update(registrations).set({ ...values, status, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(registrations.id, id));
}

export async function createRegistration(input: RegistrationInput, formId = "family-registration") {
  const errors = validateRegistration(input);
  if (errors.length) return { ok: false as const, errors };
  const normalized = normalizeRegistration(input);
  const id = crypto.randomUUID();
  await getDb().insert(registrations).values({
    id,
    formId,
    status: "saved",
    rawPayload: JSON.stringify(input),
    normalizedPayload: JSON.stringify(normalized),
  });
  await logRegistration(id, "info", "saved", "Registration was saved locally before any external calls.");
  const result = await checkDuplicatesAndSync(id, normalized);
  return { ok: true as const, id, ...result };
}

export async function checkDuplicatesAndSync(id: string, normalized: RegistrationInput) {
  const primary = normalized.people.find((person) => person.role === "parent") ?? normalized.people[0];
  if (!pcoIsConfigured()) {
    await setStatus(id, "pending_configuration");
    await logRegistration(id, "warn", "pco_not_configured", "Registration is safe locally and waiting for Planning Center credentials.");
    return { matches: [], status: "pending_configuration" };
  }
  try {
    await setStatus(id, "checking_duplicates");
    const matches = await searchPcoDuplicates(primary.email ?? "", primary.phone ?? "");
    if (matches.length) {
      await setStatus(id, "awaiting_duplicate_confirmation", { matchPayload: JSON.stringify(matches) });
      await logRegistration(id, "info", "possible_duplicate", `Found ${matches.length} possible Planning Center match${matches.length === 1 ? "" : "es"}.`, { pcoPersonIds: matches.map((match) => match.id) });
      return { matches, status: "awaiting_duplicate_confirmation" };
    }
    await logRegistration(id, "info", "duplicate_check_clear", "No matching Planning Center people were found.");
    await syncRegistration(id, normalized);
    return { matches: [], status: "synced" };
  } catch (error) {
    const details = pcoErrorDetails(error);
    await setStatus(id, "review_required", { lastError: JSON.stringify(details) });
    await logRegistration(id, "error", "duplicate_check_failed", "Duplicate check failed. Nothing was pushed to Planning Center.", details);
    return { matches: [], status: "review_required" };
  }
}

export async function syncRegistration(id: string, registration?: RegistrationInput, options: { override?: boolean } = {}) {
  const db = getDb();
  const [row] = await db.select().from(registrations).where(eq(registrations.id, id)).limit(1);
  if (!row) throw new Error("Registration not found.");
  const alreadyLinked = row.status === "synced" || Boolean(row.pcoHouseholdId || row.pcoPrimaryPersonId);
  if (alreadyLinked && !options.override) {
    await logRegistration(id, "warn", "pco_resubmit_blocked", "A repeat Planning Center submission was blocked because this transaction is already linked to Planning Center.");
    return { status: "synced", locked: true };
  }
  const normalized = registration ?? (JSON.parse(row.normalizedPayload) as RegistrationInput);
  if (options.override && alreadyLinked) {
    await logRegistration(id, "warn", "pco_override_started", "An administrator explicitly started a new Planning Center family submission from an already-synced transaction.", { previousPcoPrimaryPersonId: row.pcoPrimaryPersonId, previousPcoHouseholdId: row.pcoHouseholdId });
  }
  await setStatus(id, "syncing", {
    attemptCount: row.attemptCount + 1,
    lastError: null,
    ...(options.override && alreadyLinked ? { integrationState: "{}", pcoPrimaryPersonId: null, pcoHouseholdId: null } : {}),
  });
  try {
    const initialState = options.override && alreadyLinked ? {} : JSON.parse(row.integrationState || "{}") as Record<string, unknown>;
    const formSettings = await getFamilyFormSettings();
    const result = await syncFamilyToPco(normalized, initialState, async (state, message, details) => {
      await db.update(registrations).set({ integrationState: JSON.stringify(state), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(registrations.id, id));
      await logRegistration(id, "info", "pco_progress", message, details);
    }, formSettings.mappings);
    await setStatus(id, "synced", {
      integrationState: JSON.stringify(result.state),
      pcoPrimaryPersonId: result.primaryPersonId,
      pcoHouseholdId: result.householdId,
    });
    await logRegistration(id, "info", "pco_synced", "Family and household were submitted to Planning Center.", { pcoPrimaryPersonId: result.primaryPersonId, pcoHouseholdId: result.householdId });
    return { status: "synced" };
  } catch (error) {
    const details = pcoErrorDetails(error);
    await setStatus(id, "failed", { lastError: JSON.stringify(details) });
    await logRegistration(id, "error", "pco_sync_failed", "Planning Center submission failed. The local registration remains safe for retry.", details);
    return { status: "failed" };
  }
}

export async function resolveDuplicate(id: string, isMatch: boolean) {
  const db = getDb();
  const [row] = await db.select().from(registrations).where(eq(registrations.id, id)).limit(1);
  if (!row) return null;
  if (row.status !== "awaiting_duplicate_confirmation") return { status: row.status };
  if (isMatch) {
    await setStatus(id, "assistance_required");
    await logRegistration(id, "info", "duplicate_confirmed", "Registrant confirmed that a displayed Planning Center profile belongs to their family.");
    return { status: "assistance_required" };
  }
  await logRegistration(id, "info", "duplicate_rejected", "Registrant said none of the possible matches belong to their family.");
  const normalized = JSON.parse(row.normalizedPayload) as RegistrationInput;
  return syncRegistration(id, normalized);
}

export async function listRegistrations(filters: { status?: string; search?: string } = {}) {
  const conditions = [];
  if (filters.status && filters.status !== "all") conditions.push(eq(registrations.status, filters.status));
  if (filters.search) conditions.push(or(like(registrations.normalizedPayload, `%${filters.search}%`), like(registrations.id, `%${filters.search}%`))!);
  return getDb().select().from(registrations).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(registrations.createdAt)).limit(200);
}

export async function getRegistration(id: string) {
  const db = getDb();
  const [registration] = await db.select().from(registrations).where(eq(registrations.id, id)).limit(1);
  if (!registration) return null;
  const logs = await db.select().from(registrationLogs).where(eq(registrationLogs.registrationId, id)).orderBy(desc(registrationLogs.createdAt), desc(registrationLogs.id));
  return { registration, logs };
}

export async function updateRegistration(id: string, payload: RegistrationInput) {
  const errors = validateRegistration(payload);
  if (errors.length) return { ok: false as const, errors };
  const normalized = normalizeRegistration(payload);
  const [row] = await getDb().select().from(registrations).where(eq(registrations.id, id)).limit(1);
  if (!row) return { ok: false as const, errors: ["Registration not found."] };
  const alreadySynced = row.status === "synced" || Boolean(row.pcoHouseholdId || row.pcoPrimaryPersonId);
  await getDb().update(registrations).set({ rawPayload: JSON.stringify(payload), normalizedPayload: JSON.stringify(normalized), status: alreadySynced ? row.status : "edited", lastError: alreadySynced ? row.lastError : null, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(registrations.id, id));
  await logRegistration(id, "info", "admin_edited", alreadySynced ? "An administrator edited the local transaction. Existing Planning Center records were not changed." : "An administrator edited the saved registration.");
  return { ok: true as const };
}
